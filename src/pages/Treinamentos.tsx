import { useState, useEffect } from "react";
import { GraduationCap, Plus, Calendar, Trash2, Camera, Star, X, FileText, BarChart3 } from "lucide-react";
import { format, parseISO, isBefore, isToday, getYear, getMonth, isWithinInterval, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addMonths, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { filterRealData } from "./Funcionarios";
import { ImageUpload } from "../components/ImageUpload";
import { useDatabaseOptions } from "../hooks/useDatabaseOptions";
import { SelectWithNew } from "../components/SelectWithNew";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Training {
  id: number;
  title: string;
  date: string;
  description: string;
  instructor: string;
  enrolled: number;
  workload: number;
  validity_months?: number;
  participants?: string[];
  photo_url?: string;
  comments?: string;
  training_evaluations?: any[];
}

export default function Treinamentos() {
  const { employees, suppliers } = useDatabaseOptions();
  const { canEdit, isMobile } = useAuth();
  const canEditPage = canEdit && !isMobile;

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "reports">("list");
  const [reportPeriod, setReportPeriod] = useState<"semana" | "mes" | "semestre" | "ano">("ano");
  const [selectedTraining, setSelectedTraining] = useState<Training | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    instructor: "",
    enrolled: 0,
    workload: 0,
    validity_months: 12,
    participants: [] as string[]
  });

  const [evalData, setEvalData] = useState({
    evaluator_type: "participant",
    evaluator_name: "",
    rating_instructor: 5,
    rating_content: 5,
    rating_vocabulary: 5,
    rating_location: 5,
    rating_sound_images: 5,
    rating_materials: 5,
    photo_url: "",
    comments: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data, error } = await supabase
        .from('trainings')
        .select('*, training_evaluations(*)')
        .order('date', { ascending: true });

      if (error) throw error;
      if (data) {
        setTrainings(filterRealData(data));
      }
    } catch (error) {
      console.error("Error loading trainings:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('trainings')
        .insert([formData]);

      if (error) throw error;
      
      setShowAddModal(false);
      setFormData({
        title: "",
        date: format(new Date(), "yyyy-MM-dd"),
        description: "",
        instructor: "",
        enrolled: 0,
        workload: 0,
        validity_months: 12,
        participants: []
      });
      loadData();
    } catch (error) {
      console.error("Error saving training:", error);
      alert("Erro ao salvar treinamento.");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Deseja realmente excluir este treinamento?")) {
      try {
        const { error } = await supabase
          .from('trainings')
          .delete()
          .eq('id', id);

        if (error) throw error;
        loadData();
      } catch (error) {
        console.error("Error deleting training:", error);
        alert("Erro ao excluir treinamento.");
      }
    }
  };

  const handleEvalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTraining) return;
    
    try {
      const { error } = await supabase
        .from('training_evaluations')
        .insert([{
          training_id: selectedTraining.id,
          ...evalData
        }]);

      if (error) throw error;
      
      setShowEvalModal(false);
      setSelectedTraining(null);
      loadData();
    } catch (error) {
      console.error("Error saving evaluation:", error);
      alert("Erro ao salvar avaliação.");
    }
  };

  const openEvalModal = (training: Training) => {
    setSelectedTraining(training);
    setEvalData({
      evaluator_type: "participant",
      evaluator_name: "",
      rating_instructor: 5,
      rating_content: 5,
      rating_vocabulary: 5,
      rating_location: 5,
      rating_sound_images: 5,
      rating_materials: 5,
      photo_url: "",
      comments: ""
    });
    setShowEvalModal(true);
  };

  const calculateEvalScore = (e: any) => {
    const sum = (e.rating_instructor || 0) + 
                (e.rating_content || 0) + 
                (e.rating_vocabulary || 0) + 
                (e.rating_location || 0) + 
                (e.rating_sound_images || (e.rating_time || 0)) + 
                (e.rating_materials || 5);
    return Math.round((sum / 30) * 100);
  };

  const generateReport = (training: Training) => {
    const doc = new jsPDF();
    const evals = training.training_evaluations || [];
    
    let totalScore = 0;
    evals.forEach(e => {
      totalScore += calculateEvalScore(e);
    });
    
    const averageScore = evals.length > 0 ? Math.round(totalScore / evals.length) : 0;

    doc.setFontSize(20);
    doc.text("Relatório de Avaliação de Treinamento", 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Curso: ${training.title}`, 14, 35);
    doc.text(`Data: ${format(parseISO(training.date), "dd/MM/yyyy")}`, 14, 42);
    doc.text(`Instrutor: ${training.instructor}`, 14, 49);
    doc.text(`Carga Horária: ${training.workload || 0} horas`, 14, 56);
    doc.text(`Participantes Inscritos: ${training.enrolled}`, 14, 63);
    
    let currentY = 70;
    if (training.participants && training.participants.length > 0) {
      doc.text(`Funcionários Participantes: ${training.participants.join(', ')}`, 14, currentY, { maxWidth: 180 });
      currentY += Math.ceil(training.participants.join(', ').length / 90) * 7;
    }

    doc.text(`Avaliações Realizadas: ${evals.length}`, 14, currentY);
    
    doc.setFontSize(16);
    doc.text(`Pontuação do Treinamento: ${averageScore} / 100`, 14, currentY + 15);
    
    autoTable(doc, {
      startY: currentY + 25,
      head: [['Avaliador', 'Tipo', 'Nota (0-100)', 'Comentários']],
      body: evals.map(e => [
        e.evaluator_name || 'Anônimo',
        e.evaluator_type === 'participant' ? 'Participante' : 'Resp. SST',
        calculateEvalScore(e).toString(),
        e.comments || '-'
      ]),
    });
    
    const photos = evals.filter(e => e.photo_url).map(e => e.photo_url);
    if (photos.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text("Fotos do Treinamento", 14, 20);
      let photoY = 30;
      photos.forEach((photo, idx) => {
        if (photoY > 200) {
          doc.addPage();
          photoY = 20;
        }
        try {
          doc.addImage(photo, 14, photoY, 180, 100);
          photoY += 110;
        } catch (e) {
          console.error("Error adding image to PDF", e);
        }
      });
    }
    
    doc.save(`Relatorio_Treinamento_${training.title.replace(/\s+/g, '_')}.pdf`);
  };

  const generateAnnualReport = () => {
    const currentYear = new Date().getFullYear();
    const yearTrainings = trainings.filter(t => getYear(parseISO(t.date)) === currentYear);
    
    if (yearTrainings.length === 0) {
      alert("Nenhum treinamento encontrado para este ano.");
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`Relatório Anual de Treinamentos - ${currentYear}`, 14, 22);

    // Trainings by month
    const trainingsByMonth = Array(12).fill(0);
    yearTrainings.forEach(t => {
      const month = getMonth(parseISO(t.date));
      trainingsByMonth[month]++;
    });

    doc.setFontSize(14);
    doc.text("Treinamentos por Mês", 14, 35);
    
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthData = monthNames.map((name, index) => [name, trainingsByMonth[index].toString()]);
    
    autoTable(doc, {
      startY: 40,
      head: [['Mês', 'Quantidade']],
      body: monthData,
    });

    // Best and Worst Trainings
    let bestTraining: any = null;
    let worstTraining: any = null;
    let maxScore = -1;
    let minScore = 101;

    yearTrainings.forEach(t => {
      const evals = t.training_evaluations || [];
      if (evals.length > 0) {
        let totalScore = 0;
        evals.forEach(e => {
          totalScore += calculateEvalScore(e);
        });
        const avgScore = Math.round(totalScore / evals.length);
        
        if (avgScore > maxScore) {
          maxScore = avgScore;
          bestTraining = t;
        }
        if (avgScore < minScore) {
          minScore = avgScore;
          worstTraining = t;
        }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(14);
    doc.text("Destaques do Ano", 14, finalY);
    
    doc.setFontSize(12);
    if (bestTraining) {
      doc.text(`Melhor Avaliado: ${bestTraining.title} (${maxScore}/100)`, 14, finalY + 10);
      doc.text(`Instrutor: ${bestTraining.instructor}`, 14, finalY + 17);
    } else {
      doc.text("Nenhum treinamento avaliado.", 14, finalY + 10);
    }

    if (worstTraining) {
      doc.text(`Pior Avaliado: ${worstTraining.title} (${minScore}/100)`, 14, finalY + 27);
      doc.text(`Instrutor: ${worstTraining.instructor}`, 14, finalY + 34);
    }

    const uniqueInstructors = Array.from(new Set(yearTrainings.map(t => t.instructor).filter(Boolean)));
    if (uniqueInstructors.length > 0) {
      doc.setFontSize(14);
      doc.text("Instrutores do Ano", 14, finalY + 50);
      doc.setFontSize(12);
      uniqueInstructors.forEach((inst, idx) => {
        doc.text(`- ${inst}`, 14, finalY + 60 + (idx * 7));
      });
    }

    doc.save(`Relatorio_Anual_Treinamentos_${currentYear}.pdf`);
  };

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

  const periodTrainings = trainings.filter(t => {
    const tDate = parseISO(t.date);
    return isWithinInterval(tDate, { start: startDate, end: endDate });
  });

  let expiredCount = 0;
  let expiringSoonCount = 0;
  let validCount = 0;

  const reportData = periodTrainings.map(t => {
    const validityMonths = t.validity_months || 12;
    const expirationDate = addMonths(parseISO(t.date), validityMonths);
    const daysToExpiration = differenceInDays(expirationDate, now);
    
    let status = "Válido";
    if (daysToExpiration < 0) {
      status = "Vencido";
      expiredCount++;
    } else if (daysToExpiration <= 30) {
      status = "A Vencer";
      expiringSoonCount++;
    } else {
      validCount++;
    }

    const evals = t.training_evaluations || [];
    let avgScore = 0;
    if (evals.length > 0) {
      let totalScore = 0;
      evals.forEach(e => {
        totalScore += calculateEvalScore(e);
      });
      avgScore = Math.round(totalScore / evals.length);
    }

    return {
      ...t,
      expirationDate,
      status,
      avgScore
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-emerald-600" />
          Treinamentos
        </h1>
        <div className="flex gap-2 w-full sm:w-auto">
          {canEdit && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>Adicionar Treinamento</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-700 pb-2">
        <button
          onClick={() => setActiveTab("list")}
          className={`px-4 py-2 font-medium transition-colors ${activeTab === "list" ? "text-emerald-500 border-b-2 border-emerald-500" : "text-gray-400 hover:text-gray-300"}`}
        >
          Lista de Treinamentos
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`px-4 py-2 font-medium transition-colors ${activeTab === "reports" ? "text-emerald-500 border-b-2 border-emerald-500" : "text-gray-400 hover:text-gray-300"}`}
        >
          Relatórios e Validades
        </button>
      </div>

      {activeTab === "list" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trainings Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
            <Calendar className="w-6 h-6 text-emerald-600" />
            Próximos Treinamentos
          </h2>
          <div className="space-y-4">
            {trainings.map((training, index) => {
              // Alternate colors for visual distinction
              const colors = [
                { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-blue-900', textLight: 'text-emerald-700', badgeBg: 'bg-blue-200', badgeText: 'text-blue-800', accent: 'text-emerald-600' },
                { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-900', textLight: 'text-orange-700', badgeBg: 'bg-orange-200', badgeText: 'text-orange-800', accent: 'text-orange-600' },
                { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-900', textLight: 'text-emerald-700', badgeBg: 'bg-emerald-200', badgeText: 'text-emerald-800', accent: 'text-emerald-600' },
                { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-900', textLight: 'text-purple-700', badgeBg: 'bg-purple-200', badgeText: 'text-purple-800', accent: 'text-purple-600' }
              ];
              const color = colors[index % colors.length];

              return (
                <div key={training.id} className={`p-4 ${color.bg} border ${color.border} rounded-lg relative group`}>
                  {canEditPage && (
                    <button 
                      onClick={() => handleDelete(training.id)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <div className="flex justify-between items-start mb-2 pr-8">
                    <h3 className={`font-bold ${color.text}`}>{training.title}</h3>
                    <span className={`text-xs font-bold ${color.badgeBg} ${color.badgeText} px-2 py-1 rounded`}>
                      {format(parseISO(training.date), "dd/MM/yyyy")}
                    </span>
                  </div>
                  <p className={`text-sm ${color.textLight} mb-3`}>{training.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className={`${color.accent} font-medium`}>Instrutor: {training.instructor}</span>
                    <span className={`${color.accent} font-medium`}>{training.enrolled} Inscritos</span>
                  </div>
                  {training.participants && training.participants.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      <strong>Participantes:</strong> {training.participants.join(', ')}
                    </div>
                  )}
                  
                  {(isToday(parseISO(training.date)) || isBefore(parseISO(training.date), new Date())) && (
                    <div className="mt-4 pt-4 border-t border-gray-200/50 flex justify-end gap-2">
                      {(() => {
                        const evals = training.training_evaluations || [];
                        const participantEvals = evals.filter(e => e.evaluator_type === 'participant').length;
                        const safetyEvals = evals.filter(e => e.evaluator_type === 'safety_officer').length;
                        const isClosed = participantEvals >= training.enrolled && safetyEvals >= 1;

                        return (
                          <>
                            {!isClosed && (
                              <button 
                                onClick={() => openEvalModal(training)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`}
                              >
                                <Star className="w-4 h-4" />
                                Avaliar / Anexar Foto
                              </button>
                            )}
                            {isClosed && (
                              <button 
                                onClick={() => generateReport(training)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200`}
                              >
                                <FileText className="w-4 h-4" />
                                Gerar Relatório
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
            
            {trainings.length === 0 && (
              <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                Nenhum treinamento cadastrado.
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-lg font-bold text-slate-200">Controle de Treinamentos</h2>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={reportPeriod}
                onChange={(e) => setReportPeriod(e.target.value as any)}
                className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
              >
                <option value="semana">Esta Semana</option>
                <option value="mes">Este Mês</option>
                <option value="semestre">Últimos 6 Meses</option>
                <option value="ano">Este Ano</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Treinamentos Válidos</span>
              <span className="text-4xl font-black text-emerald-600">{validCount}</span>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">A Vencer (30 dias)</span>
              <span className="text-4xl font-black text-orange-500">{expiringSoonCount}</span>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Vencidos</span>
              <span className="text-4xl font-black text-red-600">{expiredCount}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
                    <th className="p-4 font-medium">Nome do Treinamento</th>
                    <th className="p-4 font-medium">Data Realização</th>
                    <th className="p-4 font-medium">Vencimento</th>
                    <th className="p-4 font-medium">Instrutor</th>
                    <th className="p-4 font-medium">Nota</th>
                    <th className="p-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData.map((training) => (
                    <tr key={training.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 font-medium text-gray-900">{training.title}</td>
                      <td className="p-4 text-gray-600">{format(parseISO(training.date), "dd/MM/yyyy")}</td>
                      <td className="p-4 text-gray-600">{format(training.expirationDate, "dd/MM/yyyy")}</td>
                      <td className="p-4 text-gray-600">{training.instructor}</td>
                      <td className="p-4 text-gray-600">
                        {training.avgScore > 0 ? `${training.avgScore}/100` : "N/A"}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          training.status === "Válido" ? "bg-emerald-100 text-emerald-800" :
                          training.status === "A Vencer" ? "bg-orange-100 text-orange-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {training.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {reportData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">
                        Nenhum treinamento encontrado no período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold">Novo Treinamento</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título do Treinamento</label>
                  <input 
                    type="text" 
                    required
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                    placeholder="Ex: NR-35 Trabalho em Altura"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input 
                    type="date" 
                    required
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea 
                    required
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                    rows={3}
                    placeholder="Detalhes sobre o treinamento..."
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instrutor</label>
                    <SelectWithNew
                      name="instructor"
                      value={formData.instructor || ""}
                      onChange={e => setFormData({...formData, instructor: e.target.value})}
                      options={[...employees.map(e => e.name), ...suppliers.map(s => s.name)]}
                      placeholder="Selecione ou digite o instrutor"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Qtd. Inscritos</label>
                    <input 
                      type="number" 
                      min="0"
                      required
                      value={formData.enrolled}
                      onChange={e => setFormData({...formData, enrolled: parseInt(e.target.value) || 0})}
                      className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Carga Horária (h)</label>
                    <input 
                      type="number" 
                      min="0"
                      required
                      value={formData.workload}
                      onChange={e => setFormData({...formData, workload: parseInt(e.target.value) || 0})}
                      className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Validade (Meses)</label>
                    <input 
                      type="number" 
                      min="0"
                      required
                      value={formData.validity_months}
                      onChange={e => setFormData({...formData, validity_months: parseInt(e.target.value) || 0})}
                      className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Funcionários Participantes</label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-gray-50 space-y-2">
                    {employees.map(emp => (
                      <label key={emp.id} className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={formData.participants.includes(emp.name)}
                          onChange={(e) => {
                            const newParticipants = e.target.checked 
                              ? [...formData.participants, emp.name]
                              : formData.participants.filter(p => p !== emp.name);
                            
                            setFormData({
                              ...formData, 
                              participants: newParticipants,
                              enrolled: Math.max(formData.enrolled, newParticipants.length)
                            });
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-700">{emp.name}</span>
                      </label>
                    ))}
                    {employees.length === 0 && (
                      <p className="text-sm text-gray-500 italic">Nenhum funcionário cadastrado.</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Selecione os funcionários. A quantidade de inscritos será atualizada automaticamente.</p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3 shrink-0 bg-gray-50 rounded-b-xl">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-medium transition"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Eval Modal */}
      {showEvalModal && selectedTraining && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold">Avaliação do Treinamento</h3>
              <button onClick={() => setShowEvalModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleEvalSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Avaliador</label>
                    <select 
                      required
                      value={evalData.evaluator_type}
                      onChange={e => setEvalData({...evalData, evaluator_type: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                    >
                      <option value="participant">Participante</option>
                      <option value="safety_officer">Responsável da Segurança do Trabalho</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome (Opcional)</label>
                    <SelectWithNew
                      name="evaluator_name"
                      value={evalData.evaluator_name || ""}
                      onChange={e => setEvalData({...evalData, evaluator_name: e.target.value})}
                      options={employees.map(e => e.name)}
                      placeholder="Nome do avaliador"
                    />
                  </div>
                </div>

                <div>
                  <ImageUpload
                    label="Foto para Registro do Treinamento"
                    name="photo_url"
                    currentImage={evalData.photo_url}
                    onImageSelect={(file) => {
                      const reader = new FileReader();
                      reader.onloadend = () => setEvalData({...evalData, photo_url: reader.result as string});
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comentários sobre o treinamento</label>
                  <textarea 
                    value={evalData.comments}
                    onChange={e => setEvalData({...evalData, comments: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'rating_instructor', label: 'Avaliação do Instrutor' },
                    { key: 'rating_content', label: 'Avaliação do Conteúdo' },
                    { key: 'rating_vocabulary', label: 'Avaliação da Linguagem' },
                    { key: 'rating_location', label: 'Avaliação do Espaço' },
                    { key: 'rating_sound_images', label: 'Avaliação de Som e Imagens' },
                    { key: 'rating_materials', label: 'Avaliação dos Materiais Usados' }
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                      <select 
                        required
                        value={evalData[field.key as keyof typeof evalData]}
                        onChange={e => setEvalData({...evalData, [field.key]: parseInt(e.target.value)})}
                        className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400"
                      >
                        <option value={1}>1 - Muito Ruim</option>
                        <option value={2}>2 - Ruim</option>
                        <option value={3}>3 - Regular</option>
                        <option value={4}>4 - Bom</option>
                        <option value={5}>5 - Muito Bom</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 flex justify-end gap-3 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-xl">
                <button 
                  type="button" 
                  onClick={() => setShowEvalModal(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium"
                >
                  Salvar Avaliação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
