import { useState, useEffect } from "react";
import { Plus, Search, FileText, Download, Trash2, Edit, FlaskConical, Flame, Bomb, Skull, AlertTriangle, HeartPulse, Leaf, Cylinder, X, Upload } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { GoogleGenAI, Type } from "@google/genai";
import { format } from "date-fns";
import { SelectWithNew } from "../components/SelectWithNew";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchSettings, addStandardHeaderToPDF, addStandardFooterToPDF, CompanySettings } from "../utils/pdfUtils";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'missing_key' });

interface ChemicalProduct {
  id: string;
  trade_name: string;
  product_name: string;
  chemical_composition: string;
  required_ppe: string;
  pictograms: string[];
  fispq_url: string;
  sectors: string[];
  roles: string[];
  created_at: string;
}

const GHS_PICTOGRAMS = [
  "Explosivo",
  "Inflamável",
  "Comburente",
  "Gás sob pressão",
  "Corrosivo",
  "Tóxico",
  "Irritante",
  "Perigo à saúde",
  "Perigoso ao meio ambiente"
];

const getPictogramIcon = (name: string) => {
  switch (name) {
    case "Explosivo": return <Bomb className="w-5 h-5 text-red-600" />;
    case "Inflamável": return <Flame className="w-5 h-5 text-orange-500" />;
    case "Comburente": return <Flame className="w-5 h-5 text-yellow-500" />;
    case "Gás sob pressão": return <Cylinder className="w-5 h-5 text-gray-500" />;
    case "Corrosivo": return <FlaskConical className="w-5 h-5 text-purple-600" />;
    case "Tóxico": return <Skull className="w-5 h-5 text-black" />;
    case "Irritante": return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    case "Perigo à saúde": return <HeartPulse className="w-5 h-5 text-red-500" />;
    case "Perigoso ao meio ambiente": return <Leaf className="w-5 h-5 text-green-600" />;
    default: return <AlertTriangle className="w-5 h-5 text-gray-400" />;
  }
};

