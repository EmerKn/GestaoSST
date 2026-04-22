import { useState, useEffect, useRef } from "react";
import { AlertOctagon, Plus, Search, FileText, Calendar, Clock, MapPin, Activity, User, ChevronDown, ChevronUp, Download, Printer, Trash2, Settings } from "lucide-react";
import { format, parseISO, getYear, getMonth, isWithinInterval, subDays, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SectorBadge } from "../utils/sectorColors";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchSettings, addStandardHeaderToPDF, addStandardFooterToPDF, CompanySettings } from "../utils/pdfUtils";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { ImageUpload } from "../components/ImageUpload";
import { filterRealData } from "./Funcionarios";

interface Employee {
  id: number;
  name: string;
  sector: string;
  gender: string;
}

interface Occurrence {
  id: number;
  type: string;
  employee_id: number;
  employee_name: string;
  employee_gender: string;
  date: string;
  time: string;
  location: string;
  sector: string;
  description: string;
  injury: string;
  body_part: string;
  days_away: number;
  status: string;
  cat_file_url: string;
  root_cause: string;
  corrective_action: string;
}

const BODY_PARTS = [
  "Cabeça", "Olhos", "Pescoço", "Ombro", "Braço", "Cotovelo", "Antebraço", "Mão", "Dedo da mão",
  "Tórax", "Abdômen", "Costas", "Pelve", "Coxa", "Joelho", "Perna", "Tornozelo", "Pé", "Dedo do pé", "Múltiplas partes", "Outro"
];

