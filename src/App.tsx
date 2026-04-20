/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Usuarios from "./pages/Usuarios";
import Dashboard from "./pages/Dashboard";
import Funcionarios from "./pages/Funcionarios";
import FuncionarioDetalhes from "./pages/FuncionarioDetalhes";
import Epis from "./pages/Epis";
import Incendio from "./pages/Incendio";
import Inspecoes from "./pages/Inspecoes";
import Treinamentos from "./pages/Treinamentos";
import Cipa from "./pages/Cipa";
import Agenda from "./pages/Agenda";
import Ocorrencias from "./pages/Ocorrencias";
import Exames from "./pages/Exames";
import Normas from "./pages/Normas";
import PermissaoTrabalho from "./pages/PermissaoTrabalho";
import Laudos from "./pages/Laudos";
import ProdutosQuimicos from "./pages/ProdutosQuimicos";

import Relatorios5S from "./pages/Relatorios5S";
import RelatoriosInspecoes from "./pages/RelatoriosInspecoes";
import Configuracoes from "./pages/Configuracoes";
import Fornecedores from "./pages/Fornecedores";
import { setGlobalSectorColors } from "./utils/sectorColors";
import { supabase } from "./lib/supabase";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  return <>{children}</>;
}

export default function App() {
  const settingsFetched = useRef(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (settingsFetched.current) return;
      settingsFetched.current = true;
      
      try {
        const { data, error } = await supabase.from('company_settings').select('sector_colors').single();
        if (error) {
          // If it's an auth error, we'll try again later or let AuthContext handle it
          if (error.code === 'PGRST116' || (error as any).status === 406) {
             // Not found or not authorized yet, reset for retry if auth changes
             settingsFetched.current = false;
          }
          return;
        }
        if (data && data.sector_colors) {
          try {
            const colors = JSON.parse(data.sector_colors);
            setGlobalSectorColors(colors);
          } catch (e) {
            console.error("Failed to parse sector colors", e);
          }
        }
      } catch (err) {
        console.error("Failed to fetch settings", err);
        settingsFetched.current = false;
      }
    };
    fetchSettings();
  }, []);

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="funcionarios" element={<Funcionarios />} />
          <Route path="funcionarios/:id" element={<FuncionarioDetalhes />} />
          <Route path="epis" element={<Epis />} />
          <Route path="laudos" element={<Laudos />} />
          <Route path="produtos-quimicos" element={<ProdutosQuimicos />} />
          <Route path="incendio" element={<Incendio />} />
          <Route path="inspecoes" element={<Inspecoes />} />
          <Route path="fornecedores" element={<Fornecedores />} />
          <Route path="relatorios-inspecoes" element={<RelatoriosInspecoes />} />
          <Route path="relatorios-5s" element={<Relatorios5S />} />
          <Route path="treinamentos" element={<Treinamentos />} />
          <Route path="cipa" element={<Cipa />} />
          <Route path="ocorrencias" element={<Ocorrencias />} />
          <Route path="exames" element={<Exames />} />
          <Route path="normas" element={<Normas />} />
          <Route path="permissao-trabalho" element={<PermissaoTrabalho />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="dashboard" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
