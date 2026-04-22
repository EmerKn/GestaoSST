import { useState, useEffect, useRef } from "react";
import { Pill, Plus, Download, Trash2, Calendar, ClipboardList, BarChart2, CheckCircle, AlertTriangle, X } from "lucide-react";
import { format, parseISO, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { filterRealData } from "./Funcionarios";
import { fetchSettings, addStandardHeaderToPDF, addStandardFooterToPDF, CompanySettings } from "../utils/pdfUtils";
import { SectorBadge } from "../utils/sectorColors";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

interface Medication {
  id: number;
  name: string;
  description: string;
  dosage: string;
  quantity: number;
}

interface Delivery {
  id: number;
  medication_id: number;
  employee_id: number;
  quantity: number;
  delivery_date: string;
  medications?: { name: string; dosage: string };
  employees?: { name: string; sector: string; role: string };
}

interface Employee {
  id: number;
  name: string;
  sector: string;
  role: string;
}

export default function Medicamentos() {
  const { canEdit, isMobile } = useAuth();
  const canEditPage = canEdit && !isMobile;

  const [activeTab, setActiveTab] = useState<"estoque" | "entregas" | "relatorios">("estoque");
  const [medications, setMedications] = useState<Medication[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  const [showAddMedication, setShowAddMedication] = useState(false);
  const [newMedication, setNewMedication] = useState({ name: "", description: "", dosage: "", quantity: 0 });

  const [showAddDelivery, setShowAddDelivery] = useState(false);
  const [newDelivery, setNewDelivery] = useState({ employee_id: "", medication_id: "", quantity: 1, delivery_date: format(new Date(), "yyyy-MM-dd") });

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [medRes, delRes, empRes, setRes] = await Promise.all([
        supabase.from('medications').select('*').order('name'),
        supabase.from('medication_deliveries').select('*, medications(name, dosage), employees(name, sector, role)').order('delivery_date', { ascending: false }),
        supabase.from('employees').select('id, name, sector, role').eq('status', 'Ativo').order('name'),
        fetchSettings()
      ]);

      if (medRes.data) setMedications(medRes.data);
      if (delRes.data) setDeliveries(delRes.data);
      if (empRes.data) setEmployees(filterRealData(empRes.data));
      setSettings(setRes);
    } catch (error) {
      console.error("Erro ao carregar dados de medicamentos.", error);
    }
  };

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedication.name) return;

    await supabase.from('medications').insert([{ ...newMedication }]);
    setShowAddMedication(false);
    setNewMedication({ name: "", description: "", dosage: "", quantity: 0 });
    loadData();
  };

  const handleDeleteMedication = async (id: number) => {
    if (confirm("Excluir este medicamento deletará todo o seu histórico de entregas. Deseja continuar?")) {
      await supabase.from('medications').delete().eq('id', id);
      loadData();
    }
  };

  const handleAddDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const med = medications.find(m => m.id === parseInt(newDelivery.medication_id));
    if (!med) return alert("Selecione um medicamento!");
    if (med.quantity < newDelivery.quantity) return alert("Estoque Insuficiente do Medicamento selecionado!");

    const { error } = await supabase.from('medication_deliveries').insert([{
      employee_id: parseInt(newDelivery.employee_id),
      medication_id: parseInt(newDelivery.medication_id),
      quantity: parseInt(newDelivery.quantity.toString()),
      delivery_date: newDelivery.delivery_date
    }]);

    if (error) {
      alert("Erro ao registrar a entrega do medicamento. Tente novamente.");
    } else {
      setShowAddDelivery(false);
      setNewDelivery({ employee_id: "", medication_id: "", quantity: 1, delivery_date: format(new Date(), "yyyy-MM-dd") });
      loadData();
    }
  };

  const handleDeleteDelivery = async (id: number) => {
    if (confirm("Deseja cancelar/excluir este registro de entrega? (O estoque do medicamento não será devolvido automaticamente nesta operação).")) {
      await supabase.from('medication_deliveries').delete().eq('id', id);
      loadData();
    }
  };

  // Reports Engine
  const generatePDFReport = (period: 'mensal' | 'anual') => {
    const doc = new jsPDF();
    const title = period === 'mensal' ? "Relatório Mensal de Medicamentos" : "Relatório Anual de Medicamentos";
    let currentY = addStandardHeaderToPDF(doc, settings, title);

    const now = new Date();
    const periodStart = period === 'mensal' ? startOfMonth(now) : startOfYear(now);
    
    const filteredDeliveries = deliveries.filter(d => parseISO(d.delivery_date) >= periodStart);

    doc.setFontSize(12);
    doc.text(`Período de Análise a partir de: ${format(periodStart, "dd/MM/yyyy")}`, 14, currentY);
    currentY += 10;

    autoTable(doc, {
      startY: currentY,
      head: [['Data', 'Medicamento', 'Funcionário', 'Setor', 'Qtd']],
      body: filteredDeliveries.map(d => [
        format(parseISO(d.delivery_date), "dd/MM/yyyy"),
        `${d.medications?.name} ${d.medications?.dosage || ''}`.trim(),
        d.employees?.name || '-',
        d.employees?.sector || '-',
        d.quantity
      ]),
      headStyles: { fillColor: [0, 0, 0] }
    });

    let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : currentY + 20;
    addStandardFooterToPDF(doc, settings, finalY);

    const pdfDataUri = doc.output('datauristring');
    setPdfPreviewUrl(pdfDataUri);
  };

  // Data for Charts
  const chartDataWeekly = (() => {
    const startW = startOfWeek(new Date(), { locale: ptBR });
    return deliveries.filter(d => parseISO(d.delivery_date) >= startW);
  })();

  const chartDataMonthly = (() => {
    const startM = startOfMonth(new Date());
    return deliveries.filter(d => parseISO(d.delivery_date) >= startM);
  })();

  const chartDataYearly = (() => {
    const startY = startOfYear(new Date());
    return deliveries.filter(d => parseISO(d.delivery_date) >= startY);
  })();

  const getUsageBySector = (dataset: Delivery[]) => {
    const count: Record<string, number> = {};
    dataset.forEach(d => {
      const sec = d.employees?.sector || "Não Informado";
      count[sec] = (count[sec] || 0) + d.quantity;
    });
    return Object.keys(count).map(k => ({ setor: k, entregas: count[k] })).sort((a,b) => b.entregas - a.entregas);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
          <Pill className="w-8 h-8 text-indigo-500" />
          Controle de Medicamentos
        </h1>
      </div>

      <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-full sm:w-fit">
        <button
          onClick={() => setActiveTab("estoque")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "estoque" ? "bg-white text-indigo-700 shadow" : "text-gray-600 hover:text-gray-900"}`}
        >
          Resumo do Estoque
        </button>
        <button
          onClick={() => setActiveTab("entregas")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "entregas" ? "bg-white text-indigo-700 shadow" : "text-gray-600 hover:text-gray-900"}`}
        >
          Entregas
        </button>
        <button
          onClick={() => setActiveTab("relatorios")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "relatorios" ? "bg-white text-indigo-700 shadow" : "text-gray-600 hover:text-gray-900"}`}
        >
          Relatórios
        </button>
      </div>

      {activeTab === "estoque" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
             <h2 className="text-lg font-bold text-gray-800">Medicamentos Cadastrados: {medications.length}</h2>
             {canEditPage && (
               <button onClick={() => setShowAddMedication(!showAddMedication)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
                 <Plus className="w-5 h-5" /> Cadastrar Medicamento
               </button>
             )}
          </div>
          
          {showAddMedication && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Pill className="w-5 h-5"/> Cadastro de Novo Medicamento</h3>
              <form onSubmit={handleAddMedication} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input required value={newMedication.name} onChange={e => setNewMedication({ ...newMedication, name: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Ex: Dipirona Cálcica" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dosagem/Formato</label>
                  <input value={newMedication.dosage} onChange={e => setNewMedication({ ...newMedication, dosage: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Ex: 500mg, Pomada..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade Estoque</label>
                  <input type="number" required min="0" value={newMedication.quantity} onChange={e => setNewMedication({ ...newMedication, quantity: parseInt(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="md:col-span-3">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Comercial</label>
                   <input value={newMedication.description} onChange={e => setNewMedication({ ...newMedication, description: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg" placeholder="Para dores e febre, etc." />
                </div>
                <div className="md:col-span-1 flex gap-2">
                  <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg w-full hover:bg-indigo-700 font-medium">Salvar</button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
             {medications.map(med => (
                <div key={med.id} className="bg-white rounded-xl shadow-sm border border-gray-200 relative p-6">
                  <div className="absolute top-4 right-4 bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-full">{med.quantity} em estoque</div>
                  {canEditPage && (
                    <button onClick={() => handleDeleteMedication(med.id)} className="absolute top-14 right-5 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  )}
                  <h3 className="text-xl font-bold text-gray-900 mt-2">{med.name}</h3>
                  <p className="text-sm font-medium text-indigo-600 mb-3">{med.dosage}</p>
                  <p className="text-sm text-gray-600 break-words">{med.description || "Sem descrição."}</p>
                </div>
             ))}
             {medications.length === 0 && (
                <div className="col-span-full p-8 text-center bg-white border border-gray-300 border-dashed rounded-xl text-gray-500">
                   Você ainda não cadastrou nenhum medicamento com disponibilidade.
                </div>
             )}
          </div>
        </div>
      )}

      {activeTab === "entregas" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
             <h2 className="text-lg font-bold text-gray-800">Termos de Entregas Realizadas: {deliveries.length}</h2>
             {canEditPage && (
               <button onClick={() => setShowAddDelivery(!showAddDelivery)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-medium">
                 <ClipboardList className="w-5 h-5" /> Registrar Entrega
               </button>
             )}
          </div>
          
          {showAddDelivery && (
            <div className="bg-indigo-50 p-6 rounded-xl shadow-sm border border-indigo-200">
              <h3 className="text-lg font-bold mb-4 text-indigo-900">Registrar Entrega de Medicamento</h3>
              <form onSubmit={handleAddDelivery} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário Recebedor</label>
                  <select required value={newDelivery.employee_id} onChange={e => setNewDelivery({ ...newDelivery, employee_id: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg">
                    <option value="">Selecione...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.sector})</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medicamento Fornecido</label>
                  <select required value={newDelivery.medication_id} onChange={e => setNewDelivery({ ...newDelivery, medication_id: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg">
                    <option value="">Selecione...</option>
                    {medications.map(m => <option key={m.id} value={m.id} disabled={m.quantity <= 0}>{m.name} ({m.quantity} no estoque)</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                  <input type="number" required min="1" value={newDelivery.quantity} onChange={e => setNewDelivery({ ...newDelivery, quantity: parseInt(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input type="date" required value={newDelivery.delivery_date} onChange={e => setNewDelivery({ ...newDelivery, delivery_date: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="md:col-span-1">
                  <button type="submit" className="bg-indigo-600 text-white px-4 py-2 flex items-center justify-center rounded-lg w-full hover:bg-indigo-700 font-medium">Salvar</button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-500 uppercase tracking-wider">
                         <th className="p-4">Data</th>
                         <th className="p-4">Funcionário</th>
                         <th className="p-4">Setor/Função</th>
                         <th className="p-4">Medicamento / Quantidade</th>
                         {canEditPage && <th className="p-4 text-center">Ações</th>}
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                      {deliveries.map(d => (
                         <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-sm font-medium text-gray-800">{format(parseISO(d.delivery_date), "dd/MM/yyyy")}</td>
                            <td className="p-4 text-sm font-bold text-gray-900">{d.employees?.name}</td>
                            <td className="p-4 text-xs text-gray-600 uppercase tracking-wide">
                                <span className="block font-bold">{d.employees?.sector}</span>
                                {d.employees?.role}
                            </td>
                            <td className="p-4 text-sm font-medium flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded w-fit inline-flex items-center gap-1"><CheckCircle className="w-3 h-3"/> {d.quantity} UN</span> do(a) {d.medications?.name} ({d.medications?.dosage})
                            </td>
                            {canEditPage && (
                              <td className="p-4 text-center">
                                 <button onClick={() => handleDeleteDelivery(d.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>
                              </td>
                            )}
                         </tr>
                      ))}
                      {deliveries.length === 0 && (
                         <tr><td colSpan={5} className="p-8 text-center text-gray-500">Nenhum registro de entrega de medicamentos.</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {activeTab === "relatorios" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">Consultas Consolidadas</h2>
              <div className="flex gap-2">
                <button onClick={() => generatePDFReport('mensal')} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition text-sm">
                  <Download className="w-4 h-4"/> A4 PDF Mensal
                </button>
                <button onClick={() => generatePDFReport('anual')} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 transition text-sm">
                  <Download className="w-4 h-4"/> A4 PDF Anual
                </button>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="flex items-center gap-2 font-bold mb-1"><Calendar className="w-4 h-4 text-indigo-500"/> Últimos 7 Dias</h3>
                <p className="text-3xl font-bold text-gray-900">{chartDataWeekly.length} entregas</p>
                <p className="text-sm text-gray-500">Volume parcial desta semana</p>
             </div>
             <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="flex items-center gap-2 font-bold mb-1"><Calendar className="w-4 h-4 text-indigo-500"/> Mensal (Mês Atual)</h3>
                <p className="text-3xl font-bold text-gray-900">{chartDataMonthly.length} entregas</p>
                <p className="text-sm text-gray-500">Retiradas globais neste mês</p>
             </div>
             <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="flex items-center gap-2 font-bold mb-1"><Calendar className="w-4 h-4 text-indigo-500"/> Anual (Ano Atual)</h3>
                <p className="text-3xl font-bold text-gray-900">{chartDataYearly.length} entregas</p>
                <p className="text-sm text-gray-500">Volume massivo computado no ano atual</p>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
                Destaque Setorial (Mês Atual)
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getUsageBySector(chartDataMonthly)} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="setor" tick={{ fill: '#6B7280', fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#EEF2FF' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="entregas" name="Total Entregue" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-600" />
                Gasto de Estoque Anual por Setor
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getUsageBySector(chartDataYearly)} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="setor" tick={{ fill: '#6B7280', fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="entregas" name="Retiradas Registradas Ano" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {pdfPreviewUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Pré-visualização do Relatório Oficial</h2>
              <button onClick={() => setPdfPreviewUrl(null)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-gray-100 p-4">
              <iframe src={pdfPreviewUrl} className="w-full h-full rounded border border-gray-300" title="PDF Preview" />
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setPdfPreviewUrl(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition font-medium">Cancelar</button>
              <a href={pdfPreviewUrl} download={`Relatorio_Medicamentos_${format(new Date(), "yyyy-MM-dd")}.pdf`} onClick={() => setPdfPreviewUrl(null)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition font-medium">
                <Download className="w-5 h-5" /> Baixar via Navegador
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