export default function Ocorrencias() {
  const { canEdit, canPrint } = useAuth();
  const [activeTab, setActiveTab] = useState<"list" | "reports">("list");
  const [reportPeriod, setReportPeriod] = useState<"semana" | "mes" | "semestre" | "ano">("ano");
  const [reportSector, setReportSector] = useState<string>("Todos");
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [search, setSearch] = useState("");
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Occurrence>>({
    type: "Acidente",
    date: format(new Date(), "yyyy-MM-dd"),
    time: format(new Date(), "HH:mm"),
    status: "Registrado",
    days_away: 0
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftTimes, setShiftTimes] = useState({
    shift1: { start: "06:00", end: "14:00" },
    shift2: { start: "14:00", end: "22:00" },
    shift3: { start: "22:00", end: "06:00" }
  });

  useEffect(() => {
    const savedShifts = localStorage.getItem("shiftTimes");
    if (savedShifts) {
      try {
        setShiftTimes(JSON.parse(savedShifts));
      } catch (e) {
        console.error("Failed to parse shift times", e);
      }
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [occRes, empRes, settingsRes] = await Promise.all([
        supabase.from('occurrences').select('*, employees(name, gender)').order('date', { ascending: false }),
        supabase.from('employees').select('id, name, sector, gender'),
        fetchSettings()
      ]);

      if (occRes.data) {
        const realOccurrences = filterRealData(occRes.data);
        const formattedOccurrences = realOccurrences.map(occ => ({
          ...occ,
          employee_name: occ.employees?.name,
          employee_gender: occ.employees?.gender
        }));
        setOccurrences(formattedOccurrences);
      }
      if (empRes.data) setEmployees(filterRealData(empRes.data));
      setSettings(settingsRes);
    } catch (error) {
      console.error("Error loading occurrences data:", error);
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

  const handleFileChange = (file: File) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, cat_file_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('occurrences').insert([formData]);
      if (error) throw error;
      
      setShowAddModal(false);
      setFormData({ type: "Acidente", date: format(new Date(), "yyyy-MM-dd"), time: format(new Date(), "HH:mm"), status: "Registrado", days_away: 0 });
      loadData();
    } catch (error) {
      console.error("Error saving occurrence:", error);
      alert("Erro ao salvar ocorrência.");
    }
  };

  const handleUpdateStatus = async (id: number, updates: Partial<Occurrence>) => {
    try {
      const { error } = await supabase.from('occurrences').update(updates).eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error("Error updating occurrence:", error);
      alert("Erro ao atualizar ocorrência.");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta ocorrência?")) {
      try {
        const { error } = await supabase.from('occurrences').delete().eq('id', id);
        if (error) throw error;
        loadData();
      } catch (error) {
        console.error("Error deleting occurrence:", error);
        alert("Erro ao excluir ocorrência.");
      }
    }
  };

  const filtered = occurrences.filter(o => 
    o.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.description?.toLowerCase().includes(search.toLowerCase()) ||
    o.sector?.toLowerCase().includes(search.toLowerCase())
  );

  // Statistics
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  if (reportPeriod === "semana") {
    startDate = startOfWeek(now, { weekStartsOn: 0 });
    endDate = endOfWeek(now, { weekStartsOn: 0 });
  } else if (reportPeriod === "mes") {
    startDate = startOfMonth(now);
    endDate = endOfMonth(now);
  } else if (reportPeriod === "semestre") {
    startDate = subMonths(now, 6);
    endDate = now;
  } else {
    startDate = startOfYear(now);
    endDate = endOfYear(now);
  }

  const periodOccurrences = occurrences.filter(o => {
    const occDate = parseISO(o.date);
    const inPeriod = isWithinInterval(occDate, { start: startDate, end: endDate });
    const inSector = reportSector === "Todos" || o.sector === reportSector;
    return inPeriod && inSector;
  });
  
  const totalAccidents = periodOccurrences.filter(o => o.type === "Acidente").length;
  const totalIncidents = periodOccurrences.filter(o => o.type === "Incidente").length;
  
  const accidentsByMonth = Array(12).fill(0);
  const incidentsByMonth = Array(12).fill(0);
  
  periodOccurrences.forEach(o => {
    const month = getMonth(parseISO(o.date));
    if (o.type === "Acidente") accidentsByMonth[month]++;
    if (o.type === "Incidente") incidentsByMonth[month]++;
  });

  const occurrencesByShift: Record<string, { Acidente: number, Incidente: number }> = {
    [`Turno 1 (${shiftTimes.shift1.start} - ${shiftTimes.shift1.end})`]: { Acidente: 0, Incidente: 0 },
    [`Turno 2 (${shiftTimes.shift2.start} - ${shiftTimes.shift2.end})`]: { Acidente: 0, Incidente: 0 },
    [`Turno 3 (${shiftTimes.shift3.start} - ${shiftTimes.shift3.end})`]: { Acidente: 0, Incidente: 0 },
  };

  periodOccurrences.forEach(o => {
    if (!o.time) return;
    const occTime = o.time;
    let shift = "";
    
    const isBetween = (time: string, start: string, end: string) => {
      if (start <= end) {
        return time >= start && time < end;
      } else {
        // Crosses midnight
        return time >= start || time < end;
      }
    };

    if (isBetween(occTime, shiftTimes.shift1.start, shiftTimes.shift1.end)) {
      shift = `Turno 1 (${shiftTimes.shift1.start} - ${shiftTimes.shift1.end})`;
    } else if (isBetween(occTime, shiftTimes.shift2.start, shiftTimes.shift2.end)) {
      shift = `Turno 2 (${shiftTimes.shift2.start} - ${shiftTimes.shift2.end})`;
    } else {
      shift = `Turno 3 (${shiftTimes.shift3.start} - ${shiftTimes.shift3.end})`;
    }

    if (occurrencesByShift[shift]) {
      if (o.type === "Acidente") occurrencesByShift[shift].Acidente++;
      if (o.type === "Incidente") occurrencesByShift[shift].Incidente++;
    }
  });

  const injuriesCount: Record<string, number> = {};
  periodOccurrences.filter(o => o.type === "Acidente" && o.injury).forEach(o => {
    injuriesCount[o.injury] = (injuriesCount[o.injury] || 0) + 1;
  });
  const top5Injuries = Object.entries(injuriesCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const causesCount: Record<string, number> = {};
  periodOccurrences.filter(o => o.root_cause).forEach(o => {
    causesCount[o.root_cause] = (causesCount[o.root_cause] || 0) + 1;
  });
  const top5Causes = Object.entries(causesCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const accidentsBySector: Record<string, number> = {};
  periodOccurrences.filter(o => o.type === "Acidente").forEach(o => {
    accidentsBySector[o.sector] = (accidentsBySector[o.sector] || 0) + 1;
  });

  const accidentsByBodyPart: Record<string, number> = {};
  periodOccurrences.filter(o => o.type === "Acidente").forEach(o => {
    if (o.body_part) {
      accidentsByBodyPart[o.body_part] = (accidentsByBodyPart[o.body_part] || 0) + 1;
    }
  });

  const incidentsByBodyPart: Record<string, number> = {};
  periodOccurrences.filter(o => o.type === "Incidente").forEach(o => {
    if (o.body_part) {
      incidentsByBodyPart[o.body_part] = (incidentsByBodyPart[o.body_part] || 0) + 1;
    }
  });

  const menAccidents = periodOccurrences.filter(o => o.type === "Acidente" && o.employee_gender === "Masculino").length;
  const womenAccidents = periodOccurrences.filter(o => o.type === "Acidente" && o.employee_gender === "Feminino").length;

  const totalDaysAway = periodOccurrences.reduce((acc, o) => acc + (o.days_away || 0), 0);
  const totalWorkDaysYear = employees.length * 365;
  const daysAwayPercentage = totalWorkDaysYear > 0 ? ((totalDaysAway / totalWorkDaysYear) * 100).toFixed(2) : "0.00";

  const uniqueSectors = Array.from(new Set(employees.map(e => e.sector))).filter(Boolean);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    let currentY = addStandardHeaderToPDF(doc, settings, "Relatório de Acidentes e Incidentes");
    
    doc.setFontSize(12);
    doc.text(`Resumo do Período: ${reportPeriod.toUpperCase()} - Setor: ${reportSector}`, 14, currentY);
    currentY += 10;
    
    doc.setFontSize(10);
    doc.text(`Total de Acidentes: ${totalAccidents}`, 14, currentY);
    doc.text(`Total de Incidentes: ${totalIncidents}`, 14, currentY + 6);
    doc.text(`Dias de Afastamento: ${totalDaysAway} (${daysAwayPercentage}%)`, 14, currentY + 12);
    currentY += 20;

    autoTable(doc, {
      startY: currentY,
      head: [["Mês", "Acidentes", "Incidentes"]],
      body: Array.from({length: 12}, (_, i) => [
        format(new Date(2024, i, 1), "MMMM", { locale: ptBR }),
        accidentsByMonth[i],
        incidentsByMonth[i]
      ]),
      headStyles: { fillColor: [0, 0, 0] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
    
    autoTable(doc, {
      startY: currentY,
      head: [["Setor", "Total de Acidentes"]],
      body: Object.entries(accidentsBySector).sort((a, b) => b[1] - a[1]),
      headStyles: { fillColor: [0, 0, 0] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    autoTable(doc, {
      startY: currentY,
      head: [["Turno", "Acidentes", "Incidentes"]],
      body: Object.entries(occurrencesByShift).map(([shift, counts]) => [shift, counts.Acidente, counts.Incidente]),
      headStyles: { fillColor: [0, 0, 0] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    autoTable(doc, {
      startY: currentY,
      head: [["Top 5 Lesões (Acidentes)", "Total"]],
      body: top5Injuries,
      headStyles: { fillColor: [0, 0, 0] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    autoTable(doc, {
      startY: currentY,
      head: [["Top 5 Causas Raiz", "Total"]],
      body: top5Causes,
      headStyles: { fillColor: [0, 0, 0] }
    });

    addStandardFooterToPDF(doc, settings, (doc as any).lastAutoTable.finalY + 20);
    doc.save(`Relatorio_Ocorrencias_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: "Relatorio_Ocorrencias",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
          <AlertOctagon className="w-8 h-8 text-red-600" />
          Acidentes e Incidentes
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "list" ? "bg-white text-red-700 shadow" : "text-gray-600 hover:text-gray-900"}`}
          >
            Ocorrências
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "reports" ? "bg-white text-red-700 shadow" : "text-gray-600 hover:text-gray-900"}`}
          >
            Relatórios
          </button>
        </div>
      </div>

      {activeTab === "list" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Buscar ocorrência..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none placeholder:text-gray-400"
              />
            </div>
            {canEdit && (
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition">
                <Plus className="w-5 h-5" /> Nova Ocorrência
              </button>
            )}
          </div>

          <div className="space-y-4">
            {filtered.map(occ => (
              <div key={occ.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpandedId(expandedId === occ.id ? null : occ.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${occ.type === 'Acidente' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                      <AlertOctagon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${occ.type === 'Acidente' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                          {occ.type}
                        </span>
                        <span className="text-sm text-gray-500">{occ.date ? (() => { try { return format(parseISO(occ.date), "dd/MM/yyyy"); } catch { return occ.date; } })() : "Sem data"} às {occ.time || "--:--"}</span>
                      </div>
                      <h3 className="font-bold text-gray-900">{occ.employee_name}</h3>
                      <p className="text-sm text-gray-600"><SectorBadge sector={occ.sector} /> • {occ.location}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      occ.status === 'Registrado' ? 'bg-gray-100 text-gray-800' :
                      occ.status === 'Em investigação' ? 'bg-yellow-100 text-yellow-800' :
                      occ.status === 'Concluído' ? 'bg-green-100 text-green-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {occ.status}
                    </span>
                    {expandedId === occ.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>

                {expandedId === occ.id && (
                  <div className="p-6 border-t border-gray-200 bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Descrição do Ocorrido</h4>
                        <p className="text-sm text-gray-900 bg-white p-3 rounded border border-gray-200">{occ.description}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Lesão</h4>
                          <p className="text-sm text-gray-900">{occ.injury || "Nenhuma"}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Parte do Corpo</h4>
                          <p className="text-sm text-gray-900">{occ.body_part || "N/A"}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Dias Afastado</h4>
                          <p className="text-sm font-bold text-red-600">{occ.days_away} dias</p>
                        </div>
                        {occ.cat_file_url && (
                          <div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">CAT</h4>
                            <a href={occ.cat_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline">
                              <FileText className="w-4 h-4" /> Ver Documento
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status da Investigação</h4>
                        <select 
                          value={occ.status}
                          onChange={(e) => handleUpdateStatus(occ.id, { status: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white placeholder:text-gray-400"
                        >
                          <option value="Registrado">Registrado</option>
                          <option value="Em investigação">Em investigação</option>
                          <option value="Concluído">Concluído</option>
                          <option value="Arquivado">Arquivado</option>
                        </select>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Causa Raiz</h4>
                        <textarea 
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white placeholder:text-gray-400" 
                          rows={2}
                          defaultValue={occ.root_cause}
                          onBlur={(e) => handleUpdateStatus(occ.id, { root_cause: e.target.value })}
                          placeholder="Descreva a causa raiz identificada..."
                        />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Ação Corretiva</h4>
                        <textarea 
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white placeholder:text-gray-400" 
                          rows={2}
                          defaultValue={occ.corrective_action}
                          onBlur={(e) => handleUpdateStatus(occ.id, { corrective_action: e.target.value })}
                          placeholder="Ações para evitar reincidência..."
                        />
                      </div>
                      <div className="flex justify-end pt-2">
                        <button onClick={() => handleDelete(occ.id)} className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800">
                          <Trash2 className="w-4 h-4" /> Excluir Registro
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                Nenhuma ocorrência encontrada.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-lg font-bold text-gray-800">Relatórios e Estatísticas</h2>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value as any)}
                className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="semana">Esta Semana</option>
                <option value="mes">Este Mês</option>
                <option value="semestre">Últimos 6 Meses</option>
                <option value="ano">Este Ano</option>
              </select>
              <select
                value={reportSector}
                onChange={(e) => setReportSector(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="Todos">Todos os Setores</option>
                {uniqueSectors.map(sector => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
              <button onClick={() => setShowShiftModal(true)} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                <Settings className="w-4 h-4" /> Turnos
              </button>
              <button onClick={() => handlePrint()} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                <Printer className="w-4 h-4" /> Imprimir
              </button>
              <button onClick={handleExportPDF} className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition text-sm font-medium">
                <Download className="w-4 h-4" /> Gerar PDF
              </button>
            </div>
          </div>

          <div ref={reportRef} className="space-y-6 print:p-8 print:bg-white">
            {/* Print Header */}
            <div className="hidden print:block mb-8 border-b-2 border-gray-800 pb-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  {settings?.company_logo && (
                    <img src={settings.company_logo} alt="Logo" className="h-16 object-contain" />
                  )}
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{settings?.company_name || "SST Gestão"}</h1>
                    <p className="text-sm text-gray-600">{settings?.company_address}</p>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p className="font-bold text-gray-800">Relatório de Ocorrências</p>
                  <p>Emissão: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <p className="text-sm text-gray-500 font-medium">Total Acidentes</p>
                <p className="text-3xl font-bold text-red-600">{totalAccidents}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <p className="text-sm text-gray-500 font-medium">Total Incidentes</p>
                <p className="text-3xl font-bold text-orange-500">{totalIncidents}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <p className="text-sm text-gray-500 font-medium">Dias Afastados</p>
                <p className="text-3xl font-bold text-gray-900">{totalDaysAway}</p>
                <p className="text-xs text-gray-500">{daysAwayPercentage}% do tempo total</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <p className="text-sm text-gray-500 font-medium">Por Gênero (Acidentes)</p>
                <div className="flex justify-between mt-2">
                  <div><span className="text-xs text-gray-500">Homens</span><p className="font-bold">{menAccidents}</p></div>
                  <div><span className="text-xs text-gray-500">Mulheres</span><p className="font-bold">{womenAccidents}</p></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Ocorrências por Turno</h3>
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                      <th className="p-2 font-medium">Turno</th>
                      <th className="p-2 font-medium text-center">Acidentes</th>
                      <th className="p-2 font-medium text-center">Incidentes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(occurrencesByShift).map(([shift, counts]) => (
                      <tr key={shift}>
                        <td className="p-2 font-medium text-gray-700">{shift}</td>
                        <td className="p-2 text-center font-bold text-red-600">{counts.Acidente}</td>
                        <td className="p-2 text-center font-bold text-orange-500">{counts.Incidente}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Top 5 - Lesões e Causas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-bold text-red-700 mb-2 border-b pb-1">Top 5 Lesões (Acidentes)</h4>
                    <ul className="space-y-2">
                      {top5Injuries.map(([injury, count], idx) => (
                        <li key={idx} className="flex justify-between items-center text-sm">
                          <span className="text-gray-700 truncate pr-2">{injury}</span>
                          <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-xs">{count}</span>
                        </li>
                      ))}
                      {top5Injuries.length === 0 && <li className="text-sm text-gray-500">Nenhum dado.</li>}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-orange-700 mb-2 border-b pb-1">Top 5 Causas Raiz</h4>
                    <ul className="space-y-2">
                      {top5Causes.map(([cause, count], idx) => (
                        <li key={idx} className="flex justify-between items-center text-sm">
                          <span className="text-gray-700 truncate pr-2" title={cause}>{cause}</span>
                          <span className="bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-xs">{count}</span>
                        </li>
                      ))}
                      {top5Causes.length === 0 && <li className="text-sm text-gray-500">Nenhum dado.</li>}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Ocorrências por Mês</h3>
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                      <th className="p-2 font-medium">Mês</th>
                      <th className="p-2 font-medium text-center">Acidentes</th>
                      <th className="p-2 font-medium text-center">Incidentes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Array.from({length: 12}).map((_, i) => (
                      <tr key={i}>
                        <td className="p-2 capitalize">{format(new Date(2024, i, 1), "MMMM", { locale: ptBR })}</td>
                        <td className="p-2 text-center font-medium text-red-600">{accidentsByMonth[i]}</td>
                        <td className="p-2 text-center font-medium text-orange-500">{incidentsByMonth[i]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Acidentes por Setor</h3>
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                        <th className="p-2 font-medium">Setor</th>
                        <th className="p-2 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {Object.entries(accidentsBySector).sort((a, b) => b[1] - a[1]).map(([sector, count]) => (
                        <tr key={sector}>
                          <td className="p-2"><SectorBadge sector={sector} /></td>
                          <td className="p-2 text-right font-bold">{count}</td>
                        </tr>
                      ))}
                      {Object.keys(accidentsBySector).length === 0 && (
                        <tr><td colSpan={2} className="p-4 text-center text-gray-500">Nenhum dado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Partes do Corpo Atingidas</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Acidentes */}
                    <div>
                      <h4 className="text-md font-semibold text-red-700 mb-4 text-center">Acidentes</h4>
                      <div className="flex flex-col md:flex-row gap-6 items-center">
                        <div className="relative w-48 h-96 flex-shrink-0 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                          {/* Detailed Human Body SVG with hands and feet */}
                          <svg viewBox="0 0 100 200" className="w-full h-full opacity-20" fill="currentColor">
                            {/* Head */}
                            <circle cx="50" cy="20" r="12" />
                            {/* Neck */}
                            <rect x="46" y="30" width="8" height="10" />
                            {/* Torso */}
                            <rect x="35" y="40" width="30" height="50" rx="5" />
                            {/* Left Arm */}
                            <rect x="20" y="42" width="10" height="35" rx="5" transform="rotate(15 25 42)" />
                            {/* Right Arm */}
                            <rect x="70" y="42" width="10" height="35" rx="5" transform="rotate(-15 75 42)" />
                            {/* Left Hand */}
                            <circle cx="15" cy="80" r="6" />
                            {/* Right Hand */}
                            <circle cx="85" cy="80" r="6" />
                            {/* Left Leg */}
                            <rect x="38" y="90" width="10" height="45" rx="5" />
                            {/* Right Leg */}
                            <rect x="52" y="90" width="10" height="45" rx="5" />
                            {/* Left Foot */}
                            <ellipse cx="43" cy="140" rx="7" ry="4" />
                            {/* Right Foot */}
                            <ellipse cx="57" cy="140" rx="7" ry="4" />
                          </svg>
                          {/* Overlays */}
                          {Object.entries(accidentsByBodyPart).map(([part, count]) => {
                            let top = "50%";
                            let left = "50%";
                            
                            // Head & Neck
                            if (["Cabeça", "Olhos", "Pescoço"].includes(part)) { top = "10%"; left = "50%"; }
                            // Arms & Hands (Left side for display)
                            else if (["Ombro", "Braço", "Cotovelo", "Antebraço"].includes(part)) { top = "30%"; left = "20%"; }
                            else if (["Mão", "Dedo da mão"].includes(part)) { top = "42%"; left = "15%"; }
                            // Torso
                            else if (["Tórax", "Abdômen", "Costas", "Pelve"].includes(part)) { top = "35%"; left = "50%"; }
                            // Legs & Feet (Right side for display)
                            else if (["Coxa", "Joelho", "Perna"].includes(part)) { top = "60%"; left = "60%"; }
                            else if (["Tornozelo", "Pé", "Dedo do pé"].includes(part)) { top = "72%"; left = "60%"; }
                            
                            return (
                              <div key={part} className="absolute transform -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10" style={{ top, left }}>
                                {count}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap gap-2 content-start">
                          {Object.entries(accidentsByBodyPart).sort((a, b) => b[1] - a[1]).map(([part, count]) => (
                            <div key={part} className="bg-red-50 border border-red-100 px-3 py-2 rounded-lg flex flex-col items-center min-w-[80px]">
                              <span className="text-xs text-red-800 font-medium text-center">{part}</span>
                              <span className="text-lg font-bold text-red-600">{count}</span>
                            </div>
                          ))}
                          {Object.keys(accidentsByBodyPart).length === 0 && (
                            <p className="text-sm text-gray-500 w-full text-center">Nenhum dado.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Incidentes */}
                    <div>
                      <h4 className="text-md font-semibold text-orange-600 mb-4 text-center">Incidentes</h4>
                      <div className="flex flex-col md:flex-row gap-6 items-center">
                        <div className="relative w-48 h-96 flex-shrink-0 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                          {/* Detailed Human Body SVG with hands and feet */}
                          <svg viewBox="0 0 100 200" className="w-full h-full opacity-20" fill="currentColor">
                            {/* Head */}
                            <circle cx="50" cy="20" r="12" />
                            {/* Neck */}
                            <rect x="46" y="30" width="8" height="10" />
                            {/* Torso */}
                            <rect x="35" y="40" width="30" height="50" rx="5" />
                            {/* Left Arm */}
                            <rect x="20" y="42" width="10" height="35" rx="5" transform="rotate(15 25 42)" />
                            {/* Right Arm */}
                            <rect x="70" y="42" width="10" height="35" rx="5" transform="rotate(-15 75 42)" />
                            {/* Left Hand */}
                            <circle cx="15" cy="80" r="6" />
                            {/* Right Hand */}
                            <circle cx="85" cy="80" r="6" />
                            {/* Left Leg */}
                            <rect x="38" y="90" width="10" height="45" rx="5" />
                            {/* Right Leg */}
                            <rect x="52" y="90" width="10" height="45" rx="5" />
                            {/* Left Foot */}
                            <ellipse cx="43" cy="140" rx="7" ry="4" />
                            {/* Right Foot */}
                            <ellipse cx="57" cy="140" rx="7" ry="4" />
                          </svg>
                          {/* Overlays */}
                          {Object.entries(incidentsByBodyPart).map(([part, count]) => {
                            let top = "50%";
                            let left = "50%";
                            
                            // Head & Neck
                            if (["Cabeça", "Olhos", "Pescoço"].includes(part)) { top = "10%"; left = "50%"; }
                            // Arms & Hands (Left side for display)
                            else if (["Ombro", "Braço", "Cotovelo", "Antebraço"].includes(part)) { top = "30%"; left = "20%"; }
                            else if (["Mão", "Dedo da mão"].includes(part)) { top = "42%"; left = "15%"; }
                            // Torso
                            else if (["Tórax", "Abdômen", "Costas", "Pelve"].includes(part)) { top = "35%"; left = "50%"; }
                            // Legs & Feet (Right side for display)
                            else if (["Coxa", "Joelho", "Perna"].includes(part)) { top = "60%"; left = "60%"; }
                            else if (["Tornozelo", "Pé", "Dedo do pé"].includes(part)) { top = "72%"; left = "60%"; }
                            
                            return (
                              <div key={part} className="absolute transform -translate-x-1/2 -translate-y-1/2 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10" style={{ top, left }}>
                                {count}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap gap-2 content-start">
                          {Object.entries(incidentsByBodyPart).sort((a, b) => b[1] - a[1]).map(([part, count]) => (
                            <div key={part} className="bg-orange-50 border border-orange-100 px-3 py-2 rounded-lg flex flex-col items-center min-w-[80px]">
                              <span className="text-xs text-orange-800 font-medium text-center">{part}</span>
                              <span className="text-lg font-bold text-orange-600">{count}</span>
                            </div>
                          ))}
                          {Object.keys(incidentsByBodyPart).length === 0 && (
                            <p className="text-sm text-gray-500 w-full text-center">Nenhum dado.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Nova Ocorrência</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select required name="type" value={formData.type} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                    <option value="Acidente">Acidente</option>
                    <option value="Incidente">Incidente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário</label>
                  <select required name="employee_id" value={formData.employee_id || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                    <option value="">Selecione...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.sector})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input required type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
                  <input required type="time" name="time" value={formData.time} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Local Exato</label>
                  <input required type="text" name="location" value={formData.location || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: Máquina 02, Escada principal..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
                  <input required type="text" name="sector" value={formData.sector || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50" readOnly />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Ocorrido</label>
                <textarea required name="description" value={formData.description || ""} onChange={handleInputChange} rows={3} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Descreva detalhadamente como ocorreu..."></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lesão</label>
                  <input type="text" name="injury" value={formData.injury || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: Corte, Fratura, Escoriação..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parte do Corpo</label>
                  <select name="body_part" value={formData.body_part || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                    <option value="">Selecione...</option>
                    {BODY_PARTS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dias de Afastamento</label>
                  <input type="number" min="0" name="days_away" value={formData.days_away} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select required name="status" value={formData.status} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                    <option value="Registrado">Registrado</option>
                    <option value="Em investigação">Em investigação</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Arquivado">Arquivado</option>
                  </select>
                </div>
                <div>
                  <ImageUpload
                    label="Anexar CAT (PDF/Imagem)"
                    name="cat_file_url"
                    currentImage={formData.cat_file_url}
                    onImageSelect={handleFileChange}
                    accept=".pdf,image/*"
                  />
                </div>
              </div>

              </div>

              <div className="p-6 flex justify-end gap-3 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-xl">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">Salvar Ocorrência</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-800">Configurar Turnos</h2>
              <button onClick={() => setShowShiftModal(false)} className="text-gray-500 hover:text-gray-700">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-gray-700 mb-2">Turno 1</h4>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Início</label>
                      <input type="time" value={shiftTimes.shift1.start} onChange={(e) => setShiftTimes({...shiftTimes, shift1: {...shiftTimes.shift1, start: e.target.value}})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Fim</label>
                      <input type="time" value={shiftTimes.shift1.end} onChange={(e) => setShiftTimes({...shiftTimes, shift1: {...shiftTimes.shift1, end: e.target.value}})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-bold text-gray-700 mb-2">Turno 2</h4>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Início</label>
                      <input type="time" value={shiftTimes.shift2.start} onChange={(e) => setShiftTimes({...shiftTimes, shift2: {...shiftTimes.shift2, start: e.target.value}})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Fim</label>
                      <input type="time" value={shiftTimes.shift2.end} onChange={(e) => setShiftTimes({...shiftTimes, shift2: {...shiftTimes.shift2, end: e.target.value}})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-gray-700 mb-2">Turno 3</h4>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Início</label>
                      <input type="time" value={shiftTimes.shift3.start} onChange={(e) => setShiftTimes({...shiftTimes, shift3: {...shiftTimes.shift3, start: e.target.value}})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Fim</label>
                      <input type="time" value={shiftTimes.shift3.end} onChange={(e) => setShiftTimes({...shiftTimes, shift3: {...shiftTimes.shift3, end: e.target.value}})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 flex justify-end gap-3 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-xl">
              <button type="button" onClick={() => setShowShiftModal(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition">Cancelar</button>
              <button type="button" onClick={() => {
                localStorage.setItem("shiftTimes", JSON.stringify(shiftTimes));
                setShowShiftModal(false);
                loadData(); // Reload to recalculate
              }} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
