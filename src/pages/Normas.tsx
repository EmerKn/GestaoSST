import { useState, useEffect, useRef } from "react";
import { BookOpen, Plus, Search, FileText, Calendar, Edit, Trash2, Download, Printer, FileDown } from "lucide-react";
import { format, parseISO, addYears } from "date-fns";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import Editor from 'react-simple-wysiwyg';
import { fetchSettings, addStandardHeaderToPDF, addStandardFooterToPDF, CompanySettings } from "../utils/pdfUtils";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { ImageUpload } from "../components/ImageUpload";

interface Standard {
  id: number;
  code: string;
  title: string;
  revision: string;
  date: string;
  description: string;
  file_url: string;
}

interface StandardData {
  text: string;
  content: string;
  creation_date: string;
  revision_date: string;
  safety_resp_name: string;
  safety_resp_role: string;
  safety_resp_signature: string;
  requester_name: string;
  requester_role: string;
  requester_signature: string;
  validity_date: string;
}

const parseDescription = (desc: string): StandardData => {
  try {
    if (desc && desc.startsWith('{')) {
      return JSON.parse(desc);
    }
  } catch (e) {}
  
  const today = format(new Date(), "yyyy-MM-dd");
  const nextYear = format(addYears(new Date(), 1), "yyyy-MM-dd");
  
  return {
    text: desc || "",
    content: "",
    creation_date: today,
    revision_date: today,
    safety_resp_name: "",
    safety_resp_role: "",
    safety_resp_signature: "",
    requester_name: "",
    requester_role: "",
    requester_signature: "",
    validity_date: nextYear,
  };
};

const stringifyDescription = (data: StandardData): string => {
  return JSON.stringify(data);
};

const flowchartTemplate = `
<table style="width: 100%; border-collapse: collapse; text-align: center; margin: 20px 0;" border="1">
  <tbody>
    <tr>
      <td style="padding: 10px; background-color: #f3f4f6; font-weight: bold;">Início</td>
    </tr>
    <tr>
      <td style="padding: 10px;">↓</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 2px solid #10b981;">Passo 1: Identificação do Risco</td>
    </tr>
    <tr>
      <td style="padding: 10px;">↓</td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 2px solid #f59e0b; border-radius: 10px;">Decisão: Risco Aceitável?</td>
    </tr>
    <tr>
      <td style="padding: 10px;">
        <div style="display: flex; justify-content: space-around;">
          <span>Sim → Fim</span>
          <span>Não ↓</span>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding: 10px; border: 2px solid #ef4444;">Passo 2: Implementar Medidas de Controle</td>
    </tr>
    <tr>
      <td style="padding: 10px;">↓</td>
    </tr>
    <tr>
      <td style="padding: 10px; background-color: #f3f4f6; font-weight: bold;">Fim</td>
    </tr>
  </tbody>
</table>
<p><br></p>
`;

