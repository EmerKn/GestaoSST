import { useState, useEffect, useRef } from "react";
import { Settings, Save, Image as ImageIcon, PenTool, Database, Upload, Trash2, Lock, Palette } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import * as XLSX from "xlsx";
import { useAuth } from "../contexts/AuthContext";
import { predefinedColors, setGlobalSectorColors, getSectorColor, SectorBadge } from "../utils/sectorColors";
import { supabase } from "../lib/supabase";
import { ImageUpload } from "../components/ImageUpload";

interface CompanySettings {
  company_name: string;
  company_logo: string;
  company_address: string;
  company_phone: string;
  company_website: string;
  resp_name: string;
  resp_role: string;
  resp_signature: string;
  resp_email: string;
  sector_colors?: string;
}

export default function Configuracoes() {
  const { isMaster } = useAuth();
  const [settings, setSettings] = useState<CompanySettings>({
    company_name: "",
    company_logo: "",
    company_address: "",
    company_phone: "",
    company_website: "",
    resp_name: "",
    resp_role: "",
    resp_signature: "",
    resp_email: "",
    sector_colors: "{}"
  });
  
  const [sectors, setSectors] = useState<string[]>([]);
  const [sectorColors, setSectorColors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const sigRef = useRef<SignatureCanvas>(null);

  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [settingsRes, sectorsRes] = await Promise.all([
          supabase.from('company_settings').select('*').single(),
          supabase.from('employees').select('sector')
        ]);

        if (settingsRes.data) {
          setSettings(settingsRes.data);
          if (settingsRes.data.sector_colors) {
            try {
              const parsedColors = JSON.parse(settingsRes.data.sector_colors);
              setSectorColors(parsedColors);
              setGlobalSectorColors(parsedColors);
            } catch (e) {
              console.error("Failed to parse sector colors", e);
            }
          }
        }

        if (sectorsRes.data) {
          const uniqueSectors = Array.from(new Set(sectorsRes.data.map(e => e.sector).filter(Boolean)));
          setSectors(uniqueSectors as string[]);
        }
      } catch (err) {
        console.error("Failed to fetch data", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  const handleLogoChange = (file: File) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, company_logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleColorChange = (sector: string, colorHex: string) => {
    const newColors = { ...sectorColors, [sector]: colorHex };
    setSectorColors(newColors);
    setGlobalSectorColors(newColors);
    setSettings({ ...settings, sector_colors: JSON.stringify(newColors) });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    const dataToSave = { ...settings, sector_colors: JSON.stringify(sectorColors) };
    
    if (sigRef.current && !sigRef.current.isEmpty()) {
      dataToSave.resp_signature = sigRef.current.getTrimmedCanvas().toDataURL('image/png');
    }

    try {
      const { error } = await supabase
        .from('company_settings')
        .update(dataToSave)
        .eq('id', 1);

      if (error) throw error;
      
      alert("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetData = async () => {
    setSaving(true);
    try {
      // Delete all data (except users and company_settings)
      await supabase.from('occurrences').delete().neq('id', 0);
      await supabase.from('exams').delete().neq('id', 0);
      await supabase.from('brigade_members').delete().neq('id', 0);
      await supabase.from('fire_equipment').delete().neq('id', 0);
      await supabase.from('ppes').delete().neq('id', 0);
      await supabase.from('employees').delete().neq('id', 0);
      await supabase.from('trainings').delete().neq('id', 0);
      await supabase.from('cipa_meeting_topics').delete().neq('id', 0);
      await supabase.from('cipa_meetings').delete().neq('id', 0);
      await supabase.from('cipa_members').delete().neq('id', 0);

      // Insert Mock Data with Negative IDs
      await supabase.from('employees').insert([
        { id: -1, name: 'João da Silva', cpf: '111.222.333-44', role: 'Operador de Máquinas', sector: 'Produção', shift: 'Manhã', photo_url: 'https://picsum.photos/seed/joao/200/200', admission_date: '2023-01-15', gender: 'Masculino' },
        { id: -2, name: 'Maria Souza', cpf: '555.666.777-88', role: 'Técnica de Segurança', sector: 'SESMT', shift: 'Manhã', photo_url: 'https://picsum.photos/seed/maria/200/200', admission_date: '2022-05-10', gender: 'Feminino' },
        { id: -3, name: 'Carlos Pereira', cpf: '999.888.777-66', role: 'Eletricista', sector: 'Manutenção', shift: 'Tarde', photo_url: 'https://picsum.photos/seed/carlos/200/200', admission_date: '2021-11-20', gender: 'Masculino' }
      ]);

      await supabase.from('ppes').insert([
        { id: -1, name: 'Capacete de Segurança', ca: '12345', price: 25.50, photo_url: 'https://picsum.photos/seed/capacete/200/200', stock: 50 },
        { id: -2, name: 'Luva de Raspa', ca: '54321', price: 12.00, photo_url: 'https://picsum.photos/seed/luva/200/200', stock: 100 },
        { id: -3, name: 'Protetor Auricular', ca: '98765', price: 5.00, photo_url: 'https://picsum.photos/seed/protetor/200/200', stock: 200 }
      ]);

      await supabase.from('fire_equipment').insert([
        { id: -1, type: 'Extintor PQS 4kg', location: 'Setor de Produção - Pilastra 2', next_inspection: '2026-12-01', hydrostatic_test: '2028-12-01', status: 'Regular' },
        { id: -2, type: 'Hidrante', location: 'Corredor Principal', next_inspection: '2026-06-15', hydrostatic_test: '2027-06-15', status: 'Regular' }
      ]);

      await supabase.from('brigade_members').insert([
        { id: -1, employee_id: -1, brigade_role: 'Combate a Incêndio' },
        { id: -2, employee_id: -3, brigade_role: 'Primeiros Socorros' }
      ]);

      await supabase.from('occurrences').insert([
        { id: -1, type: 'Acidente', employee_id: -1, date: '2024-01-10', time: '14:30', location: 'Máquina 01', sector: 'Produção', description: 'Corte no dedo', injury: 'Corte', body_part: 'Dedo da mão', days_away: 2, status: 'Concluído' }
      ]);

      await supabase.from('exams').insert([
        { id: -1, employee_id: -1, type: 'Periódico', specific_exams: 'Clínico, Audiometria', periodicity: '12 meses', exam_date: '2024-02-01', next_exam_date: '2025-02-01', status: 'Realizado' }
      ]);

      await supabase.from('trainings').insert([
        { id: -1, title: 'NR-35 Trabalho em Altura', date: '2026-03-15', description: 'Reciclagem anual para equipe de manutenção.', instructor: 'Eng. Roberto', enrolled: 12 },
        { id: -2, title: 'NR-10 Segurança em Instalações', date: '2026-03-22', description: 'Formação para novos eletricistas.', instructor: 'Téc. Maria', enrolled: 5 }
      ]);

      await supabase.from('cipa_members').insert([
        { id: -1, employee_id: -1, cipa_role: 'Membro Titular' },
        { id: -2, employee_id: -2, cipa_role: 'Presidente' }
      ]);

      await supabase.from('cipa_meetings').insert([
        { id: -1, date: '2026-02-10', type: 'Ordinária', file_url: '', participants: [{ employee_id: -1, name: 'João da Silva', role: 'Operador de Máquinas', cipa_role: 'Membro Titular' }, { employee_id: -2, name: 'Maria Souza', role: 'Técnica de Segurança', cipa_role: 'Presidente' }], topics: [{ title: 'EPIs', description: 'Revisão do estoque de EPIs', status: 'Concluído', deadline: '2026-02-20' }] }
      ]);

      await supabase.from('cipa_meeting_topics').insert([
        { id: -1, meeting_id: -1, title: 'EPIs', description: 'Revisão do estoque de EPIs', status: 'Concluído', deadline: '2026-02-20' }
      ]);

      alert("Dados restaurados com sucesso!");
      setShowResetModal(false);
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Erro ao restaurar dados.");
    } finally {
      setSaving(false);
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        const payload: any = {};

        // Map sheets to tables
        if (wb.SheetNames.includes("Funcionarios")) {
          payload.employees = XLSX.utils.sheet_to_json(wb.Sheets["Funcionarios"]);
        }
        if (wb.SheetNames.includes("EPIs")) {
          payload.ppes = XLSX.utils.sheet_to_json(wb.Sheets["EPIs"]);
        }
        if (wb.SheetNames.includes("Ocorrencias")) {
          payload.occurrences = XLSX.utils.sheet_to_json(wb.Sheets["Ocorrencias"]);
        }
        if (wb.SheetNames.includes("Exames")) {
          payload.exams = XLSX.utils.sheet_to_json(wb.Sheets["Exames"]);
        }

        // TODO: Implement Supabase bulk insert
        alert("A importação de Excel não está disponível no modo Supabase ainda.");
        
      } catch (error) {
        console.error(error);
        alert("Erro ao processar o arquivo Excel.");
      } finally {
        setImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  if (!isMaster) {
    return (
      <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-gray-200 max-w-2xl mx-auto mt-10">
        <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso Restrito</h2>
        <p className="text-gray-600">Apenas o usuário Master tem permissão para acessar as configurações do sistema.</p>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando configurações...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-8 h-8 text-slate-700" />
        <h1 className="text-2xl font-bold text-slate-200">Configurações do Sistema</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Company Data */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-6 border-b border-gray-100 pb-2">Dados da Empresa</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 flex flex-col items-center sm:flex-row sm:items-start gap-6">
              <div className="w-full sm:w-64">
                <ImageUpload
                  label="Logo da Empresa"
                  name="company_logo"
                  currentImage={settings.company_logo}
                  onImageSelect={handleLogoChange}
                />
              </div>
              
              <div className="flex-1 w-full space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
                  <input type="text" name="company_name" value={settings.company_name || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Endereço Completo</label>
                  <input type="text" name="company_address" value={settings.company_address || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" required />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / Contato</label>
              <input type="text" name="company_phone" value={settings.company_phone || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Site ou Redes Sociais</label>
              <input type="text" name="company_website" value={settings.company_website || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
            </div>
          </div>
        </div>

        {/* Responsible Data */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-6 border-b border-gray-100 pb-2">Responsável SST</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
              <input type="text" name="resp_name" value={settings.resp_name || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
              <input type="text" name="resp_role" value={settings.resp_role || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" required />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail do Responsável</label>
              <input type="email" name="resp_email" value={settings.resp_email || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="E-mail para notificações do sistema" />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <PenTool className="w-4 h-4" /> Assinatura Padrão
              </label>
              
              {settings.resp_signature && (
                <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50 inline-block">
                  <p className="text-xs text-gray-500 mb-2">Assinatura Atual:</p>
                  <img src={settings.resp_signature} alt="Assinatura" className="h-20 object-contain" />
                </div>
              )}
              
              <div className="border border-gray-300 bg-white rounded-lg mb-2">
                <SignatureCanvas 
                  ref={sigRef} 
                  canvasProps={{className: 'w-full h-40 rounded-lg'}} 
                  backgroundColor="white"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Desenhe acima para atualizar a assinatura.</span>
                <button type="button" onClick={() => sigRef.current?.clear()} className="text-sm text-red-600 hover:underline">Limpar Canvas</button>
              </div>
            </div>
          </div>
        </div>

        {/* Sector Colors Configuration */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-6 border-b border-gray-100 pb-2 flex items-center gap-2">
            <Palette className="w-5 h-5 text-pink-600" />
            Cores dos Setores
          </h2>
          
          <p className="text-sm text-gray-600 mb-6">
            Defina uma cor única para cada setor. Esta cor será utilizada em todo o sistema (gráficos, tabelas, relatórios) para facilitar a identificação visual.
          </p>

          {sectors.length === 0 ? (
            <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
              Nenhum setor cadastrado no sistema. Adicione funcionários com setores para configurar suas cores.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {sectors.map((sector) => {
                const currentColor = getSectorColor(sector);
                const isHex = currentColor.startsWith('#');
                
                return (
                  <div key={sector} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div 
                        className={`w-6 h-6 rounded border border-gray-300 shadow-sm ${!isHex ? currentColor.split(' ')[0] : ''}`}
                        style={isHex ? { backgroundColor: currentColor } : {}}
                      ></div>
                      <span className="font-medium text-gray-700 truncate max-w-[120px]" title={sector}>{sector}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={isHex ? currentColor : predefinedColors.find(c => c.class === currentColor)?.hex || '#000000'}
                        onChange={(e) => handleColorChange(sector, e.target.value)}
                        className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                        title={`Alterar cor do setor ${sector}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button 
            type="submit" 
            disabled={saving}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-lg hover:bg-slate-800 transition font-medium disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? "Salvando..." : "Salvar Configurações"}</span>
          </button>
        </div>
      </form>

      {/* Data Management */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-8">
        <h2 className="text-lg font-bold text-gray-800 mb-6 border-b border-gray-100 pb-2 flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-600" />
          Gerenciamento de Dados
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" />
              Importar Dados (Excel)
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Importe funcionários, EPIs, ocorrências e exames através de uma planilha .xlsx. 
              As abas devem se chamar: "Funcionarios", "EPIs", "Ocorrencias", "Exames".
            </p>
            <label className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition cursor-pointer font-medium">
              <Upload className="w-4 h-4" />
              {importing ? "Importando..." : "Selecionar Arquivo .xlsx"}
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} disabled={importing} />
            </label>
          </div>

          <div className="p-4 border border-red-200 rounded-lg bg-red-50">
            <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Limpar Dados do Sistema
            </h3>
            <p className="text-sm text-red-700 mb-4">
              Atenção: Esta ação apagará todos os dados atuais do sistema e restaurará apenas um exemplo fictício para cada aba.
            </p>
            <button 
              type="button"
              onClick={() => setShowResetModal(true)}
              className="w-full flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Restaurar Dados Fictícios
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <Trash2 className="w-8 h-8" />
              <h3 className="text-xl font-bold">Atenção</h3>
            </div>
            <p className="text-gray-700 mb-6">
              Você deseja apagar todos os dados inseridos? Esta ação irá restaurar o sistema para o estado inicial com dados fictícios.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
                disabled={saving}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleResetData}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition flex items-center gap-2"
                disabled={saving}
              >
                {saving ? "Restaurando..." : "Avançar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
