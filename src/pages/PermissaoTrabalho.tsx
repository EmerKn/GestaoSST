import { useState, useEffect, useRef } from "react";
import { FileSignature, Plus, Search, FileText, Calendar, Clock, MapPin, Activity, User, ChevronDown, ChevronUp, Download, Printer, Trash2, Edit, AlertTriangle, ShieldCheck, CheckSquare, Camera, X } from "lucide-react";
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SectorBadge } from "../utils/sectorColors";
import { useReactToPrint } from "react-to-print";
import { fetchSettings, addStandardHeaderToPDF, addStandardFooterToPDF, CompanySettings } from "../utils/pdfUtils";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { filterRealData } from "./Funcionarios";
import { ImageUpload } from "../components/ImageUpload";

interface Employee {
  id: number;
  name: string;
  sector: string;
  role: string;
}

interface WorkPermit {
  id: number;
  permit_number: string;
  activity_type: string;
  employee_id: number;
  employee_name?: string;
  sector: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  description: string;
  hazards: string;
  precautions: string;
  photo_url: string;
  status: string;
  responsible_name: string;
  created_at?: string;
}

const ACTIVITY_TYPES = [
  "Trabalho em Altura (NR-35)",
  "Espaço Confinado (NR-33)",
  "Trabalho a Quente",
  "Eletricidade (NR-10)",
  "Escavação",
  "Içamento de Carga",
  "Trabalho com Produtos Químicos",
  "Outros"
];

const HAZARDS_LIST = [
  "Queda de nível diferente",
  "Choque elétrico",
  "Incêndio / Explosão",
  "Asfixia / Intoxicação",
  "Prensamento / Esmagamento",
  "Corte / Perfuração",
  "Ruído excessivo",
  "Projeção de partículas",
  "Soterramento"
];

const PRECAUTIONS_LIST = [
  "Isolamento e sinalização da área",
  "Uso de cinto de segurança tipo paraquedista",
  "Desenergização e bloqueio (LOTO)",
  "Medição de gases",
  "Ventilação exaustora",
  "Uso de EPIs específicos",
  "Extintor de incêndio no local",
  "Vigia presente",
  "Escoramento de vala"
];

