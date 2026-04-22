import React, { useState, useEffect, useRef } from 'react';
import { FileText, Upload, Printer, Plus, X, Loader2, TrendingUp, AlertTriangle, Shield, Calendar, CheckCircle, Edit2, Save } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { fetchSettings, CompanySettings } from '../utils/pdfUtils';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || 'missing_key' });

interface ActionItem {
  id: string;
  description: string;
  priority: 'Alta' | 'Média' | 'Baixa';
  deadline: string;
  status: 'Pendente' | 'Em Andamento' | 'Concluído';
}

interface SectorFunctionActions {
  sector: string;
  function: string;
  problems: string[];
  actions: ActionItem[];
}

interface LaudoReport {
  id: number;
  year: number;
  title: string;
  summary: string;
  actions_by_sector_function: SectorFunctionActions[];
  created_at: string;
}

export default function Laudos() {
  const { canEdit, isMobile } = useAuth();
  const [reports, setReports] = useState<LaudoReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<LaudoReport | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [editingAction, setEditingAction] = useState<{ sectorIdx: number, actionIdx: number } | null>(null);
  const [editActionData, setEditActionData] = useState<Partial<ActionItem>>({});

  const [pgrData, setPgrData] = useState<{ file: File | null, year: number | '' }>({ file: null, year: new Date().getFullYear() });
  const [ergoData, setErgoData] = useState<{ file: File | null, year: number | '' }>({ file: null, year: new Date().getFullYear() });
  const [psicoData, setPsicoData] = useState<{ file: File | null, year: number | '' }>({ file: null, year: new Date().getFullYear() });

  const [formData, setFormData] = useState({
    title: `Laudos Integrados ${new Date().getFullYear()}`,
  });

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Relatorio_Laudos_${selectedReport?.year}`,
    pageStyle: `
      @page { size: A4; margin: 15mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; }
        .no-print { display: none !important; }
      }
    `
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [reportsRes, settingsRes] = await Promise.all([
        supabase.from('laudos').select('*').order('year', { ascending: false }),
        fetchSettings()
      ]);
      
      if (reportsRes.data) setReports(reportsRes.data);
      setSettings(settingsRes);
    } catch (error) {
      console.error("Error loading laudos:", error);
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pgrData.file || !ergoData.file || !psicoData.file) {
      return alert("Atenção: É necessário anexar os 3 laudos (PGR, Avaliação Ergonômica e Avaliação Psicossocial) para realizar a integração.");
    }

    if (pgrData.year !== ergoData.year || ergoData.year !== psicoData.year) {
      return alert("Atenção: Os laudos anexados não são do mesmo ano. Por favor, realize a troca ou a inserção do laudo correto para que a integração seja possível.");
    }
    
    setUploading(true);
    try {
      const parts: any[] = [];
      
      parts.push({ text: "Documento 1: PGR" });
      parts.push({ inlineData: { data: await fileToBase64(pgrData.file), mimeType: 'application/pdf' } });
      
      parts.push({ text: "Documento 2: Avaliação Ergonômica" });
      parts.push({ inlineData: { data: await fileToBase64(ergoData.file), mimeType: 'application/pdf' } });
      
      parts.push({ text: "Documento 3: Avaliação Psicossocial" });
      parts.push({ inlineData: { data: await fileToBase64(psicoData.file), mimeType: 'application/pdf' } });

      parts.push({
        text: `Analise os laudos fornecidos (PGR, Avaliação Ergonômica, Avaliação Psicossocial).
        1. Ache pontos comuns e cruze as informações dos 3 laudos.
        2. Crie um resumo curto (tamanho máximo de uma folha A4) com as informações cruzadas.
        3. Identifique os riscos e classifique-os por prioridade (Alta, Média, Baixa).
        4. Crie um relatório por setor. Para CADA setor, liste de forma resumida os 10 principais riscos/problemas encontrados.
        5. Para cada um desses problemas, defina ações necessárias baseando-se nas normas de Segurança do Trabalho.
        6. Classifique as ações com prioridades e defina prazos para concluir.
        Gere um ID único (string aleatória curta) para cada ação.`
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-preview',
        contents: [{ parts }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: "Resumo cruzado dos laudos (máx 1 página A4)" },
              actions_by_sector_function: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sector: { type: Type.STRING },
                    function: { type: Type.STRING, description: "Função ou 'Geral' se aplicar a todo o setor" },
                    problems: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista dos 10 principais problemas/riscos identificados no setor" },
                    actions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          description: { type: Type.STRING, description: "Ação necessária baseada nas normas" },
                          priority: { type: Type.STRING, enum: ["Alta", "Média", "Baixa"] },
                          deadline: { type: Type.STRING, description: "Prazo para conclusão" },
                          status: { type: Type.STRING, enum: ["Pendente", "Em Andamento", "Concluído"] }
                        },
                        required: ["id", "description", "priority", "deadline", "status"]
                      }
                    }
                  },
                  required: ["sector", "function", "problems", "actions"]
                }
              }
            },
            required: ["summary", "actions_by_sector_function"]
          }
        }
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("Resposta vazia do Gemini");
      
      const analysisData = JSON.parse(jsonText);

      const payload = {
        year: pgrData.year,
        title: formData.title,
        summary: analysisData.summary,
        actions_by_sector_function: analysisData.actions_by_sector_function
      };

      const { error } = await supabase.from('laudos').insert([payload]);
      if (error) throw error;

      setShowModal(false);
      setPgrData({ file: null, year: new Date().getFullYear() });
      setErgoData({ file: null, year: new Date().getFullYear() });
      setPsicoData({ file: null, year: new Date().getFullYear() });
      loadData();
      alert("Laudos analisados e salvos com sucesso!");
    } catch (error) {
      console.error("Error analyzing laudos:", error);
      alert("Erro ao analisar os documentos. Verifique se são PDFs válidos e tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  const openReport = (report: LaudoReport) => {
    setSelectedReport(report);
  };

  const handleEditAction = (sectorIdx: number, actionIdx: number, action: ActionItem) => {
    setEditingAction({ sectorIdx, actionIdx });
    setEditActionData({
      priority: action.priority,
      deadline: action.deadline,
      status: action.status
    });
  };

  const saveActionEdit = async () => {
    if (!selectedReport || !editingAction) return;

    const newReport = { ...selectedReport };
    const action = newReport.actions_by_sector_function[editingAction.sectorIdx].actions[editingAction.actionIdx];
    
    action.priority = editActionData.priority as any || action.priority;
    action.deadline = editActionData.deadline || action.deadline;
    action.status = editActionData.status as any || action.status;

    try {
      const { error } = await supabase
        .from('laudos')
        .update({ actions_by_sector_function: newReport.actions_by_sector_function })
        .eq('id', newReport.id);

      if (error) throw error;
      
      setSelectedReport(newReport);
      setReports(reports.map(r => r.id === newReport.id ? newReport : r));
      setEditingAction(null);
    } catch (error) {
      console.error("Error updating action:", error);
      alert("Erro ao salvar a ação.");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
          <FileText className="w-8 h-8 text-emerald-600" />
          Gestão de Laudos Integrados
        </h1>
        {canEdit && (
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium"
          >
            <Upload className="w-5 h-5" />
            Importar Novos Laudos
          </button>
        )}
      </div>

      {!selectedReport ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map(report => (
            <div key={report.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer" onClick={() => openReport(report)}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 p-3 rounded-lg text-emerald-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{report.title}</h3>
                    <p className="text-sm text-gray-500">Ano Base: {report.year}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600 line-clamp-3 mb-4">{report.summary}</p>
              <div className="flex justify-between items-center text-sm font-medium text-emerald-600">
                <span>Ver Relatório Completo</span>
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <div className="col-span-full p-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum laudo encontrado</h3>
              <p className="text-gray-500">Faça o upload dos arquivos PDF para gerar as análises.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <button onClick={() => setSelectedReport(null)} className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-2">
              &larr; Voltar para lista
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition font-medium">
              <Printer className="w-5 h-5" />
              Imprimir Relatório A4
            </button>
          </div>

          <div className="overflow-x-auto bg-gray-100 p-4 sm:p-8 rounded-xl flex justify-center">
            <div ref={printRef} className="bg-white w-[210mm] min-h-[297mm] p-[15mm] shadow-lg text-gray-900 text-sm">
              
              <div className="flex justify-between items-center border-b-2 border-emerald-800 pb-6 mb-6">
                <div className="flex items-center gap-4">
                  {settings?.company_logo && (
                    <img src={settings.company_logo} alt="Logo" className="h-16 object-contain" referrerPolicy="no-referrer" />
                  )}
                  <div>
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">{settings?.company_name || "Empresa"}</h1>
                    <p className="text-emerald-700 font-bold text-lg">Relatório Integrado de Laudos</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-lg font-black text-xl">
                    Ano {selectedReport.year}
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h2 className="text-lg font-bold text-emerald-800 border-b border-gray-200 pb-2 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" /> Resumo Cruzado dos Laudos
                </h2>
                <p className="text-gray-700 leading-relaxed text-justify whitespace-pre-wrap">{selectedReport.summary}</p>
              </div>

              <div className="mb-8">
                <h2 className="text-lg font-bold text-emerald-800 border-b border-gray-200 pb-2 mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5" /> Problemas e Ações por Setor e Função
                </h2>
                <div className="space-y-8">
                  {selectedReport.actions_by_sector_function?.map((item, sIdx) => (
                    <div key={sIdx} className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                        <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-bold text-sm">
                          Setor: {item.sector}
                        </span>
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold text-sm">
                          Função: {item.function}
                        </span>
                      </div>
                      
                      <div className="mb-4">
                        <h4 className="font-bold text-red-800 mb-2 text-sm flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" /> Problemas Identificados:
                        </h4>
                        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                          {item.problems.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-bold text-emerald-800 mb-3 text-sm flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" /> Plano de Ação (Normas de Segurança)
                        </h4>
                        <div className="space-y-3">
                          {item.actions.map((action, aIdx) => {
                            const isEditing = editingAction?.sectorIdx === sIdx && editingAction?.actionIdx === aIdx;
                            return (
                              <div key={action.id || aIdx} className="bg-white p-3 rounded border border-gray-200 shadow-sm">
                                <div className="flex justify-between items-start gap-4">
                                  <p className="text-sm text-gray-800 font-medium flex-1">{action.description}</p>
                                  {canEdit && !isEditing && (
                                    <button onClick={() => handleEditAction(sIdx, aIdx, action)} className="text-gray-400 hover:text-emerald-600 no-print">
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                                
                                {isEditing ? (
                                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded border border-gray-200 no-print">
                                    <div>
                                      <label className="block text-xs font-bold text-gray-700 mb-1">Prioridade</label>
                                      <select 
                                        value={editActionData.priority} 
                                        onChange={e => setEditActionData({...editActionData, priority: e.target.value as any})}
                                        className="w-full text-sm p-1.5 border rounded"
                                      >
                                        <option value="Alta">Alta</option>
                                        <option value="Média">Média</option>
                                        <option value="Baixa">Baixa</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-gray-700 mb-1">Prazo</label>
                                      <input 
                                        type="text" 
                                        value={editActionData.deadline} 
                                        onChange={e => setEditActionData({...editActionData, deadline: e.target.value})}
                                        className="w-full text-sm p-1.5 border rounded"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
                                      <select 
                                        value={editActionData.status} 
                                        onChange={e => setEditActionData({...editActionData, status: e.target.value as any})}
                                        className="w-full text-sm p-1.5 border rounded"
                                      >
                                        <option value="Pendente">Pendente</option>
                                        <option value="Em Andamento">Em Andamento</option>
                                        <option value="Concluído">Concluído</option>
                                      </select>
                                    </div>
                                    <div className="sm:col-span-3 flex justify-end gap-2 mt-2">
                                      <button onClick={() => setEditingAction(null)} className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancelar</button>
                                      <button onClick={saveActionEdit} className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 flex items-center gap-1">
                                        <Save className="w-3 h-3" /> Salvar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span className={`text-xs px-2 py-1 rounded font-bold ${
                                      action.priority === 'Alta' ? 'bg-red-100 text-red-800' : 
                                      action.priority === 'Média' ? 'bg-amber-100 text-amber-800' : 
                                      'bg-green-100 text-green-800'
                                    }`}>
                                      Prioridade: {action.priority}
                                    </span>
                                    <span className="text-xs px-2 py-1 rounded font-bold bg-blue-100 text-blue-800">
                                      Prazo: {action.deadline}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded font-bold ${
                                      action.status === 'Concluído' ? 'bg-emerald-100 text-emerald-800' : 
                                      action.status === 'Em Andamento' ? 'bg-blue-100 text-blue-800' : 
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      Status: {action.status}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Importar Laudos</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="uploadForm" onSubmit={handleUpload} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título do Relatório Integrado</label>
                  <input 
                    type="text" 
                    required
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* PGR */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                      <FileText className="w-5 h-5" /> PGR
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Ano do Laudo</label>
                      <input 
                        type="number" 
                        required
                        value={pgrData.year} 
                        onChange={e => setPgrData({...pgrData, year: e.target.value ? parseInt(e.target.value) : ''})} 
                        className="w-full p-2 border border-gray-300 rounded text-sm placeholder:text-gray-400" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Arquivo PDF</label>
                      <label className="flex items-center justify-center gap-2 w-full text-sm bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded p-2 cursor-pointer transition font-medium">
                        <Upload className="w-4 h-4" />
                        <span className="truncate max-w-[150px]">{pgrData.file ? pgrData.file.name : 'Anexar Laudo'}</span>
                        <input 
                          type="file" 
                          accept=".pdf" 
                          required
                          onChange={e => setPgrData({...pgrData, file: e.target.files?.[0] || null})} 
                          className="hidden" 
                        />
                      </label>
                    </div>
                  </div>

                  {/* Avaliação Ergonômica */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                      <FileText className="w-5 h-5" /> Avaliação Ergonômica
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Ano do Laudo</label>
                      <input 
                        type="number" 
                        required
                        value={ergoData.year} 
                        onChange={e => setErgoData({...ergoData, year: e.target.value ? parseInt(e.target.value) : ''})} 
                        className="w-full p-2 border border-gray-300 rounded text-sm placeholder:text-gray-400" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Arquivo PDF</label>
                      <label className="flex items-center justify-center gap-2 w-full text-sm bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded p-2 cursor-pointer transition font-medium">
                        <Upload className="w-4 h-4" />
                        <span className="truncate max-w-[150px]">{ergoData.file ? ergoData.file.name : 'Anexar Laudo'}</span>
                        <input 
                          type="file" 
                          accept=".pdf" 
                          required
                          onChange={e => setErgoData({...ergoData, file: e.target.files?.[0] || null})} 
                          className="hidden" 
                        />
                      </label>
                    </div>
                  </div>

                  {/* Avaliação Psicossocial */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                      <FileText className="w-5 h-5" /> Avaliação Psicossocial
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Ano do Laudo</label>
                      <input 
                        type="number" 
                        required
                        value={psicoData.year} 
                        onChange={e => setPsicoData({...psicoData, year: e.target.value ? parseInt(e.target.value) : ''})} 
                        className="w-full p-2 border border-gray-300 rounded text-sm placeholder:text-gray-400" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Arquivo PDF</label>
                      <label className="flex items-center justify-center gap-2 w-full text-sm bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded p-2 cursor-pointer transition font-medium">
                        <Upload className="w-4 h-4" />
                        <span className="truncate max-w-[150px]">{psicoData.file ? psicoData.file.name : 'Anexar Laudo'}</span>
                        <input 
                          type="file" 
                          accept=".pdf" 
                          required
                          onChange={e => setPsicoData({...psicoData, file: e.target.files?.[0] || null})} 
                          className="hidden" 
                        />
                      </label>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 mt-1">
                  A IA lerá os documentos anexados, verificará se são do mesmo ano, cruzará as informações e criará um relatório consolidado com os 10 principais riscos por setor e seus planos de ação.
                </p>
              </form>
            </div>
            <div className="p-6 border-t border-gray-100 shrink-0 bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition font-medium">
                Cancelar
              </button>
              <button 
                type="submit" 
                form="uploadForm"
                disabled={uploading}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium disabled:opacity-50"
              >
                {uploading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Analisando...</>
                ) : (
                  <><Upload className="w-5 h-5" /> Importar e Analisar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
