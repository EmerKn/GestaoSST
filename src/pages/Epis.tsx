import { useState, useEffect } from "react";
import { Search, Plus, Package, X, Save, FileText, Shield, Loader2, Search as SearchIcon, ClipboardList, Trash2, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { fetchSettings, addStandardHeaderToPDF, addStandardFooterToPDF, CompanySettings } from "../utils/pdfUtils";
import { useAuth } from "../contexts/AuthContext";
import { ImageUpload } from "../components/ImageUpload";
import RelatorioEPI from "./RelatorioEPI";
import { supabase } from "../lib/supabase";
import { filterRealData } from "./Funcionarios";
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'missing_key' });

interface PPE {
  id: number;
  name: string;
  ca: string;
  price: number;
  photo_url: string;
  stock: number;
  last_purchase_date?: string;
  validity_date?: string;
  commercial_name?: string;
  description?: string;
  complementary_data?: string;
}

export default function Epis() {
  const { canEdit, isMobile } = useAuth();
  const [activeTab, setActiveTab] = useState<"estoque" | "entregas" | "relatorios">("estoque");
  const [employees, setEmployees] = useState<any[]>([]);
  const [cart, setCart] = useState<{ppe_id: number; quantity: number}[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [ppes, setPpes] = useState<PPE[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [consultingCA, setConsultingCA] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    ca: "",
    price: "",
    photo_url: "",
    stock: "",
    last_purchase_date: "",
    validity_date: "",
    commercial_name: "",
    description: "",
    complementary_data: ""
  });

  const canEditPage = canEdit && !isMobile;

  const loadPpes = async () => {
    try {
      const { data, error } = await supabase.from('ppes').select('*').order('name');
      if (error) throw error;
      if (data) setPpes(filterRealData(data));
    } catch (error) {
      console.error("Error loading PPEs:", error);
    }
  };

  useEffect(() => {
    loadPpes();
    loadExtra();
  }, []);

  const loadExtra = async () => {
    const [empRes, setRes] = await Promise.all([
      supabase.from('employees').select('id, name, sector, role, admission_date').eq('status', 'Ativo').order('name'),
      fetchSettings()
    ]);
    if (empRes.data) setEmployees(filterRealData(empRes.data));
    setSettings(setRes);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photo_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageSelect = (file: File) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photo_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const openNewModal = () => {
    setEditingId(null);
    setFormData({ 
      name: "", ca: "", price: "", photo_url: "", stock: "", 
      last_purchase_date: "", validity_date: "", commercial_name: "", 
      description: "", complementary_data: "" 
    });
    setShowModal(true);
  };

  const handleEditClick = (ppe: PPE) => {
    if (!canEditPage) return;
    setEditingId(ppe.id);
    setFormData({
      name: ppe.name,
      ca: ppe.ca,
      price: ppe.price.toString(),
      photo_url: ppe.photo_url,
      stock: ppe.stock.toString(),
      last_purchase_date: ppe.last_purchase_date || "",
      validity_date: ppe.validity_date || "",
      commercial_name: ppe.commercial_name || "",
      description: ppe.description || "",
      complementary_data: ppe.complementary_data || ""
    });
    setShowModal(true);
  };

  const handleConsultCA = async () => {
    if (!formData.ca) return alert("Digite o número do CA primeiro.");
    
    setConsultingCA(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Busque informações sobre o CA ${formData.ca} no site consultaca.com. Retorne Nome do EPI, Nome Comercial, Descrição Completa, Dados Complementares e URL de uma foto do equipamento (se houver).`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Nome do EPI" },
              commercial_name: { type: Type.STRING, description: "Nome Comercial" },
              description: { type: Type.STRING, description: "Descrição Completa" },
              complementary_data: { type: Type.STRING, description: "Dados Complementares" },
              photo_url: { type: Type.STRING, description: "URL da foto do equipamento" }
            }
          }
        }
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("Resposta vazia do Gemini");
      
      const data = JSON.parse(jsonText);
      
      setFormData(prev => ({
        ...prev,
        name: data.name || prev.name,
        commercial_name: data.commercial_name || prev.commercial_name,
        description: data.description || prev.description,
        complementary_data: data.complementary_data || prev.complementary_data,
        photo_url: data.photo_url || prev.photo_url
      }));
      
      alert("Dados do CA importados com sucesso!");
    } catch (error) {
      console.error("Error consulting CA:", error);
      alert("Erro ao consultar o CA. Verifique o número e tente novamente.");
    } finally {
      setConsultingCA(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        ca: formData.ca,
        price: parseFloat(formData.price),
        photo_url: formData.photo_url,
        stock: parseInt(formData.stock, 10),
        last_purchase_date: formData.last_purchase_date || null,
        validity_date: formData.validity_date || null,
        commercial_name: formData.commercial_name || null,
        description: formData.description || null,
        complementary_data: formData.complementary_data || null
      };

      if (editingId) {
        const { error } = await supabase.from('ppes').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ppes').insert([payload]);
        if (error) throw error;
      }
      
      setShowModal(false);
      setFormData({ 
        name: "", ca: "", price: "", photo_url: "", stock: "", 
        last_purchase_date: "", validity_date: "", commercial_name: "", 
        description: "", complementary_data: "" 
      });
      setEditingId(null);
      loadPpes();
    } catch (error) {
      console.error("Error saving PPE:", error);
      alert("Erro ao salvar EPI.");
    }
  };

  const handleAddToCart = (ppe_id: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.ppe_id === ppe_id);
      if (existing) {
        return prev.map(item => item.ppe_id === ppe_id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ppe_id, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (ppe_id: number) => {
    setCart(prev => prev.filter(item => item.ppe_id !== ppe_id));
  };

  const handleCheckout = async () => {
    if (!selectedEmployeeId || cart.length === 0) return alert("Selecione um funcionário e adicione EPIs.");
    const emp = employees.find(e => e.id.toString() === selectedEmployeeId);
    
    // Validar estoque primeiro
    for (const item of cart) {
      const ppe = ppes.find(p => p.id === item.ppe_id);
      if (!ppe || ppe.stock < item.quantity) {
        return alert("Estoque insuficiente para " + (ppe?.name || "EPI desconhecido"));
      }
    }

    try {
      const inserts = cart.map(item => ({
        employee_id: parseInt(selectedEmployeeId),
        ppe_id: item.ppe_id,
        quantity: item.quantity,
        delivery_date: deliveryDate
      }));
      
      const { error } = await supabase.from('ppe_deliveries').insert(inserts);
      if (error) throw error;
      
      generateReceiptPDF(emp, cart, deliveryDate);
      setCart([]);
      setSelectedEmployeeId("");
      loadPpes(); 
    } catch (err) {
       console.error(err);
       alert("Erro ao salvar entregas.");
    }
  };

  const generateReceiptPDF = (emp: any, finalCart: any[], date: string) => {
    const doc = new jsPDF();
    let currentY = addStandardHeaderToPDF(doc, settings, "Ficha de Fornecimento de EPI");
    
    doc.setFontSize(10);
    doc.text(`Funcionário: ` + emp.name, 14, currentY);
    doc.text(`Setor: ` + emp.sector, 14, currentY + 6);
    doc.text(`Cargo: ` + emp.role, 14, currentY + 12);
    doc.text(`Data de Admissão: ` + (emp.admission_date ? format(parseISO(emp.admission_date), 'dd/MM/yyyy') : '-'), 14, currentY + 18);
    currentY += 28;

    const tableRows = finalCart.map(item => {
      const ppe = ppes.find(p => p.id === item.ppe_id);
      return [
        format(parseISO(date), "dd/MM/yyyy"),
        ppe?.ca || '-',
        ppe?.name || '-',
        ppe?.description || ppe?.commercial_name || '-',
        item.quantity.toString()
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [["Data da Entrega", "C.A.", "EPI", "Descrição", "Qtd"]],
      body: tableRows,
    });

    let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 30 : currentY + 40;
    
    // Assinaturas
    doc.setDrawColor(0);
    doc.line(20, finalY, 90, finalY);
    doc.line(120, finalY, 190, finalY);
    doc.setFontSize(10);
    doc.text(emp.name, 55, finalY + 5, { align: 'center' });
    doc.text("Assinatura do Funcionário", 55, finalY + 10, { align: 'center' });
    
    if (settings?.resp_signature) {
       doc.addImage(settings.resp_signature, 'PNG', 135, finalY - 20, 40, 15);
    }
    doc.text(settings?.resp_name || "Responsável SST", 155, finalY + 5, { align: 'center' });
    doc.text("Assinatura do Responsável SST", 155, finalY + 10, { align: 'center' });

    addStandardFooterToPDF(doc, settings, finalY + 30);
    
    setPdfPreviewUrl(doc.output('datauristring'));
  };
  const filtered = ppes.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.ca.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
          <Shield className="w-8 h-8 text-emerald-600" />
          Gestão de EPIs
        </h1>
        
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("estoque")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition ${
              activeTab === "estoque" 
                ? "bg-white text-emerald-700 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Estoque</span>
          </button>
          <button
            onClick={() => setActiveTab("entregas")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition ${
              activeTab === "entregas" 
                ? "bg-white text-emerald-700 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">Entregas</span>
          </button>
          <button
            onClick={() => setActiveTab("relatorios")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition ${
              activeTab === "relatorios" 
                ? "bg-white text-emerald-700 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Relatórios</span>
          </button>
        </div>
      </div>

      {activeTab === "estoque" ? (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800">Controle de Estoque</h2>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Buscar EPI ou CA..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none placeholder:text-gray-400"
                />
              </div>
              {canEditPage && (
                <button 
                  onClick={openNewModal}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium"
                >
                  <Plus className="w-5 h-5" />
                  <span>Novo EPI</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(ppe => (
              <div key={ppe.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div 
                  className={`h-48 bg-gray-100 relative ${canEditPage ? 'cursor-pointer hover:opacity-90 transition' : ''}`}
                  onClick={() => handleEditClick(ppe)}
                >
              <img 
                src={ppe.photo_url} 
                alt={ppe.name} 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-gray-700 shadow-sm">
                CA: {ppe.ca}
              </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <h3 className="text-lg font-bold text-gray-900 mb-1">{ppe.name}</h3>
              <p className="text-emerald-600 font-semibold mb-4">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ppe.price)}
              </p>
              
              <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-600">
                  <Package className="w-5 h-5" />
                  <span className="text-sm font-medium">Estoque:</span>
                </div>
                <span className={`font-bold ${ppe.stock < 10 ? 'text-red-600' : 'text-gray-900'}`}>
                  {ppe.stock} un
                </span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200 border-dashed">
            Nenhum EPI encontrado.
          </div>
        )}
      </div>
      </>
      ) : activeTab === "entregas" ? (
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-emerald-600" /> Nova Entrega de EPI</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário Destino</label>
                    <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg">
                      <option value="">Selecione o Recebedor...</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name} - {e.sector}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data da Retirada</label>
                    <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg"/>
                 </div>
              </div>

              {selectedEmployeeId && (
                 <div className="bg-emerald-50 p-4 rounded-lg mb-6 flex flex-wrap gap-8">
                    <div><span className="text-sm text-gray-500 block">Setor</span><span className="font-bold text-emerald-900">{employees.find(e => e.id.toString() === selectedEmployeeId)?.sector}</span></div>
                    <div><span className="text-sm text-gray-500 block">Cargo</span><span className="font-bold text-emerald-900">{employees.find(e => e.id.toString() === selectedEmployeeId)?.role}</span></div>
                    <div><span className="text-sm text-gray-500 block">Admissão</span><span className="font-bold text-emerald-900">{employees.find(e => e.id.toString() === selectedEmployeeId)?.admission_date ? format(parseISO(employees.find(e => e.id.toString() === selectedEmployeeId)!.admission_date), 'dd/MM/yyyy') : '-'}</span></div>
                 </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {/* Catálogo */}
                 <div>
                    <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Catálogo Disponível ({ppes.filter(p => p.stock > 0).length})</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                       {ppes.filter(p => p.stock > 0).map(ppe => (
                          <div key={ppe.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg hover:border-emerald-500 transition">
                             <div>
                               <div className="font-bold text-sm text-gray-900">{ppe.name} <span className="text-xs font-normal text-gray-500 bg-gray-100 px-1 rounded">CA {ppe.ca}</span></div>
                               <div className="text-xs text-gray-500">Estoque: {ppe.stock} un</div>
                             </div>
                             <button onClick={() => handleAddToCart(ppe.id)} className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded hover:bg-emerald-200 transition text-sm font-medium"><Plus className="w-4 h-4"/></button>
                          </div>
                       ))}
                       {ppes.filter(p => p.stock > 0).length === 0 && <p className="text-sm text-gray-500 italic py-4">Não há EPIs com saldo no estoque.</p>}
                    </div>
                 </div>

                 {/* Carrinho */}
                 <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col">
                    <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Itens Selecionados para Entrega ({cart.length})</h3>
                    <div className="flex-1 space-y-3 overflow-y-auto mb-4">
                       {cart.length === 0 && <p className="text-sm text-gray-500 text-center py-8 italic">Nenhum item selecionado</p>}
                       {cart.map((item, index) => {
                          const ppe = ppes.find(p => p.id === item.ppe_id);
                          return (
                            <div key={index} className="flex justify-between items-center bg-white p-3 border border-gray-200 rounded-lg shadow-sm">
                               <div className="flex flex-col">
                                  <span className="font-bold text-sm text-gray-900">{ppe?.name}</span>
                                  <span className="text-xs text-gray-500">Qtd a entregar: {item.quantity} un</span>
                               </div>
                               <button onClick={() => handleRemoveFromCart(item.ppe_id)} className="text-red-500 hover:bg-red-50 p-2 rounded transition"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          );
                       })}
                    </div>
                    {cart.length > 0 && <button onClick={handleCheckout} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 transition shadow-sm"><Save className="w-5 h-5"/> Concluir e Gerar Recibo</button>}
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <RelatorioEPI />
      )}

      {pdfPreviewUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
             <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-xl font-bold">Ficha de Entrega de EPI</h2>
                <button onClick={() => setPdfPreviewUrl(null)} className="text-gray-500 hover:text-gray-900 transition"><X className="w-6 h-6"/></button>
             </div>
             <iframe src={pdfPreviewUrl} className="flex-1 w-full bg-gray-100" title="PDF Ficha" />
             <div className="p-4 border-t flex justify-end gap-3">
                <button onClick={() => setPdfPreviewUrl(null)} className="px-4 py-2 hover:bg-gray-100 text-gray-700 font-medium rounded-lg transition">Fechar</button>
                <a href={pdfPreviewUrl} download={`Ficha_EPI_${format(new Date(), "yyyy-MM-dd")}.pdf`} onClick={() => setPdfPreviewUrl(null)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium">
                   <Download className="w-4 h-4"/> Baixar PDF
                </a>
             </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? "Editar EPI" : "Novo EPI"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                      <span>CA</span>
                      {formData.ca && (
                        <a 
                          href={`https://consultaca.com/${formData.ca.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Ver no site
                        </a>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <input required type="text" name="ca" value={formData.ca} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: 36253" />
                      <button 
                        type="button" 
                        onClick={handleConsultCA}
                        disabled={consultingCA || !formData.ca}
                        className="flex items-center justify-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 whitespace-nowrap"
                      >
                        {consultingCA ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />}
                        <span className="text-sm font-medium">Consultar CA</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do EPI</label>
                    <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Comercial</label>
                    <input type="text" name="commercial_name" value={formData.commercial_name} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Validade do CA</label>
                    <input type="date" name="validity_date" value={formData.validity_date} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Completa</label>
                  <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} className="w-full p-2 border border-gray-300 rounded-lg resize-none placeholder:text-gray-400" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dados Complementares</label>
                  <textarea name="complementary_data" value={formData.complementary_data} onChange={handleInputChange} rows={2} className="w-full p-2 border border-gray-300 rounded-lg resize-none placeholder:text-gray-400" />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                    <input required type="number" step="0.01" name="price" value={formData.price} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estoque</label>
                    <input required type="number" name="stock" value={formData.stock} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Última Compra</label>
                    <input type="date" name="last_purchase_date" value={formData.last_purchase_date} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                  </div>
                </div>
                
                {formData.price && formData.stock && (
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex justify-between items-center">
                    <span className="text-sm font-medium text-emerald-800">Valor Total em Estoque:</span>
                    <span className="font-bold text-emerald-700">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(formData.price) * parseInt(formData.stock, 10))}
                    </span>
                  </div>
                )}

                <div>
                  <ImageUpload
                    label="Foto do EPI"
                    currentImage={formData.photo_url}
                    onImageSelect={handleImageSelect}
                    required={!editingId && !formData.photo_url}
                  />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition font-medium">
                    Cancelar
                  </button>
                  <button type="submit" className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium">
                    <Save className="w-5 h-5" />
                    {editingId ? "Salvar Alterações" : "Salvar EPI"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