export default function ProdutosQuimicos() {
  const { canEdit, isMobile } = useAuth();
  const canEditPage = canEdit && !isMobile;

  const [products, setProducts] = useState<ChemicalProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  // PDF Preview State
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState<string>("");

  const [formData, setFormData] = useState<{
    trade_name: string;
    product_name: string;
    chemical_composition: string;
    required_ppe: string;
    pictograms: string[];
    fispq_url: string;
    sectors: string[];
    roles: string[];
  }>({
    trade_name: "",
    product_name: "",
    chemical_composition: "",
    required_ppe: "",
    pictograms: [],
    fispq_url: "",
    sectors: [],
    roles: []
  });

  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [prodRes, empRes, setRes] = await Promise.all([
        supabase.from('produtos_quimicos').select('*').order('created_at', { ascending: false }),
        supabase.from('employees').select('sector, role'),
        fetchSettings()
      ]);

      if (prodRes.data) setProducts(prodRes.data);
      if (empRes.data) {
        const sectors = Array.from(new Set(empRes.data.map(e => e.sector).filter(Boolean)));
        const roles = Array.from(new Set(empRes.data.map(e => e.role).filter(Boolean)));
        setAvailableSectors(sectors);
        setAvailableRoles(roles);
      }
      setSettings(setRes);
    } catch (error) {
      console.error("Error loading chemical products:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Por favor, selecione um arquivo PDF da FISPQ.");
      return;
    }

    setExtracting(true);
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = (reader.result as string).split(',')[1];
      
      try {
        // 1. Extrair dados com Gemini PRIMEIRO (mesmo se o upload falhar)
        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview", // Usando o modelo pro para melhor extração de PDF
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: base64Data
                }
              },
              {
                text: "Extraia as seguintes informações desta FISPQ: nome fantasia (trade_name), nome do produto (product_name), composição química (chemical_composition), EPI necessários para o uso (required_ppe), e identifique quais dos seguintes pictogramas GHS se aplicam (Explosivo, Inflamável, Comburente, Gás sob pressão, Corrosivo, Tóxico, Irritante, Perigo à saúde, Perigoso ao meio ambiente) (pictograms)."
              }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                trade_name: { type: Type.STRING },
                product_name: { type: Type.STRING },
                chemical_composition: { type: Type.STRING },
                required_ppe: { type: Type.STRING },
                pictograms: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              }
            }
          }
        });

        const extractedData = JSON.parse(response.text || "{}");
        
        // 2. Tentar fazer o upload para o Supabase
        let publicUrl = "";
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `fispqs/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file);

          if (!uploadError) {
            const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
            publicUrl = data.publicUrl;
          } else {
            console.warn("Upload to Supabase failed (bucket might not exist):", uploadError);
          }
        } catch (uploadErr) {
          console.warn("Error during Supabase upload:", uploadErr);
        }
        
        setFormData(prev => ({
          ...prev,
          trade_name: extractedData.trade_name || "",
          product_name: extractedData.product_name || "",
          chemical_composition: extractedData.chemical_composition || "",
          required_ppe: extractedData.required_ppe || "",
          pictograms: extractedData.pictograms || [],
          fispq_url: publicUrl
        }));
      } catch (aiError) {
        console.error("Error extracting data with Gemini:", aiError);
        alert("Não foi possível extrair os dados automaticamente. Por favor, preencha manualmente.");
      } finally {
        setExtracting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from('produtos_quimicos')
        .insert([formData]);

      if (error) throw error;
      
      setShowAddModal(false);
      setFormData({
        trade_name: "",
        product_name: "",
        chemical_composition: "",
        required_ppe: "",
        pictograms: [],
        fispq_url: "",
        sectors: [],
        roles: []
      });
      loadData();
    } catch (error) {
      console.error("Error saving chemical product:", error);
      alert("Erro ao salvar produto químico.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este produto?")) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from('produtos_quimicos').delete().eq('id', id);
      
      if (error) {
        console.error("Error deleting chemical product:", error);
        alert(`Erro ao excluir produto: ${error.message}`);
      } else {
        setProducts(prev => prev.filter(p => p.id !== id));
        alert("Produto excluído com sucesso!");
      }
    } catch (error: any) {
      console.error("Error deleting chemical product:", error);
      alert("Ocorreu um erro inesperado ao excluir o produto.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    let currentY = addStandardHeaderToPDF(doc, settings, "Relatório de Produtos Químicos");
    
    doc.setFontSize(12);
    doc.text(`Total de Produtos Cadastrados: ${products.length}`, 14, currentY);
    
    const tableColumn = ["Nome Fantasia", "Produto", "Composição Química", "Pictogramas"];
    const tableRows = products.map(p => [
      p.trade_name,
      p.product_name || "-",
      p.chemical_composition || "-",
      p.pictograms?.join(", ") || "-"
    ]);
    
    autoTable(doc, {
      startY: currentY + 10,
      head: [tableColumn],
      body: tableRows,
      headStyles: { fillColor: [0, 0, 0] },
      columnStyles: {
        2: { cellWidth: 60 },
        3: { cellWidth: 40 }
      }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 20;
    addStandardFooterToPDF(doc, settings, finalY);
    
    const pdfDataUri = doc.output('datauristring');
    setPdfPreviewUrl(pdfDataUri);
    setPdfPreviewTitle(`Relatorio_Produtos_Quimicos_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const filteredProducts = products.filter(p => 
    p.trade_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.chemical_composition?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Produtos Químicos e FISPQ</h1>
        <div className="flex gap-2">
          <button onClick={handleExportPDF} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium">
            <Download className="w-5 h-5" /> Gerar Relatório
          </button>
          {canEditPage && (
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
              <Plus className="w-5 h-5" /> Novo Produto
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, produto ou composição química..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map(product => (
          <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{product.trade_name}</h3>
                {product.product_name && <p className="text-sm text-gray-500">{product.product_name}</p>}
              </div>
              <div className="flex gap-2">
                {product.fispq_url && (
                  <a href={product.fispq_url} target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-800" title="Ver FISPQ">
                    <FileText className="w-5 h-5" />
                  </a>
                )}
                {canEditPage && (
                  <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-4">
              {product.chemical_composition && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Composição Química</p>
                  <p className="text-sm text-gray-700 line-clamp-2">{product.chemical_composition}</p>
                </div>
              )}
              
              {product.required_ppe && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">EPIs Necessários</p>
                  <p className="text-sm text-gray-700 line-clamp-2">{product.required_ppe}</p>
                </div>
              )}

              {product.pictograms && product.pictograms.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pictogramas GHS</p>
                  <div className="flex flex-wrap gap-2">
                    {product.pictograms.map((pic, idx) => (
                      <div key={idx} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md text-xs font-medium text-gray-700" title={pic}>
                        {getPictogramIcon(pic)}
                        <span className="hidden sm:inline">{pic}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(product.sectors?.length > 0 || product.roles?.length > 0) && (
                <div className="pt-4 border-t border-gray-100 mt-auto">
                  {product.sectors?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Setores</p>
                      <div className="flex flex-wrap gap-1">
                        {product.sectors.map((s, i) => <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{s}</span>)}
                      </div>
                    </div>
                  )}
                  {product.roles?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Funções</p>
                      <div className="flex flex-wrap gap-1">
                        {product.roles.map((r, i) => <span key={i} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{r}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
            Nenhum produto químico encontrado.
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">Novo Produto Químico</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <h3 className="text-lg font-medium text-emerald-900 mb-1">Upload da FISPQ (PDF)</h3>
                <p className="text-sm text-emerald-700 mb-4">Faça o upload da FISPQ para preencher os dados automaticamente com IA.</p>
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={handleFileUpload} 
                    disabled={extracting}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
                  />
                  <button type="button" disabled={extracting} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50">
                    {extracting ? "Extraindo dados..." : "Selecionar PDF"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia *</label>
                  <input required type="text" value={formData.trade_name} onChange={e => setFormData({...formData, trade_name: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
                  <input type="text" value={formData.product_name} onChange={e => setFormData({...formData, product_name: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Composição Química</label>
                  <textarea value={formData.chemical_composition} onChange={e => setFormData({...formData, chemical_composition: e.target.value})} rows={3} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">EPIs Necessários</label>
                  <textarea value={formData.required_ppe} onChange={e => setFormData({...formData, required_ppe: e.target.value})} rows={2} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pictogramas GHS</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {GHS_PICTOGRAMS.map(pic => (
                      <label key={pic} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input 
                          type="checkbox" 
                          checked={formData.pictograms.includes(pic)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({...formData, pictograms: [...formData.pictograms, pic]});
                            } else {
                              setFormData({...formData, pictograms: formData.pictograms.filter(p => p !== pic)});
                            }
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        {getPictogramIcon(pic)}
                        <span className="text-sm text-gray-700">{pic}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Setores que utilizam (Múltipla escolha)</label>
                  <div className="flex flex-wrap gap-4 mb-3 p-3 border border-gray-200 rounded-lg bg-gray-50 max-h-48 overflow-y-auto">
                    {availableSectors.map(s => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                        <input 
                          type="checkbox" 
                          checked={formData.sectors.includes(s)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({...formData, sectors: [...formData.sectors, s]});
                            } else {
                              setFormData({...formData, sectors: formData.sectors.filter(x => x !== s)});
                            }
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">{s}</span>
                      </label>
                    ))}
                    {availableSectors.length === 0 && <span className="text-sm text-gray-500">Nenhum setor encontrado nos cadastros.</span>}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Ou digite um novo setor e aperte Enter para adicionar..."
                      className="flex-1 p-2 border border-gray-300 rounded-lg text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = e.currentTarget.value.trim();
                          if (val && !formData.sectors.includes(val)) {
                            setFormData({...formData, sectors: [...formData.sectors, val]});
                            if (!availableSectors.includes(val)) {
                              setAvailableSectors([...availableSectors, val].sort());
                            }
                          }
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                  </div>
                  {/* Custom added sectors that are not in availableSectors yet (just in case) */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.sectors.filter(s => !availableSectors.includes(s)).map(s => (
                      <span key={s} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                        {s}
                        <button type="button" onClick={() => setFormData({...formData, sectors: formData.sectors.filter(x => x !== s)})} className="text-blue-600 hover:text-blue-900"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Funções que utilizam (Múltipla escolha)</label>
                  <div className="flex flex-wrap gap-4 mb-3 p-3 border border-gray-200 rounded-lg bg-gray-50 max-h-48 overflow-y-auto">
                    {availableRoles.map(r => (
                      <label key={r} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                        <input 
                          type="checkbox" 
                          checked={formData.roles.includes(r)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({...formData, roles: [...formData.roles, r]});
                            } else {
                              setFormData({...formData, roles: formData.roles.filter(x => x !== r)});
                            }
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span className="text-sm text-gray-700">{r}</span>
                      </label>
                    ))}
                    {availableRoles.length === 0 && <span className="text-sm text-gray-500">Nenhuma função encontrada nos cadastros.</span>}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Ou digite uma nova função e aperte Enter para adicionar..."
                      className="flex-1 p-2 border border-gray-300 rounded-lg text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = e.currentTarget.value.trim();
                          if (val && !formData.roles.includes(val)) {
                            setFormData({...formData, roles: [...formData.roles, val]});
                            if (!availableRoles.includes(val)) {
                              setAvailableRoles([...availableRoles, val].sort());
                            }
                          }
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                  </div>
                  {/* Custom added roles that are not in availableRoles yet */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.roles.filter(r => !availableRoles.includes(r)).map(r => (
                      <span key={r} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                        {r}
                        <button type="button" onClick={() => setFormData({...formData, roles: formData.roles.filter(x => x !== r)})} className="text-purple-600 hover:text-purple-900"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition">
                  Cancelar
                </button>
                <button type="submit" disabled={loading || extracting} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition disabled:opacity-50">
                  {loading ? "Salvando..." : "Salvar Produto"}
                </button>
              </div>
            </form>
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