export default function PermissaoTrabalho() {
  const { canEdit, canPrint, isMobile } = useAuth();
  const canEditPage = canEdit && !isMobile;

  const [activeTab, setActiveTab] = useState<"list" | "reports">("list");
  const [permits, setPermits] = useState<WorkPermit[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [search, setSearch] = useState("");
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPermit, setEditingPermit] = useState<WorkPermit | null>(null);
  
  const [formData, setFormData] = useState<Partial<WorkPermit>>({
    permit_number: `PT-${format(new Date(), "yyyyMMddHHmm")}`,
    activity_type: "Trabalho em Altura (NR-35)",
    date: format(new Date(), "yyyy-MM-dd"),
    start_time: format(new Date(), "HH:mm"),
    end_time: format(new Date(new Date().getTime() + 8 * 60 * 60 * 1000), "HH:mm"),
    status: "Ativa",
    hazards: "[]",
    precautions: "[]"
  });

  const [selectedHazards, setSelectedHazards] = useState<string[]>([]);
  const [selectedPrecautions, setSelectedPrecautions] = useState<string[]>([]);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [permitsRes, empRes, settingsRes] = await Promise.all([
        supabase.from('work_permits').select('*, employees(name, sector, role)').order('date', { ascending: false }),
        supabase.from('employees').select('id, name, sector, role'),
        fetchSettings()
      ]);

      if (permitsRes.data) {
        const realPermits = filterRealData(permitsRes.data);
        const formattedPermits = realPermits.map(permit => ({
          ...permit,
          employee_name: permit.employees?.name
        }));
        setPermits(formattedPermits);
      }
      if (empRes.data) setEmployees(filterRealData(empRes.data));
      setSettings(settingsRes);
    } catch (error) {
      console.error("Error loading work permits data:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "employee_id") {
      const emp = employees.find(emp => emp.id === parseInt(value));
      setFormData({ ...formData, employee_id: parseInt(value), sector: emp?.sector || "" });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleHazardToggle = (hazard: string) => {
    setSelectedHazards(prev => 
      prev.includes(hazard) ? prev.filter(h => h !== hazard) : [...prev, hazard]
    );
  };

  const handlePrecautionToggle = (precaution: string) => {
    setSelectedPrecautions(prev => 
      prev.includes(precaution) ? prev.filter(p => p !== precaution) : [...prev, precaution]
    );
  };

  const handleFileChange = (file: File) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photo_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const openNewModal = () => {
    setEditingPermit(null);
    setFormData({
      permit_number: `PT-${format(new Date(), "yyyyMMddHHmm")}`,
      activity_type: "Trabalho em Altura (NR-35)",
      date: format(new Date(), "yyyy-MM-dd"),
      start_time: format(new Date(), "HH:mm"),
      end_time: format(new Date(new Date().getTime() + 8 * 60 * 60 * 1000), "HH:mm"),
      status: "Ativa",
      location: "",
      description: "",
      responsible_name: "",
      photo_url: ""
    });
    setSelectedHazards([]);
    setSelectedPrecautions([]);
    setShowAddModal(true);
  };

  const openEditModal = (permit: WorkPermit) => {
    if (permit.status === "Impressa") {
      alert("Esta permissão já foi impressa e não pode ser editada.");
      return;
    }
    setEditingPermit(permit);
    setFormData({
      ...permit
    });
    try {
      setSelectedHazards(JSON.parse(permit.hazards || "[]"));
      setSelectedPrecautions(JSON.parse(permit.precautions || "[]"));
    } catch (e) {
      setSelectedHazards([]);
      setSelectedPrecautions([]);
    }
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        hazards: JSON.stringify(selectedHazards),
        precautions: JSON.stringify(selectedPrecautions)
      };

      if (editingPermit) {
        const { error } = await supabase
          .from('work_permits')
          .update(payload)
          .eq('id', editingPermit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('work_permits')
          .insert([payload]);
        if (error) throw error;
      }
      
      setShowAddModal(false);
      loadData();
    } catch (error) {
      console.error("Error saving work permit:", error);
      alert("Erro ao salvar permissão de trabalho.");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Deseja realmente excluir esta permissão?")) {
      try {
        const { error } = await supabase
          .from('work_permits')
          .delete()
          .eq('id', id);

        if (error) throw error;
        loadData();
      } catch (error) {
        console.error("Error deleting work permit:", error);
        alert("Erro ao excluir permissão.");
      }
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `Permissao_Trabalho_${expandedId}`,
    onAfterPrint: async () => {
      // Update status to Impressa after printing
      if (expandedId) {
        try {
          await supabase
            .from('work_permits')
            .update({ status: 'Impressa' })
            .eq('id', expandedId);
          loadData();
        } catch (error) {
          console.error("Error updating status:", error);
        }
      }
    }
  });

  const filteredPermits = permits.filter(p => 
    p.permit_number.toLowerCase().includes(search.toLowerCase()) ||
    p.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.activity_type.toLowerCase().includes(search.toLowerCase())
  );

  // Report Calculations
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const semesterStart = subMonths(now, 6);
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  const permitsThisWeek = permits.filter(p => isWithinInterval(parseISO(p.date), { start: weekStart, end: weekEnd })).length;
  const permitsThisMonth = permits.filter(p => isWithinInterval(parseISO(p.date), { start: monthStart, end: monthEnd })).length;
  const permitsThisSemester = permits.filter(p => isWithinInterval(parseISO(p.date), { start: semesterStart, end: now })).length;
  const permitsThisYear = permits.filter(p => isWithinInterval(parseISO(p.date), { start: yearStart, end: yearEnd })).length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ativa": return "bg-green-100 text-green-800 border-green-200";
      case "Fechada": return "bg-gray-100 text-gray-800 border-gray-200";
      case "Impressa": return "bg-emerald-100 text-blue-800 border-blue-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
          <FileSignature className="w-8 h-8 text-emerald-600" />
          Permissão de Trabalho (PT)
        </h1>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "list" ? "bg-emerald-100 text-emerald-700" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Lista de PTs
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              activeTab === "reports" ? "bg-emerald-100 text-emerald-700" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Relatórios
          </button>
        </div>
      </div>

      {activeTab === "list" && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Buscar por número, funcionário ou atividade..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none placeholder:text-gray-400"
              />
            </div>
            {canEditPage && (
              <button 
                onClick={openNewModal}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium"
              >
                <Plus className="w-5 h-5" />
                <span>Criar PT</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredPermits.map(permit => (
              <div key={permit.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div 
                  className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpandedId(expandedId === permit.id ? null : permit.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg hidden sm:block">
                      <FileSignature className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">{permit.permit_number}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getStatusColor(permit.status)}`}>
                          {permit.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 font-medium">{permit.activity_type}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><User className="w-4 h-4" /> {permit.employee_name}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {format(parseISO(permit.date), "dd/MM/yyyy")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 sm:mt-0 flex items-center gap-2">
                    {expandedId === permit.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {expandedId === permit.id && (
                  <div className="p-4 border-t border-gray-100 bg-gray-50">
                    <div className="flex justify-end gap-2 mb-4">
                      {canEditPage && permit.status !== "Impressa" && (
                        <button 
                          onClick={() => openEditModal(permit)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
                        >
                          <Edit className="w-4 h-4" /> Editar
                        </button>
                      )}
                      {canPrint && (
                        <button 
                          onClick={() => handlePrint()}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium"
                        >
                          <Printer className="w-4 h-4" /> Imprimir PDF
                        </button>
                      )}
                      {canEditPage && (
                        <button 
                          onClick={() => handleDelete(permit.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition text-sm font-medium"
                        >
                          <Trash2 className="w-4 h-4" /> Excluir
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Detalhes da Atividade</h4>
                          <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-2 text-sm">
                            <p><span className="font-medium text-gray-700">Local:</span> {permit.location}</p>
                            <p><span className="font-medium text-gray-700">Setor:</span> <SectorBadge sector={permit.sector} /></p>
                            <p><span className="font-medium text-gray-700">Horário:</span> {permit.start_time} às {permit.end_time}</p>
                            <p><span className="font-medium text-gray-700">Responsável:</span> {permit.responsible_name}</p>
                            <div className="pt-2 mt-2 border-t border-gray-100">
                              <span className="font-medium text-gray-700 block mb-1">Descrição:</span>
                              <p className="text-gray-600">{permit.description}</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Riscos Identificados</h4>
                          <div className="bg-white p-3 rounded-lg border border-gray-200">
                            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                              {(() => {
                                try {
                                  const hazards = JSON.parse(permit.hazards || "[]");
                                  return hazards.length > 0 
                                    ? hazards.map((h: string, i: number) => <li key={i}>{h}</li>)
                                    : <li>Nenhum risco selecionado</li>;
                                } catch (e) {
                                  return <li>Erro ao carregar riscos</li>;
                                }
                              })()}
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Medidas Preventivas</h4>
                          <div className="bg-white p-3 rounded-lg border border-gray-200">
                            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                              {(() => {
                                try {
                                  const precautions = JSON.parse(permit.precautions || "[]");
                                  return precautions.length > 0 
                                    ? precautions.map((p: string, i: number) => <li key={i}>{p}</li>)
                                    : <li>Nenhuma medida selecionada</li>;
                                } catch (e) {
                                  return <li>Erro ao carregar medidas</li>;
                                }
                              })()}
                            </ul>
                          </div>
                        </div>

                        {permit.photo_url && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Foto do Local</h4>
                            <img src={permit.photo_url} alt="Local" className="w-full h-48 object-cover rounded-lg border border-gray-200" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Hidden Print Template */}
                    <div className="hidden">
                      <div ref={reportRef} className="p-8 bg-white text-black w-[210mm] min-h-[297mm] mx-auto box-border">
                        {/* Header */}
                        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
                          {settings?.company_logo ? (
                            <img src={settings.company_logo} alt="Logo" className="h-16 object-contain" />
                          ) : (
                            <div className="h-16 w-32 bg-gray-200 flex items-center justify-center text-gray-500 font-bold">LOGO</div>
                          )}
                          <div className="text-center flex-1 px-4">
                            <h1 className="text-xl font-bold uppercase tracking-wider">{settings?.company_name || "NOME DA EMPRESA"}</h1>
                            <h2 className="text-lg font-bold mt-1">PERMISSÃO DE TRABALHO (PT)</h2>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-red-600">{permit.permit_number}</p>
                            <p className="text-sm mt-1">Data: {format(parseISO(permit.date), "dd/MM/yyyy")}</p>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="space-y-4 text-sm">
                          <div className="grid grid-cols-2 gap-4 border border-black p-2">
                            <div><strong>Atividade:</strong> {permit.activity_type}</div>
                            <div><strong>Status:</strong> {permit.status}</div>
                            <div><strong>Funcionário:</strong> {permit.employee_name}</div>
                            <div><strong>Setor:</strong> {permit.sector}</div>
                            <div><strong>Horário:</strong> {permit.start_time} às {permit.end_time}</div>
                            <div><strong>Local:</strong> {permit.location}</div>
                          </div>

                          <div className="border border-black p-2">
                            <strong>Descrição do Trabalho:</strong>
                            <p className="mt-1">{permit.description}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="border border-black p-2">
                              <strong>Riscos Identificados:</strong>
                              <ul className="list-disc pl-5 mt-1">
                                {(() => {
                                  try {
                                    const hazards = JSON.parse(permit.hazards || "[]");
                                    return hazards.map((h: string, i: number) => <li key={i}>{h}</li>);
                                  } catch (e) { return null; }
                                })()}
                              </ul>
                            </div>
                            <div className="border border-black p-2">
                              <strong>Medidas Preventivas:</strong>
                              <ul className="list-disc pl-5 mt-1">
                                {(() => {
                                  try {
                                    const precautions = JSON.parse(permit.precautions || "[]");
                                    return precautions.map((p: string, i: number) => <li key={i}>{p}</li>);
                                  } catch (e) { return null; }
                                })()}
                              </ul>
                            </div>
                          </div>

                          {permit.photo_url && (
                            <div className="border border-black p-2 text-center">
                              <strong>Foto do Local/Atividade:</strong>
                              <div className="mt-2 flex justify-center">
                                <img src={permit.photo_url} alt="Local" className="max-h-64 object-contain" />
                              </div>
                            </div>
                          )}

                          <div className="border border-black p-2 mt-8">
                            <p className="text-xs text-justify mb-8">
                              Declaro que inspecionei o local de trabalho e verifiquei que as medidas preventivas foram adotadas. 
                              O executante foi instruído sobre os riscos e procedimentos de segurança. 
                              A permissão é válida apenas para o horário e data especificados.
                            </p>
                            
                            <div className="grid grid-cols-2 gap-8 text-center mt-12">
                              <div>
                                <div className="border-t border-black pt-2">
                                  <p className="font-bold">{permit.employee_name}</p>
                                  <p className="text-xs">Funcionário Executante</p>
                                </div>
                              </div>
                              <div>
                                <div className="border-t border-black pt-2">
                                  <p className="font-bold">{permit.responsible_name}</p>
                                  <p className="text-xs">Responsável pela Liberação</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-8 pt-4 border-t border-gray-300 text-xs text-center text-gray-500">
                          <p>{settings?.company_name} - {settings?.company_address}</p>
                          <p>Documento gerado pelo sistema SST Gestão em {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ))}
            
            {filteredPermits.length === 0 && (
              <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                Nenhuma permissão de trabalho encontrada.
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Nesta Semana</p>
                <p className="text-2xl font-bold text-gray-900">{permitsThisWeek}</p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Neste Mês</p>
                <p className="text-2xl font-bold text-gray-900">{permitsThisMonth}</p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Últimos 6 Meses</p>
                <p className="text-2xl font-bold text-gray-900">{permitsThisSemester}</p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                <FileSignature className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Neste Ano</p>
                <p className="text-2xl font-bold text-gray-900">{permitsThisYear}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Distribuição por Tipo de Atividade (Ano)</h3>
            <div className="space-y-4">
              {ACTIVITY_TYPES.map(type => {
                const count = permits.filter(p => p.activity_type === type && isWithinInterval(parseISO(p.date), { start: yearStart, end: yearEnd })).length;
                if (count === 0) return null;
                const percentage = permitsThisYear > 0 ? Math.round((count / permitsThisYear) * 100) : 0;
                
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{type}</span>
                      <span className="text-gray-500">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {permitsThisYear === 0 && (
                <p className="text-center text-gray-500 py-4">Nenhuma permissão registrada neste ano.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto pt-20 pb-20">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 my-8">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <FileSignature className="w-6 h-6 text-emerald-600" />
                {editingPermit ? "Editar Permissão de Trabalho" : "Nova Permissão de Trabalho"}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número da PT</label>
                  <input 
                    type="text" 
                    name="permit_number"
                    required
                    value={formData.permit_number}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 font-mono"
                    readOnly={!!editingPermit}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Atividade</label>
                  <select 
                    name="activity_type"
                    required
                    value={formData.activity_type}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                  >
                    {ACTIVITY_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário Executante</label>
                  <select 
                    name="employee_id"
                    required
                    value={formData.employee_id || ""}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                  >
                    <option value="">Selecione um funcionário</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} - {emp.sector}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsável pela Liberação</label>
                  <input 
                    type="text" 
                    name="responsible_name"
                    required
                    value={formData.responsible_name}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                    placeholder="Nome do supervisor/técnico"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input 
                    type="date" 
                    name="date"
                    required
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horário Início</label>
                  <input 
                    type="time" 
                    name="start_time"
                    required
                    value={formData.start_time}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horário Fim</label>
                  <input 
                    type="time" 
                    name="end_time"
                    required
                    value={formData.end_time}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Local Exato</label>
                  <input 
                    type="text" 
                    name="location"
                    required
                    value={formData.location}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                    placeholder="Ex: Telhado do galpão 2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select 
                    name="status"
                    required
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                  >
                    <option value="Ativa">Ativa</option>
                    <option value="Fechada">Fechada</option>
                    <option value="Impressa" disabled>Impressa</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Trabalho</label>
                <textarea 
                  name="description"
                  required
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                  rows={3}
                  placeholder="Descreva detalhadamente a atividade a ser realizada..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                  <h4 className="font-medium text-red-800 flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5" /> Riscos Identificados
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {HAZARDS_LIST.map(hazard => (
                      <label key={hazard} className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedHazards.includes(hazard)}
                          onChange={() => handleHazardToggle(hazard)}
                          className="rounded text-red-600 focus:ring-red-500"
                        />
                        <span className="text-sm text-gray-700">{hazard}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <h4 className="font-medium text-green-800 flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-5 h-5" /> Medidas Preventivas
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {PRECAUTIONS_LIST.map(precaution => (
                      <label key={precaution} className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedPrecautions.includes(precaution)}
                          onChange={() => handlePrecautionToggle(precaution)}
                          className="rounded text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">{precaution}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <ImageUpload
                  label="Foto do Local / Atividade (Opcional)"
                  name="photo_url"
                  currentImage={formData.photo_url}
                  onImageSelect={handleFileChange}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-medium transition"
                >
                  Salvar PT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