export default function Normas() {
  const { canEdit, canPrint, isMobile } = useAuth();
  const canEditPage = canEdit;
  const [standards, setStandards] = useState<Standard[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [search, setSearch] = useState("");
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStandard, setEditingStandard] = useState<Standard | null>(null);
  
  const [formData, setFormData] = useState<Partial<Standard>>({
    code: "",
    title: "",
    revision: "01",
    date: format(new Date(), "yyyy-MM-dd"),
    file_url: ""
  });
  
  const [extData, setExtData] = useState<StandardData>(parseDescription(""));

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [standardsRes, settingsRes] = await Promise.all([
        supabase.from('standards').select('*').order('code'),
        fetchSettings()
      ]);

      if (standardsRes.data) setStandards(standardsRes.data);
      setSettings(settingsRes);
    } catch (error) {
      console.error("Error loading standards data:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleExtInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setExtData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditorChange = (e: any) => {
    setExtData(prev => ({ ...prev, content: e.target.value }));
  };

  const insertFlowchart = () => {
    setExtData(prev => ({ ...prev, content: prev.content + flowchartTemplate }));
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

  const handleSignatureChange = (file: File, field: 'safety_resp_signature' | 'requester_signature') => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setExtData(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getNextCode = (stds: Standard[]) => {
    if (stds.length === 0) return "NR-01";
    let maxNum = 0;
    let prefix = "NR-";
    
    stds.forEach(s => {
      const match = s.code.match(/([A-Za-z]+[- ]?)(\d+)/);
      if (match) {
        const num = parseInt(match[2], 10);
        if (num > maxNum) {
          maxNum = num;
          prefix = match[1];
        }
      }
    });
    
    if (maxNum === 0) return `NR-${String(stds.length + 1).padStart(2, '0')}`;
    return `${prefix}${String(maxNum + 1).padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...formData,
        description: stringifyDescription(extData)
      };
      
      if (editingStandard) {
        const { error } = await supabase.from('standards').update(dataToSave).eq('id', editingStandard.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('standards').insert([dataToSave]);
        if (error) throw error;
      }
      closeModal();
      loadData();
    } catch (error) {
      console.error("Error saving standard:", error);
      alert("Erro ao salvar norma.");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir esta norma?")) {
      try {
        const { error } = await supabase.from('standards').delete().eq('id', id);
        if (error) throw error;
        loadData();
      } catch (error) {
        console.error("Error deleting standard:", error);
        alert("Erro ao excluir norma.");
      }
    }
  };

  const openAddModal = () => {
    const nextCode = getNextCode(standards);
    const today = format(new Date(), "yyyy-MM-dd");
    const nextYear = format(addYears(new Date(), 1), "yyyy-MM-dd");
    
    setEditingStandard(null);
    setFormData({
      code: nextCode,
      title: "",
      revision: "01",
      date: today,
      file_url: ""
    });
    
    setExtData({
      text: "",
      content: "",
      creation_date: today,
      revision_date: today,
      safety_resp_name: "",
      safety_resp_role: "",
      safety_resp_signature: "",
      requester_name: "",
      requester_role: "",
      requester_signature: "",
      validity_date: nextYear,
    });
    
    setShowAddModal(true);
  };

  const openEditModal = (standard: Standard) => {
    setEditingStandard(standard);
    setFormData({
      code: standard.code,
      title: standard.title,
      revision: standard.revision,
      date: standard.date,
      file_url: standard.file_url
    });
    setExtData(parseDescription(standard.description));
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingStandard(null);
  };

  const handleDownloadNormPDF = async (standard: Standard) => {
    if (standard.file_url && standard.file_url.startsWith('data:application/pdf')) {
      const link = document.createElement('a');
      link.href = standard.file_url;
      link.download = `${standard.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    
    const ext = parseDescription(standard.description);
    
    const tempDiv = document.createElement('div');
    tempDiv.style.width = '800px';
    tempDiv.style.padding = '40px';
    tempDiv.style.backgroundColor = 'white';
    tempDiv.style.color = 'black';
    tempDiv.style.fontFamily = 'Arial, sans-serif';
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    
    tempDiv.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1f2937; padding-bottom: 20px;">
        ${settings?.company_logo ? `<img src="${settings.company_logo}" style="max-height: 60px; margin-bottom: 10px;" />` : ''}
        <h2 style="margin: 0; color: #1f2937;">${settings?.company_name || 'SST Gestão'}</h2>
        <h1 style="margin: 10px 0; color: #111827;">${standard.title}</h1>
        <p style="margin: 0; font-size: 14px; color: #4b5563;">
          <strong>Código:</strong> ${standard.code} | <strong>Revisão:</strong> ${standard.revision}
        </p>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; background: #f3f4f6; padding: 10px; border-radius: 8px;">
        <div>
          <p style="margin: 2px 0;"><strong>Data de Criação:</strong> ${format(parseISO(ext.creation_date || standard.date), "dd/MM/yyyy")}</p>
          <p style="margin: 2px 0;"><strong>Data de Revisão:</strong> ${format(parseISO(ext.revision_date || standard.date), "dd/MM/yyyy")}</p>
        </div>
        <div>
          <p style="margin: 2px 0;"><strong>Validade:</strong> ${format(parseISO(ext.validity_date || standard.date), "dd/MM/yyyy")}</p>
        </div>
      </div>
      <div style="margin-bottom: 20px;">
        <h3 style="border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Objetivo / Descrição:</h3>
        <p style="white-space: pre-wrap;">${ext.text || "Nenhuma descrição fornecida."}</p>
      </div>
      <div style="margin-bottom: 40px;">
        <h3 style="border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Conteúdo da Norma:</h3>
        <div style="line-height: 1.6;">${ext.content || ""}</div>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 60px; page-break-inside: avoid;">
        <div style="text-align: center; width: 45%;">
          ${ext.safety_resp_signature ? `<img src="${ext.safety_resp_signature}" style="max-width: 150px; max-height: 50px; margin-bottom: 10px;" />` : '<div style="height: 60px;"></div>'}
          <div style="border-top: 1px solid black; padding-top: 5px;">
            <strong>${ext.safety_resp_name || 'Responsável Segurança'}</strong><br/>
            <span style="font-size: 12px; color: #4b5563;">${ext.safety_resp_role || 'Cargo'}</span>
          </div>
        </div>
        <div style="text-align: center; width: 45%;">
          ${ext.requester_signature ? `<img src="${ext.requester_signature}" style="max-width: 150px; max-height: 50px; margin-bottom: 10px;" />` : '<div style="height: 60px;"></div>'}
          <div style="border-top: 1px solid black; padding-top: 5px;">
            <strong>${ext.requester_name || 'Solicitante'}</strong><br/>
            <span style="font-size: 12px; color: #4b5563;">${ext.requester_role || 'Cargo'}</span>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(tempDiv);
    
    try {
      const canvas = await html2canvas(tempDiv, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`${standard.title}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Erro ao gerar PDF da norma.");
    } finally {
      document.body.removeChild(tempDiv);
    }
  };

  const filtered = standards.filter(s => {
    const ext = parseDescription(s.description);
    return s.title?.toLowerCase().includes(search.toLowerCase()) ||
           s.code?.toLowerCase().includes(search.toLowerCase()) ||
           ext.text?.toLowerCase().includes(search.toLowerCase());
  });

  const handleExportPDF = () => {
    const doc = new jsPDF();
    let currentY = addStandardHeaderToPDF(doc, settings, "Catálogo de Normas e Procedimentos");
    
    doc.setFontSize(12);
    doc.text(`Total de Normas: ${standards.length}`, 14, currentY);
    currentY += 10;

    autoTable(doc, {
      startY: currentY,
      head: [["Código", "Título", "Revisão", "Data", "Descrição"]],
      body: standards.map(s => {
        const ext = parseDescription(s.description);
        return [
          s.code,
          s.title,
          s.revision,
          format(parseISO(ext.creation_date || s.date), "dd/MM/yyyy"),
          ext.text
        ];
      }),
      headStyles: { fillColor: [0, 0, 0] },
    });

    addStandardFooterToPDF(doc, settings, (doc as any).lastAutoTable.finalY + 20);
    doc.save(`Catalogo_Normas_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: "Catalogo_Normas",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
          <BookOpen className="w-8 h-8 text-emerald-600" />
          Normas e Procedimentos
        </h1>
        {canPrint && (
          <div className="flex gap-2">
            <button onClick={() => handlePrint()} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
              <Printer className="w-4 h-4" /> Imprimir Catálogo
            </button>
            <button onClick={handleExportPDF} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
              <Download className="w-4 h-4" /> PDF
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar norma por código, título ou descrição..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none placeholder:text-gray-400"
            />
          </div>
          {canEditPage && (
            <button onClick={openAddModal} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
              <Plus className="w-5 h-5" /> Adicionar Norma
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" ref={reportRef}>
          {/* Print Header */}
          <div className="hidden print:block col-span-full mb-8 border-b-2 border-gray-800 pb-4">
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
                <p className="font-bold text-gray-800">Catálogo de Normas e Procedimentos</p>
                <p>Emissão: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
              </div>
            </div>
          </div>

          {filtered.map(standard => {
            const ext = parseDescription(standard.description);
            return (
              <div key={standard.id} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden flex flex-col print:break-inside-avoid">
                <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-start">
                  <div className="flex-1 cursor-pointer" onClick={() => openEditModal(standard)}>
                    <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded mb-2">
                      {standard.code}
                    </span>
                    <h3 className="font-bold text-gray-900 line-clamp-2 hover:text-emerald-600 transition" title={standard.title}>{standard.title}</h3>
                  </div>
                  {canEditPage && (
                    <div className="flex gap-1 print:hidden ml-2">
                      <button onClick={() => openEditModal(standard)} className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-md hover:bg-emerald-50 transition" title="Editar">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(standard.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col cursor-pointer" onClick={() => openEditModal(standard)}>
                  <p className="text-sm text-gray-600 mb-4 flex-1 line-clamp-3" title={ext.text}>
                    {ext.text || "Nenhuma descrição fornecida."}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {ext.creation_date ? format(parseISO(ext.creation_date), "dd/MM/yyyy") : "-"}
                    </div>
                    <span className="font-medium">Rev: {standard.revision}</span>
                  </div>
                </div>
                <div className="p-3 bg-white border-t border-gray-200 print:hidden flex gap-2">
                  <button 
                    onClick={() => handleDownloadNormPDF(standard)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition text-sm font-medium"
                  >
                    <FileDown className="w-4 h-4" />
                    Baixar Norma (.pdf)
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              Nenhuma norma encontrada.
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900">{editingStandard ? "Editar Norma" : "Nova Norma / Procedimento"}</h2>
              <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto">
                
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                    <input required type="text" name="code" value={formData.code || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: NR-01" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título da Norma</label>
                    <input required type="text" name="title" value={formData.title || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Título da norma" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nº Revisão</label>
                    <input required type="text" name="revision" value={formData.revision || ""} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: 01" />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Criação</label>
                    <input required type="date" name="creation_date" value={extData.creation_date} onChange={handleExtInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Revisão</label>
                    <input required type="date" name="revision_date" value={extData.revision_date} onChange={handleExtInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Validade Máxima</label>
                    <input required type="date" name="validity_date" value={extData.validity_date} onChange={handleExtInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição / Objetivo</label>
                  <textarea name="text" value={extData.text} onChange={handleExtInputChange} rows={2} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Breve descrição ou objetivo da norma..."></textarea>
                </div>

                {/* Rich Text Editor */}
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 p-2 border-b border-gray-300 flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Conteúdo da Norma</span>
                    <button type="button" onClick={insertFlowchart} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded hover:bg-emerald-200 transition font-medium">
                      + Inserir Modelo de Fluxograma
                    </button>
                  </div>
                  <Editor 
                    value={extData.content} 
                    onChange={handleEditorChange}
                    containerProps={{ style: { height: '300px', overflowY: 'auto' } }}
                  />
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  {/* Safety Responsible */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 border-b border-gray-200 pb-2">Responsável da Segurança</h4>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Nome</label>
                      <input type="text" name="safety_resp_name" value={extData.safety_resp_name} onChange={handleExtInputChange} className="w-full p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400" placeholder="Nome completo" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Cargo</label>
                      <input type="text" name="safety_resp_role" value={extData.safety_resp_role} onChange={handleExtInputChange} className="w-full p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400" placeholder="Ex: Eng. de Segurança" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Assinatura (Imagem)</label>
                      <input type="file" accept="image/*" onChange={(e) => e.target.files && handleSignatureChange(e.target.files[0], 'safety_resp_signature')} className="w-full text-sm" />
                      {extData.safety_resp_signature && (
                        <img src={extData.safety_resp_signature} alt="Assinatura" className="mt-2 h-12 object-contain border border-gray-200 bg-white p-1 rounded" />
                      )}
                    </div>
                  </div>

                  {/* Requester */}
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 border-b border-gray-200 pb-2">Solicitante da Troca/Revisão</h4>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Nome</label>
                      <input type="text" name="requester_name" value={extData.requester_name} onChange={handleExtInputChange} className="w-full p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400" placeholder="Nome completo" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Cargo</label>
                      <input type="text" name="requester_role" value={extData.requester_role} onChange={handleExtInputChange} className="w-full p-2 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400" placeholder="Ex: Gerente de Produção" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Assinatura (Imagem)</label>
                      <input type="file" accept="image/*" onChange={(e) => e.target.files && handleSignatureChange(e.target.files[0], 'requester_signature')} className="w-full text-sm" />
                      {extData.requester_signature && (
                        <img src={extData.requester_signature} alt="Assinatura" className="mt-2 h-12 object-contain border border-gray-200 bg-white p-1 rounded" />
                      )}
                    </div>
                  </div>
                </div>

                {/* File Upload (Optional override) */}
                <div className="border-t border-gray-200 pt-4">
                  <ImageUpload
                    label="Ou anexe um PDF pronto (Substitui o conteúdo acima ao baixar)"
                    name="file_url"
                    currentImage={formData.file_url}
                    onImageSelect={handleFileChange}
                    accept=".pdf,image/*"
                  />
                </div>

              </div>

              <div className="p-6 flex justify-end gap-3 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-xl">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium">Salvar Norma</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
