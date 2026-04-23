import { useState, useEffect, useRef } from "react";
import { Users, Plus, FileText, Calendar, CheckCircle, Clock, AlertCircle, Upload, Printer, Download, Trash2, BarChart2, X } from "lucide-react";
import { format, parseISO, addBusinessDays, isAfter, isValid } from "date-fns";
import SignatureCanvas from "react-signature-canvas";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchSettings, addStandardHeaderToPDF, addStandardFooterToPDF, CompanySettings } from "../utils/pdfUtils";
import { SectorBadge } from "../utils/sectorColors";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { filterRealData } from "./Funcionarios";
import { ImageUpload } from "../components/ImageUpload";

const CIPA_LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/CIPA_logo.svg/512px-CIPA_logo.svg.png";

interface Employee {
  id: number;
  name: string;
  role: string;
  sector: string;
  photo_url: string;
}

interface CipaMember {
  id: number;
  employee_id: number;
  cipa_role: string;
  name: string;
  role: string;
  sector: string;
  photo_url: string;
}

interface MeetingTopic {
  id?: number;
  title: string;
  description: string;
  status: string;
  deadline: string;
  meeting_date?: string;
}

interface MeetingParticipant {
  employee_id: number;
  name: string;
  role: string;
  cipa_role?: string;
  signature?: string;
}

interface Meeting {
  id: number;
  date: string;
  type: string;
  file_url: string;
  participants: MeetingParticipant[];
  topics: MeetingTopic[];
}

const safeFormatDate = (dateString?: string, formatString: string = "dd/MM/yyyy") => {
  if (!dateString) return "-";
  const dateObj = parseISO(dateString);
  return isValid(dateObj) ? format(dateObj, formatString) : "Data Inválida";
};

const safeIsDelayed = (dateString?: string) => {
  if (!dateString) return false;
  const dateObj = parseISO(dateString);
  return isValid(dateObj) ? isAfter(new Date(), addBusinessDays(dateObj, 4)) : false;
};

