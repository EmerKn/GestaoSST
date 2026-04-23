import { useState, useEffect, useRef } from "react";
import { Stethoscope, Plus, Search, FileText, Calendar, Clock, MapPin, Activity, User, ChevronDown, ChevronUp, Download, Printer, Trash2, Edit, Upload, Loader2, X } from "lucide-react";
import { format, parseISO, isBefore, isAfter, addDays, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SectorBadge } from "../utils/sectorColors";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchSettings, addStandardHeaderToPDF, addStandardFooterToPDF, CompanySettings } from "../utils/pdfUtils";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { filterRealData } from "./Funcionarios";
import { ImageUpload } from "../components/ImageUpload";
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || 'missing_key' });

interface Employee {
  id: number;
  name: string;
  sector: string;
  role: string;
}

interface PcmsoExam {
  id: number;
  exam_name: string;
  function_name: string;
  sector: string;
  periodicity: string;
  created_at: string;
}

interface Exam {
  id: number;
  employee_id: number;
  employee_name: string;
  employee_sector: string;
  employee_role: string;
  type: string;
  specific_exams: string;
  periodicity: string;
  exam_date: string;
  next_exam_date: string;
  status: string;
  file_url: string;
  is_requirement?: boolean;
}

export default function Exames() {
  const { canEdit, isMobile } = useAuth();
  const canEditPage = canEdit;

  const [activeTab, setActiveTab] = useState<"list" | "reports" | "pcmso">("list");
  const [exams, setExams] = useState<Exam[]>([]);
  const [pcmsoExams, setPcmsoExams] = useState<PcmsoExam[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [search, setSearch] = useState("");
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPcmsoModal, setShowPcmsoModal] = useState(false);
  const [uploadingPcmso, setUploadingPcmso] = useState(false);
  const [selectedPcmsoFile, setSelectedPcmsoFile] = useState<File | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [formData, setFormData] = useState<Partial<Exam>>({
    type: "Periódico",
    exam_date: format(new Date(), "yyyy-MM-dd"),
    next_exam_date: format(addDays(new Date(), 365), "yyyy-MM-dd"),
    status: "Realizado",
    periodicity: "12 meses"
  });

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [examsRes, pcmsoRes, empRes, settingsRes] = await Promise.all([
        supabase.from('exams').select('*, employees(name, sector, role)').order('next_exam_date', { ascending: true }),
        supabase.from('pcmso_exams').select('*').order('sector', { ascending: true }).order('function_name', { ascending: true }),
        supabase.from('employees').select('id, name, sector, role'),
        fetchSettings()
      ]);

      if (examsRes.data) {
        const realExams = filterRealData(examsRes.data);
        const formattedExams = realExams.map(exam => ({
          ...exam,
          employee_name: exam.employees?.name,
          employee_sector: exam.employees?.sector,
          employee_role: exam.employees?.role
        }));
        setExams(formattedExams);
      }
      if (pcmsoRes.data) {
        setPcmsoExams(pcmsoRes.data);
      }
      if (empRes.data) setEmployees(filterRealData(empRes.data));
      setSettings(settingsRes);
    } catch (error) {
      console.error("Error loading exams data:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (file: File) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, file_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExam) {
        const { error } = await supabase.from('exams').update(formData).eq('id', editingExam.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('exams').insert([formData]);
        if (error) throw error;
      }
      closeModal();
      loadData();
    } catch (error) {
      console.error("Error saving exam:", error);
      alert("Erro ao salvar exame.");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir este exame?")) {
      try {
        const { error } = await supabase.from('exams').delete().eq('id', id);
        if (error) throw error;
        loadData();
      } catch (error) {
        console.error("Error deleting exam:", error);
        alert("Erro ao excluir exame.");
      }
    }
  };

  const openEditModal = (exam: Exam) => {
    if (exam.id < 0) {
      // It's a pending requirement
      setEditingExam(null);
      setFormData({
        employee_id: exam.employee_id,
        type: "Periódico", // Default, user can change
        specific_exams: exam.specific_exams,
        periodicity: exam.periodicity,
        exam_date: format(new Date(), "yyyy-MM-dd"),
        next_exam_date: format(addDays(new Date(), 365), "yyyy-MM-dd"),
        status: "Realizado"
      });
    } else {
      setEditingExam(exam);
      // Strip non-DB fields
      const { id, employee_name, employee_sector, employee_role, is_requirement, ...dbData } = exam;
      setFormData(dbData);
    }
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingExam(null);
    setFormData({
      type: "Periódico",
      exam_date: format(new Date(), "yyyy-MM-dd"),
      next_exam_date: format(addDays(new Date(), 365), "yyyy-MM-dd"),
      status: "Realizado",
      periodicity: "12 meses"
    });
  };

  const handlePcmsoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPcmsoFile) return alert("Selecione um arquivo PDF do PCMSO.");
    
    setUploadingPcmso(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(selectedPcmsoFile);
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = error => reject(error);
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: 'application/pdf'
            }
          },
          {
            text: `Analise este documento PCMSO e extraia todos os exames ocupacionais exigidos.
            Para cada exame, identifique o nome do exame, a função (cargo) que exige o exame, o setor, e a periodicidade (ex: admissional, periódico anual, demissional).
            Retorne uma lista de objetos contendo essas informações.`
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                exam_name: { type: Type.STRING },
                function_name: { type: Type.STRING },
                sector: { type: Type.STRING },
                periodicity: { type: Type.STRING }
              },
              required: ["exam_name", "function_name", "sector", "periodicity"]
            }
          }
        }
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("Resposta vazia do Gemini");
      
      const extractedExams = JSON.parse(jsonText);

      if (extractedExams && extractedExams.length > 0) {
        const { error } = await supabase.from('pcmso_exams').insert(extractedExams);
        if (error) throw error;
        
        setShowPcmsoModal(false);
        setSelectedPcmsoFile(null);
        loadData();
        alert("Exames do PCMSO extraídos e salvos com sucesso!");
      } else {
        alert("Nenhum exame encontrado no documento.");
      }
    } catch (error) {
      console.error("Error analyzing PCMSO:", error);
      alert("Erro ao analisar o documento PCMSO. Verifique se é um PDF válido e tente novamente.");
    } finally {
      setUploadingPcmso(false);
    }
  };

  const handleDeletePcmsoExam = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta exigência do PCMSO?")) {
      try {
        const { error } = await supabase.from('pcmso_exams').delete().eq('id', id);
        if (error) throw error;
        loadData();
      } catch (error) {
        console.error("Error deleting PCMSO exam:", error);
        alert("Erro ao excluir exigência.");
      }
    }
  };

  // Build combined exams list
  const combinedExams: Exam[] = [];
  
  employees.forEach(emp => {
    // Find required exams for this employee's sector and role
    const requiredExams = pcmsoExams.filter(p => p.sector === emp.sector && p.function_name === emp.role);
    const empExams = exams.filter(e => e.employee_id === emp.id);
    
    // Map required exams
    requiredExams.forEach(req => {
      // Check if employee has done this exam (simple text match in specific_exams)
      const doneExam = empExams.find(e => e.specific_exams?.toLowerCase().includes(req.exam_name.toLowerCase()));
      
      if (doneExam) {
        // We don't add it here to avoid duplicates if multiple requirements match the same exam record.
        // Actually, we can just let the empExams loop add it later, but we want to mark it as required.
        doneExam.is_requirement = true;
      } else {
        // Add pending requirement
        combinedExams.push({
          id: -Math.random(), // temporary negative id for key
          employee_id: emp.id,
          employee_name: emp.name,
          employee_sector: emp.sector,
          employee_role: emp.role,
          type: "Pendente",
          specific_exams: req.exam_name,
          periodicity: req.periodicity,
          exam_date: "",
          next_exam_date: "",
          status: "Pendente",
          file_url: "",
          is_requirement: true
        } as Exam);
      }
    });

    // Add all actual exams for this employee
    empExams.forEach(e => {
      combinedExams.push(e);
    });
  });

  // Sort combined exams: by employee name, then pending first, then by date
  combinedExams.sort((a, b) => {
    if (a.employee_name !== b.employee_name) return (a.employee_name || "").localeCompare(b.employee_name || "");
    if (a.status === "Pendente" && b.status !== "Pendente") return -1;
    if (a.status !== "Pendente" && b.status === "Pendente") return 1;
    return 0;
  });

  const filtered = combinedExams.filter(e => 
    e.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.specific_exams?.toLowerCase().includes(search.toLowerCase()) ||
    e.type?.toLowerCase().includes(search.toLowerCase())
  );

  // Statistics
  const today = new Date();
  const totalExams = exams.length;
  const totalEmployees = employees.length;
  
  const expiredExams = exams.filter(e => e.next_exam_date && isBefore(parseISO(e.next_exam_date), today));
  const expiringSoonExams = exams.filter(e => {
    if (!e.next_exam_date) return false;
    const nextDate = parseISO(e.next_exam_date);
    const diff = differenceInDays(nextDate, today);
    return diff >= 0 && diff <= 30; // Expiring in the next 30 days
  });

  const examsByType: Record<string, number> = {
    "Periódico": 0,
    "Admissional": 0,
    "Demissional": 0,
    "Específicos": 0
  };

  const expiringByType: Record<string, number> = {
    "Periódico": 0,
    "Admissional": 0,
    "Demissional": 0,
    "Específicos": 0
  };

  exams.forEach(e => {
    const type = e.type || "Específicos";
    if (examsByType[type] !== undefined) {
      examsByType[type]++;
    } else {
      examsByType["Específicos"]++;
    }

    if (e.next_exam_date) {
      const nextDate = parseISO(e.next_exam_date);
      const diff = differenceInDays(nextDate, today);
      if (diff >= 0 && diff <= 30) {
        if (expiringByType[type] !== undefined) {
          expiringByType[type]++;
        } else {
          expiringByType["Específicos"]++;
        }
      }
    }
  });

  const examsBySector: Record<string, number> = {};
  exams.forEach(e => {
    if (e.employee_sector) {
      examsBySector[e.employee_sector] = (examsBySector[e.employee_sector] || 0) + 1;
    }
  });

  const handleExportPDF = () => {
    const doc = new jsPDF();
    let currentY = addStandardHeaderToPDF(doc, settings, "Relatório de Exames Ocupacionais");
    
    doc.setFontSize(12);
    doc.text(`Resumo Geral`, 14, currentY);
    currentY += 10;
    
    doc.setFontSize(10);
    doc.text(`Total de Exames Registrados: ${totalExams}`, 14, currentY);
    doc.text(`Total de Funcionários: ${totalEmployees}`, 14, currentY + 6);
    doc.text(`Exames Vencidos: ${expiredExams.length}`, 14, currentY + 12);
    doc.text(`Exames a Vencer (30 dias): ${expiringSoonExams.length}`, 14, currentY + 18);
    currentY += 28;

    autoTable(doc, {
      startY: currentY,
      head: [["Setor", "Total de Exames"]],
      body: Object.entries(examsBySector).sort((a, b) => b[1] - a[1]),
      headStyles: { fillColor: [0, 0, 0] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(12);
    doc.text(`Exames Vencidos e a Vencer`, 14, currentY);
    currentY += 8;

    const criticalExams = [...expiredExams, ...expiringSoonExams].sort((a, b) => parseISO(a.next_exam_date).getTime() - parseISO(b.next_exam_date).getTime());

    autoTable(doc, {
      startY: currentY,
      head: [["Funcionário", "Tipo", "Exames", "Vencimento", "Status"]],
      body: criticalExams.map(e => [
        e.employee_name,
        e.type,
        e.specific_exams,
        format(parseISO(e.next_exam_date), "dd/MM/yyyy"),
        isBefore(parseISO(e.next_exam_date), today) ? "Vencido" : "A Vencer"
      ]),
    });

    addStandardFooterToPDF(doc, settings, (doc as any).lastAutoTable.finalY + 20);
    doc.save(`Relatorio_Exames_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: "Relatorio_Exames",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
          <Stethoscope className="w-8 h-8 text-emerald-600" />
          Exames Ocupacionais
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "list" ? "bg-white text-emerald-700 shadow" : "text-gray-600 hover:text-gray-900"}`}
          >
            Lista de Exames
          </button>
          <button
            onClick={() => setActiveTab("pcmso")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "pcmso" ? "bg-white text-emerald-700 shadow" : "text-gray-600 hover:text-gray-900"}`}
          >
            Exigências PCMSO
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "reports" ? "bg-white text-emerald-700 shadow" : "text-gray-600 hover:text-gray-900"}`}
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
                placeholder="Buscar exame ou funcionário..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none placeholder:text-gray-400"
              />
            </div>
            {canEditPage && (
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
                <Plus className="w-5 h-5" /> Novo Exame
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                    <th className="p-4 font-medium">Funcionário</th>
                    <th className="p-4 font-medium">Tipo</th>
                    <th className="p-4 font-medium">Exames Realizados</th>
                    <th className="p-4 font-medium">Data</th>
                    <th className="p-4 font-medium">Próximo Vencimento</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map(exam => {
                    const nextDate = exam.next_exam_date ? parseISO(exam.next_exam_date) : null;
                    const isExpired = nextDate && isBefore(nextDate, today);
                    const isExpiringSoon = nextDate && differenceInDays(nextDate, today) >= 0 && differenceInDays(nextDate, today) <= 30;

                    return (
                      <tr key={exam.id} className="hover:bg-gray-50">
                        <td className="p-4">
                          <p className="font-bold text-gray-900">{exam.employee_name}</p>
                          <p className="text-xs text-gray-500"><SectorBadge sector={exam.employee_sector} /></p>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-indigo-800">
                            {exam.type}
                          </span>
                        </td>
                        <td className="p-4 text-gray-600 max-w-xs truncate" title={exam.specific_exams}>
                          <div className="flex items-center gap-1">
                            {exam.specific_exams}
                            {exam.is_requirement && (
                              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold" title="Exigência do PCMSO">
                                *
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-gray-600">{exam.exam_date ? format(parseISO(exam.exam_date), "dd/MM/yyyy") : "-"}</td>
                        <td className="p-4">
                          {exam.next_exam_date ? (
                            <span className={`font-medium ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-orange-500' : 'text-gray-600'}`}>
                              {format(nextDate!, "dd/MM/yyyy")}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            exam.status === 'Realizado' ? 'bg-green-100 text-green-800' :
                            exam.status === 'Agendado' ? 'bg-blue-100 text-blue-800' :
                            exam.status === 'Pendente' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {exam.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {exam.file_url && (
                              <a href={exam.file_url} target="_blank" rel="noreferrer" className="p-1 text-gray-400 hover:text-emerald-600" title="Ver Anexo">
                                <FileText className="w-4 h-4" />
                              </a>
                            )}
                            {exam.id < 0 ? (
                              <button onClick={() => openEditModal(exam)} className="p-1 text-emerald-600 hover:text-emerald-800" title="Adicionar Exame">
                                <Plus className="w-4 h-4" />
                              </button>
                            ) : (
                              <>
                                <button onClick={() => openEditModal(exam)} className="p-1 text-gray-400 hover:text-emerald-600" title="Editar">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(exam.id)} className="p-1 text-gray-400 hover:text-red-600" title="Excluir">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="p-8 text-center text-gray-500">Nenhum exame encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "pcmso" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Exigências do PCMSO</h2>
            {canEditPage && (
              <button onClick={() => setShowPcmsoModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
                <Upload className="w-5 h-5" /> Importar PCMSO (PDF)
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                    <th className="p-4 font-medium">Exame</th>
                    <th className="p-4 font-medium">Função</th>
                    <th className="p-4 font-medium">Setor</th>
                    <th className="p-4 font-medium">Periodicidade</th>
                    {canEditPage && <th className="p-4 font-medium text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pcmsoExams.map(exam => (
                    <tr key={exam.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-900">{exam.exam_name}</td>
                      <td className="p-4 text-gray-600">{exam.function_name}</td>
                      <td className="p-4 text-gray-600"><SectorBadge sector={exam.sector} /></td>
                      <td className="p-4 text-gray-600">{exam.periodicity}</td>
                      {canEditPage && (
                        <td className="p-4 text-right">
                          <button onClick={() => handleDeletePcmsoExam(exam.id)} className="p-1 text-gray-400 hover:text-red-600" title="Excluir exigência">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {pcmsoExams.length === 0 && (
                    <tr>
                      <td colSpan={canEditPage ? 5 : 4} className="p-12 text-center text-gray-500">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhuma exigência encontrada</h3>
                        <p className="text-gray-500">Faça o upload do seu PCMSO em PDF para extrair os exames automaticamente.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Relatórios e Estatísticas</h2>
            <div className="flex gap-2">
              <button onClick={() => handlePrint()} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                <Printer className="w-4 h-4" /> Imprimir
              </button>
              <button onClick={handleExportPDF} className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition text-sm font-medium">
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
                  <p className="font-bold text-gray-800">Relatório de Exames Ocupacionais</p>
                  <p>Emissão: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <p className="text-sm text-gray-500 font-medium">Total de Exames</p>
                <p className="text-3xl font-bold text-emerald-600 mb-2">{totalExams}</p>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Periódico: {examsByType["Periódico"] || 0}</p>
                  <p>Admissional: {examsByType["Admissional"] || 0}</p>
                  <p>Demissional: {examsByType["Demissional"] || 0}</p>
                  <p>Específicos: {examsByType["Específicos"] || 0}</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <p className="text-sm text-gray-500 font-medium">Total de Funcionários</p>
                <p className="text-3xl font-bold text-gray-900">{totalEmployees}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <p className="text-sm text-gray-500 font-medium">Exames a Vencer (30 dias)</p>
                <p className="text-3xl font-bold text-orange-500 mb-2">{expiringSoonExams.length}</p>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Periódico: {expiringByType["Periódico"] || 0}</p>
                  <p>Admissional: {expiringByType["Admissional"] || 0}</p>
                  <p>Demissional: {expiringByType["Demissional"] || 0}</p>
                  <p>Específicos: {expiringByType["Específicos"] || 0}</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <p className="text-sm text-gray-500 font-medium">Exames Vencidos</p>
                <p className="text-3xl font-bold text-red-600">{expiredExams.length}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Exames por Setor</h3>
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                      <th className="p-2 font-medium">Setor</th>
                      <th className="p-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(examsBySector).sort((a, b) => b[1] - a[1]).map(([sector, count]) => (
                      <tr key={sector}>
                        <td className="p-2"><SectorBadge sector={sector} /></td>
                        <td className="p-2 text-right font-bold">{count}</td>
                      </tr>
                    ))}
                    {Object.keys(examsBySector).length === 0 && (
                      <tr><td colSpan={2} className="p-4 text-center text-gray-500">Nenhum dado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Atenção: Vencidos e a Vencer</h3>
                <div className="space-y-3">
                  {[...expiredExams, ...expiringSoonExams].sort((a, b) => parseISO(a.next_exam_date).getTime() - parseISO(b.next_exam_date).getTime()).map(exam => {
                    const isExpired = isBefore(parseISO(exam.next_exam_date), today);
                    return (
                      <div key={exam.id} className={`p-3 rounded-lg border ${isExpired ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-gray-900">{exam.employee_name}</p>
                            <p className="text-sm text-gray-600">{exam.type} - {exam.specific_exams}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isExpired ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                              {isExpired ? 'Vencido' : 'A Vencer'}
                            </span>
                            <p className={`text-sm font-medium mt-1 ${isExpired ? 'text-red-600' : 'text-orange-600'}`}>
                              {format(parseISO(exam.next_exam_date), "dd/MM/yyyy")}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {expiredExams.length === 0 && expiringSoonExams.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">Nenhum exame vencido ou a vencer em breve.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showPcmsoModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Importar PCMSO</h2>
              <button onClick={() => setShowPcmsoModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handlePcmsoUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo PDF do PCMSO</label>
                  <input 
                    type="file" 
                    accept=".pdf"
                    required
                    onChange={(e) => setSelectedPcmsoFile(e.target.files?.[0] || null)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm" 
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    A inteligência artificial irá ler o documento e extrair automaticamente todos os exames exigidos por função e setor.
                  </p>
                </div>
                
                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowPcmsoModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition font-medium">
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={uploadingPcmso || !selectedPcmsoFile}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium disabled:opacity-50"
                  >
                    {uploadingPcmso ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Extraindo...</>
                    ) : (
                      <><Upload className="w-5 h-5" /> Importar e Extrair</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900">{editingExam ? "Editar Exame" : "Novo Exame Ocupacional"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário</label>
                  <select required name="employee_id" value={formData.employee_id || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                    <option value="">Selecione...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.sector})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Exame</label>
                  <select required name="type" value={formData.type} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                    <option value="Admissional">Admissional</option>
                    <option value="Demissional">Demissional</option>
                    <option value="Periódico">Periódico</option>
                    <option value="Retorno ao Trabalho">Retorno ao Trabalho</option>
                    <option value="Mudança de Função">Mudança de Função</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exames Específicos Realizados</label>
                <input required type="text" name="specific_exams" value={formData.specific_exams || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: Clínico, Audiometria, Acuidade Visual, Hemograma..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Periodicidade</label>
                  <input required type="text" name="periodicity" value={formData.periodicity || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: 12 meses, 6 meses..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data do Exame</label>
                  <input required type="date" name="exam_date" value={formData.exam_date} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Próximo Vencimento</label>
                  <input required type="date" name="next_exam_date" value={formData.next_exam_date} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select required name="status" value={formData.status} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400">
                    <option value="Realizado">Realizado</option>
                    <option value="Agendado">Agendado</option>
                    <option value="Vencido">Vencido</option>
                  </select>
                </div>
                <div>
                  <ImageUpload
                    label="Anexar PDF/Imagem do Exame"
                    name="file_url"
                    currentImage={formData.file_url}
                    onImageSelect={handleFileChange}
                    accept=".pdf,image/*"
                  />
                </div>
              </div>

              </div>

              <div className="p-6 flex justify-end gap-3 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-xl">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium">Salvar Exame</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