export default function Cipa() {
  const { canEdit, isMobile } = useAuth();
  const canEditPage = canEdit;

  const [activeTab, setActiveTab] = useState<"members" | "meetings" | "topics" | "reports">("members");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [members, setMembers] = useState<CipaMember[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [allTopics, setAllTopics] = useState<MeetingTopic[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  // PDF Preview State
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState<string>("");

  // New Member State
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMember, setNewMember] = useState({ employee_id: "", cipa_role: "Membro Titular" });

  // New Meeting State
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [newMeeting, setNewMeeting] = useState({ date: format(new Date(), "yyyy-MM-dd"), type: "Ordinária", file_url: "" });
  const [meetingParticipants, setMeetingParticipants] = useState<MeetingParticipant[]>([]);
  const [meetingTopics, setMeetingTopics] = useState<MeetingTopic[]>([]);
  const [currentTopic, setCurrentTopic] = useState({ title: "", description: "", status: "Pendente", deadline: "" });
  const [selectedParticipant, setSelectedParticipant] = useState("");
  
  // Signature ref for current participant
  const sigRef = useRef<SignatureCanvas>(null);
  const [signingParticipant, setSigningParticipant] = useState<number | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [empRes, memRes, meetRes, topRes, setRes] = await Promise.all([
        supabase.from('employees').select('*'),
        supabase.from('cipa_members').select(`
          id, employee_id, cipa_role,
          employees (name, role, sector, photo_url)
        `),
        supabase.from('cipa_meetings').select('*').order('date', { ascending: false }),
        supabase.from('cipa_meeting_topics').select(`
          *,
          cipa_meetings (date)
        `).order('id', { ascending: false }),
        fetchSettings()
      ]);

      if (empRes.data) setEmployees(filterRealData(empRes.data));
      
      if (memRes.data) {
        const realMembers = filterRealData(memRes.data);
        const formattedMembers = realMembers.map((m: any) => ({
          id: m.id,
          employee_id: m.employee_id,
          cipa_role: m.cipa_role,
          name: m.employees?.name,
          role: m.employees?.role,
          sector: m.employees?.sector,
          photo_url: m.employees?.photo_url
        }));
        setMembers(formattedMembers);
      }

      if (meetRes.data) {
        const realMeetings = filterRealData(meetRes.data);
        const formattedMeetings = realMeetings.map((m: any) => ({
          ...m,
          participants: typeof m.participants === 'string' ? JSON.parse(m.participants) : (m.participants || []),
          topics: typeof m.topics === 'string' ? JSON.parse(m.topics) : (m.topics || [])
        }));
        setMeetings(formattedMeetings);
      }

      if (topRes.data) {
        const realTopics = filterRealData(topRes.data);
        const formattedTopics = realTopics.map((t: any) => ({
          ...t,
          meeting_date: t.cipa_meetings?.date
        }));
        setAllTopics(formattedTopics);
      }

      setSettings(setRes);
    } catch (error) {
      console.error("Error loading CIPA data:", error);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.employee_id) return;

    await supabase.from('cipa_members').insert([{
      employee_id: parseInt(newMember.employee_id),
      cipa_role: newMember.cipa_role
    }]);
    
    setShowAddMember(false);
    setNewMember({ employee_id: "", cipa_role: "Membro Titular" });
    loadData();
  };

  const handleRemoveMember = async (id: number) => {
    if (confirm("Deseja remover este membro da CIPA?")) {
      await supabase.from('cipa_members').delete().eq('id', id);
      loadData();
    }
  };

  const handleAddParticipant = () => {
    if (!selectedParticipant) return;
    const emp = employees.find(e => e.id === parseInt(selectedParticipant));
    if (!emp) return;
    
    // Check if already in list
    if (meetingParticipants.some(p => p.employee_id === emp.id)) return;

    const cipaMember = members.find(m => m.employee_id === emp.id);

    setMeetingParticipants([...meetingParticipants, {
      employee_id: emp.id,
      name: emp.name,
      role: emp.role,
      cipa_role: cipaMember?.cipa_role || "Convidado"
    }]);
    setSelectedParticipant("");
  };

  const saveSignature = () => {
    if (signingParticipant !== null && sigRef.current && !sigRef.current.isEmpty()) {
      const signature = sigRef.current.getTrimmedCanvas().toDataURL('image/png');
      setMeetingParticipants(meetingParticipants.map(p => 
        p.employee_id === signingParticipant ? { ...p, signature } : p
      ));
      setSigningParticipant(null);
    }
  };

  const handleAddTopic = () => {
    if (!currentTopic.title) return;
    setMeetingTopics([...meetingTopics, currentTopic]);
    setCurrentTopic({ title: "", description: "", status: "Pendente", deadline: "" });
  };

  const handleFileUpload = (file: File) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewMeeting({ ...newMeeting, file_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveMeeting = async () => {
    if (!newMeeting.date || meetingParticipants.length === 0) {
      alert("Preencha a data e adicione pelo menos um participante.");
      return;
    }

    const { data: meetingData, error: meetingError } = await supabase.from('cipa_meetings').insert([{
      date: newMeeting.date,
      type: newMeeting.type,
      file_url: newMeeting.file_url,
      participants: JSON.stringify(meetingParticipants),
      topics: JSON.stringify(meetingTopics)
    }]).select();

    if (meetingError) {
      console.error("Error saving meeting:", meetingError);
      alert("Erro ao salvar reunião.");
      return;
    }

    if (meetingData && meetingData.length > 0 && meetingTopics.length > 0) {
      const meetingId = meetingData[0].id;
      const topicsToInsert = meetingTopics.map(t => ({
        meeting_id: meetingId,
        title: t.title,
        description: t.description,
        status: t.status,
        deadline: t.deadline
      }));
      
      await supabase.from('cipa_meeting_topics').insert(topicsToInsert);
    }

    setShowAddMeeting(false);
    setNewMeeting({ date: format(new Date(), "yyyy-MM-dd"), type: "Ordinária", file_url: "" });
    setMeetingParticipants([]);
    setMeetingTopics([]);
    loadData();
  };

  const updateTopicStatus = async (id: number, status: string) => {
    await supabase.from('cipa_meeting_topics').update({ status }).eq('id', id);
    loadData();
  };

  const handlePrintTopics = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `Relatorio_Topicos_CIPA_${format(new Date(), "yyyy-MM-dd")}`,
  });

  const handleExportMembersPDF = () => {
    const doc = new jsPDF();
    let currentY = addStandardHeaderToPDF(doc, settings, "Relatório de Membros da CIPA", CIPA_LOGO_URL);
    
    const tableColumn = ["Nome", "Cargo", "Cargo CIPA", "Setor"];
    const tableRows = members.map(m => [
      m.name,
      m.role,
      m.cipa_role,
      m.sector
    ]);
    
    autoTable(doc, {
      startY: currentY + 10,
      head: [tableColumn],
      body: tableRows,
      headStyles: { fillColor: [0, 0, 0] },
    });

    let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : currentY + 20;
    addStandardFooterToPDF(doc, settings, finalY, CIPA_LOGO_URL);
    
    const pdfDataUri = doc.output('datauristring');
    setPdfPreviewUrl(pdfDataUri);
    setPdfPreviewTitle(`Relatorio_Membros_CIPA_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const handleExportMeetingsPDF = () => {
    const doc = new jsPDF();
    let currentY = addStandardHeaderToPDF(doc, settings, "Relatório de Reuniões da CIPA", CIPA_LOGO_URL);
    
    const tableColumn = ["Data", "Tipo", "Participantes", "Tópicos", "Status da Ata"];
    const tableRows = meetings.map(m => [
      safeFormatDate(m.date),
      m.type,
      m.participants?.length || 0,
      m.topics?.length || 0,
      m.file_url ? "Anexada" : (safeIsDelayed(m.date) ? "Atrasada" : "Pendente")
    ]);
    
    autoTable(doc, {
      startY: currentY + 10,
      head: [tableColumn],
      body: tableRows,
      headStyles: { fillColor: [0, 0, 0] },
    });

    let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : currentY + 20;
    addStandardFooterToPDF(doc, settings, finalY, CIPA_LOGO_URL);
    
    const pdfDataUri = doc.output('datauristring');
    setPdfPreviewUrl(pdfDataUri);
    setPdfPreviewTitle(`Relatorio_Reunioes_CIPA_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const handleExportTopicsPDF = () => {
    const doc = new jsPDF();
    let currentY = addStandardHeaderToPDF(doc, settings, "Relatório de Tópicos da CIPA", CIPA_LOGO_URL);
    
    const tableColumn = ["Data Reunião", "Tópico", "Descrição", "Prazo", "Status"];
    const tableRows = allTopics.map(t => [
      t.meeting_date ? safeFormatDate(t.meeting_date) : "-",
      t.title,
      t.description,
      t.deadline ? safeFormatDate(t.deadline) : "-",
      t.status
    ]);
    
    autoTable(doc, {
      startY: currentY + 10,
      head: [tableColumn],
      body: tableRows,
      headStyles: { fillColor: [0, 0, 0] },
      columnStyles: {
        2: { cellWidth: 60 } // Make description column wider
      }
    });

    let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : currentY + 20;
    addStandardFooterToPDF(doc, settings, finalY, CIPA_LOGO_URL);
    
    const pdfDataUri = doc.output('datauristring');
    setPdfPreviewUrl(pdfDataUri);
    setPdfPreviewTitle(`Relatorio_Topicos_CIPA_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const calculateParticipation = () => {
    if (meetings.length === 0 || members.length === 0) return [];
    
    return members.map(member => {
      const attended = meetings.filter(m => 
        m.participants.some(p => p.employee_id === member.employee_id)
      ).length;
      
      return {
        ...member,
        attended,
        percentage: Math.round((attended / meetings.length) * 100)
      };
    }).sort((a, b) => b.percentage - a.percentage);
  };

  const participationData = calculateParticipation();

  const handleExportParticipationPDF = () => {
    const doc = new jsPDF();
    let currentY = addStandardHeaderToPDF(doc, settings, "Relatório de Participação CIPA", CIPA_LOGO_URL);
    
    doc.setFontSize(12);
    doc.text(`Total de Reuniões Realizadas: ${meetings.length}`, 14, currentY);
    doc.text(`Total de Membros: ${members.length}`, 14, currentY + 8);
    
    const tableColumn = ["Membro", "Cargo", "Setor", "Reuniões Presente", "Participação (%)"];
    const tableRows = participationData.map(p => [
      p.name,
      p.cipa_role,
      p.sector,
      `${p.attended} de ${meetings.length}`,
      `${p.percentage}%`
    ]);
    
    autoTable(doc, {
      startY: currentY + 20,
      head: [tableColumn],
      body: tableRows,
      headStyles: { fillColor: [0, 0, 0] },
    });

    let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 20 : currentY + 20;
    addStandardFooterToPDF(doc, settings, finalY, CIPA_LOGO_URL);
    
    const pdfDataUri = doc.output('datauristring');
    setPdfPreviewUrl(pdfDataUri);
    setPdfPreviewTitle(`Relatorio_Participacao_CIPA_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
          <Users className="w-8 h-8 text-emerald-600" />
          Comissão Interna de Prevenção de Acidentes (CIPA)
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-full sm:w-fit">
        <button
          onClick={() => setActiveTab("members")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "members" ? "bg-white text-emerald-700 shadow" : "text-gray-600 hover:text-gray-900"}`}
        >
          Membros
        </button>
        <button
          onClick={() => setActiveTab("meetings")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "meetings" ? "bg-white text-emerald-700 shadow" : "text-gray-600 hover:text-gray-900"}`}
        >
          Reuniões
        </button>
        <button
          onClick={() => setActiveTab("topics")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "topics" ? "bg-white text-emerald-700 shadow" : "text-gray-600 hover:text-gray-900"}`}
        >
          Tópicos e Ações
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "reports" ? "bg-white text-emerald-700 shadow" : "text-gray-600 hover:text-gray-900"}`}
        >
          Relatórios
        </button>
      </div>

      {/* Members Tab */}
      {activeTab === "members" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Total de Membros: {members.length}</h2>
            <div className="flex gap-2">
              <button onClick={handleExportMembersPDF} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium">
                <Download className="w-5 h-5" /> Gerar PDF
              </button>
              {canEditPage && (
                <button onClick={() => setShowAddMember(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
                  <Plus className="w-5 h-5" /> Adicionar Membro
                </button>
              )}
            </div>
          </div>

          {showAddMember && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold mb-4">Novo Membro CIPA</h3>
              <form onSubmit={handleAddMember} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário</label>
                  <select 
                    required
                    value={newMember.employee_id}
                    onChange={e => setNewMember({...newMember, employee_id: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                  >
                    <option value="">Selecione...</option>
                    {employees.filter(e => !members.some(m => m.employee_id === e.id)).map(e => (
                      <option key={e.id} value={e.id}>{e.name} - {e.sector}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo na CIPA</label>
                  <select 
                    value={newMember.cipa_role}
                    onChange={e => setNewMember({...newMember, cipa_role: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                  >
                    <option>Presidente</option>
                    <option>Vice-Presidente</option>
                    <option>Secretário</option>
                    <option>Membro Titular</option>
                    <option>Membro Suplente</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex-1">Salvar</button>
                  <button type="button" onClick={() => setShowAddMember(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">Cancelar</button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map(member => (
              <div key={member.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center relative">
                <button onClick={() => handleRemoveMember(member.id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-5 h-5" />
                </button>
                <img src={member.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}`} alt={member.name} className="w-24 h-24 rounded-full object-cover border-4 border-emerald-50 mb-4" />
                <h3 className="text-lg font-bold text-gray-900">{member.name}</h3>
                <p className="text-sm text-gray-500 mb-2">{member.role} • <SectorBadge sector={member.sector} /></p>
                <span className="inline-block px-3 py-1 bg-emerald-100 text-blue-800 text-xs font-semibold rounded-full">
                  {member.cipa_role}
                </span>
              </div>
            ))}
            {members.length === 0 && (
              <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                Nenhum membro cadastrado na CIPA.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meetings Tab */}
      {activeTab === "meetings" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Total de Reuniões: {meetings.length}</h2>
            <div className="flex gap-2">
              <button onClick={handleExportMeetingsPDF} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium">
                <Download className="w-5 h-5" /> Gerar PDF
              </button>
              {canEditPage && (
                <button onClick={() => setShowAddMeeting(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
                  <Plus className="w-5 h-5" /> Nova Reunião
                </button>
              )}
            </div>
          </div>

          {showAddMeeting && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
              <h3 className="text-lg font-bold border-b pb-2">Registrar Reunião da CIPA</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input type="date" value={newMeeting.date} onChange={e => setNewMeeting({...newMeeting, date: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={newMeeting.type} onChange={e => setNewMeeting({...newMeeting, type: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                    <option>Ordinária</option>
                    <option>Extraordinária</option>
                  </select>
                </div>
                <div>
                  <ImageUpload
                    label="Ata (PDF/Imagem)"
                    name="file_url"
                    currentImage={newMeeting.file_url}
                    onImageSelect={handleFileUpload}
                    accept=".pdf,image/*"
                  />
                </div>
              </div>

              {/* Participants */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium text-gray-800 mb-3">Participantes</h4>
                <div className="flex gap-2 mb-4">
                  <select value={selectedParticipant} onChange={e => setSelectedParticipant(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                    <option value="">Selecione um funcionário...</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.sector})</option>
                    ))}
                  </select>
                  <button type="button" onClick={handleAddParticipant} className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700">Adicionar</button>
                </div>

                <div className="space-y-3">
                  {meetingParticipants.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.role} • {p.cipa_role}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {p.signature ? (
                          <img src={p.signature} alt="Assinatura" className="h-10 object-contain border-b border-gray-300" />
                        ) : (
                          <button type="button" onClick={() => setSigningParticipant(p.employee_id)} className="text-sm text-emerald-600 hover:underline">
                            Coletar Assinatura
                          </button>
                        )}
                        <button type="button" onClick={() => setMeetingParticipants(meetingParticipants.filter(mp => mp.employee_id !== p.employee_id))} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {meetingParticipants.length === 0 && <p className="text-sm text-gray-500 italic">Nenhum participante adicionado.</p>}
                </div>
              </div>

              {/* Signature Modal */}
              {signingParticipant !== null && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white p-6 rounded-xl shadow-xl max-w-lg w-full">
                    <h3 className="text-lg font-bold mb-4">Assinatura do Participante</h3>
                    <div className="border border-gray-300 rounded-lg mb-4 bg-gray-50">
                      <SignatureCanvas ref={sigRef} canvasProps={{className: 'w-full h-40 rounded-lg'}} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => sigRef.current?.clear()} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Limpar</button>
                      <button type="button" onClick={() => setSigningParticipant(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                      <button type="button" onClick={saveSignature} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Salvar Assinatura</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Topics */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium text-gray-800 mb-3">Tópicos Levantados</h4>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-4">
                  <input type="text" placeholder="Título do Tópico" value={currentTopic.title} onChange={e => setCurrentTopic({...currentTopic, title: e.target.value})} className="md:col-span-3 p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400" />
                  <input type="text" placeholder="Descrição / Ação" value={currentTopic.description} onChange={e => setCurrentTopic({...currentTopic, description: e.target.value})} className="md:col-span-5 p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400" />
                  <input type="date" value={currentTopic.deadline} onChange={e => setCurrentTopic({...currentTopic, deadline: e.target.value})} className="md:col-span-2 p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400" />
                  <button type="button" onClick={handleAddTopic} className="md:col-span-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm">Adicionar</button>
                </div>
                <div className="space-y-2">
                  {meetingTopics.map((t, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-gray-200 flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{t.title}</p>
                        <p className="text-xs text-gray-600">{t.description}</p>
                        {t.deadline && <p className="text-xs text-red-600 mt-1">Prazo: {safeFormatDate(t.deadline)}</p>}
                      </div>
                      <button type="button" onClick={() => setMeetingTopics(meetingTopics.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setShowAddMeeting(false)} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancelar</button>
                <button type="button" onClick={handleSaveMeeting} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">Salvar Reunião</button>
              </div>
            </div>
          )}

          {/* List Meetings */}
          <div className="space-y-4">
            {meetings.map(meeting => (
              <div key={meeting.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-emerald-600" />
                      Reunião {meeting.type}
                    </h3>
                    <p className="text-gray-500">{safeFormatDate(meeting.date)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {meeting.file_url ? (
                      <a href={meeting.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-emerald-600 hover:underline bg-emerald-50 px-3 py-1 rounded-full">
                        <FileText className="w-4 h-4" /> Ver Ata
                      </a>
                    ) : (
                      <div className="flex items-center gap-1 text-sm bg-red-50 text-red-600 px-3 py-1 rounded-full font-medium">
                        <AlertCircle className="w-4 h-4" /> 
                        {safeIsDelayed(meeting.date) ? "Ata Atrasada (> 4 dias úteis)" : "Ata Pendente"}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Participantes ({meeting.participants?.length || 0})</h4>
                    <ul className="space-y-2">
                      {meeting.participants?.map((p, i) => (
                        <li key={i} className="text-sm flex justify-between items-center bg-gray-50 p-2 rounded">
                          <span><span className="font-medium">{p.name}</span> <span className="text-gray-500 text-xs">({p.cipa_role})</span></span>
                          {p.signature && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Assinado</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Tópicos ({meeting.topics?.length || 0})</h4>
                    <ul className="space-y-2">
                      {meeting.topics?.map((t, i) => (
                        <li key={i} className="text-sm bg-gray-50 p-2 rounded">
                          <p className="font-medium">{t.title}</p>
                          <div className="flex justify-between items-center mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === 'Concluído' ? 'bg-green-100 text-green-800' : t.status === 'Em Andamento' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                              {t.status}
                            </span>
                            {t.deadline && <span className="text-xs text-gray-500">Prazo: {safeFormatDate(t.deadline, "dd/MM/yy")}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
            {meetings.length === 0 && (
              <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                Nenhuma reunião registrada.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Topics Tab */}
      {activeTab === "topics" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Acompanhamento de Tópicos e Ações</h2>
            <div className="flex gap-2">
              <button onClick={() => handlePrintTopics()} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                <Printer className="w-4 h-4" /> Imprimir
              </button>
              <button onClick={handleExportTopicsPDF} className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition text-sm font-medium">
                <Download className="w-4 h-4" /> Gerar PDF
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div ref={reportRef} className="p-0 print:p-8">
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
                  <div className="flex items-center gap-4 text-right text-sm text-gray-500">
                    <div>
                      <p className="font-bold text-gray-800">Relatório de Tópicos CIPA</p>
                      <p>Emissão: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    <img src={CIPA_LOGO_URL} alt="CIPA Logo" className="h-16 object-contain" />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                      <th className="p-4 font-medium">Data Reunião</th>
                      <th className="p-4 font-medium">Tópico</th>
                      <th className="p-4 font-medium">Descrição / Ação</th>
                      <th className="p-4 font-medium">Prazo</th>
                      <th className="p-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {allTopics.map((topic) => (
                      <tr key={topic.id} className="hover:bg-gray-50">
                        <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                          {topic.meeting_date ? safeFormatDate(topic.meeting_date) : "-"}
                        </td>
                        <td className="p-4 text-sm font-medium text-gray-900">{topic.title}</td>
                        <td className="p-4 text-sm text-gray-600 max-w-xs truncate" title={topic.description}>{topic.description}</td>
                        <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                          {topic.deadline ? safeFormatDate(topic.deadline) : "-"}
                        </td>
                        <td className="p-4 text-sm">
                          <select 
                            value={topic.status}
                            onChange={(e) => updateTopicStatus(topic.id!, e.target.value)}
                            className={`text-xs font-semibold rounded-full px-2 py-1 border-0 cursor-pointer print:appearance-none
                              ${topic.status === 'Concluído' ? 'bg-green-100 text-green-800' : 
                                topic.status === 'Em Andamento' ? 'bg-yellow-100 text-yellow-800' : 
                                'bg-red-100 text-red-800'}`}
                          >
                            <option value="Pendente">Pendente</option>
                            <option value="Em Andamento">Em Andamento</option>
                            <option value="Concluído">Concluído</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                    {allTopics.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-500">Nenhum tópico registrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Print Footer */}
              <div className="hidden print:block mt-12 pt-8 border-t border-gray-300">
                <div className="flex flex-col items-start">
                  {settings?.resp_signature && (
                    <img src={settings.resp_signature} alt="Assinatura" className="h-16 object-contain mb-2" />
                  )}
                  <p className="font-bold text-gray-900">{settings?.resp_name || "Responsável SST"}</p>
                  <p className="text-sm text-gray-600">{settings?.resp_role || "Engenheiro/Técnico de Segurança"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Relatório de Participação</h2>
            <button onClick={handleExportParticipationPDF} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium">
              <Download className="w-5 h-5" /> Gerar PDF
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
              <div className="p-4 bg-emerald-100 rounded-full text-emerald-600">
                <Calendar className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total de Reuniões</p>
                <p className="text-3xl font-bold text-gray-900">{meetings.length}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
              <div className="p-4 bg-emerald-100 rounded-full text-emerald-600">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total de Membros</p>
                <p className="text-3xl font-bold text-gray-900">{members.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                    <th className="p-4 font-medium">Membro</th>
                    <th className="p-4 font-medium">Cargo CIPA</th>
                    <th className="p-4 font-medium">Setor</th>
                    <th className="p-4 font-medium text-center">Presenças</th>
                    <th className="p-4 font-medium text-center">Participação (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {participationData.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="p-4 text-sm font-medium text-gray-900 flex items-center gap-3">
                        <img src={p.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}`} alt={p.name} className="w-8 h-8 rounded-full" />
                        {p.name}
                      </td>
                      <td className="p-4 text-sm text-gray-600">{p.cipa_role}</td>
                      <td className="p-4 text-sm">
                        <SectorBadge sector={p.sector} />
                      </td>
                      <td className="p-4 text-sm text-center font-medium text-gray-900">{p.attended} / {meetings.length}</td>
                      <td className="p-4 text-sm text-center">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                          p.percentage >= 75 ? 'bg-green-100 text-green-800' :
                          p.percentage >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {p.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {participationData.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">Dados insuficientes para gerar o relatório.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* PDF Preview Modal */}
      {pdfPreviewUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Pré-visualização do PDF</h2>
              <button onClick={() => setPdfPreviewUrl(null)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-gray-100 p-4">
              <iframe src={pdfPreviewUrl} className="w-full h-full rounded border border-gray-300" title="PDF Preview" />
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setPdfPreviewUrl(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition font-medium">
                Cancelar
              </button>
              <a 
                href={pdfPreviewUrl} 
                download={pdfPreviewTitle}
                onClick={() => setPdfPreviewUrl(null)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium"
              >
                <Download className="w-5 h-5" /> Confirmar e Baixar
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
