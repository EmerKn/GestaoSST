import { useState, useEffect } from "react";
import { ClipboardList, Plus, X, Upload, FileText, Edit2, Trash2, Search } from "lucide-react";
import { format, addMonths } from "date-fns";
import { clsx } from "clsx";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { SectorBadge } from "../utils/sectorColors";
import { fetchSettings, CompanySettings, addStandardHeaderToPDF } from "../utils/pdfUtils";
import { useDatabaseOptions } from "../hooks/useDatabaseOptions";
import { SelectWithNew } from "../components/SelectWithNew";

interface ServiceOrder {
  id: number;
  job_role: string;
  sector: string;
  activities: string;
  hazards: string;
  risk_category: string;
  preventive_measures: string;
  required_ppe: string;
  emergency_procedures: string;
  prohibitions: string;
  worker_obligations: string;
  elaboration_date: string;
  revision_date: string;
  revision_reason: string;
  status: string;
  responsible_name: string;
  observations: string;
}

const RISK_CATEGORIES = ["Físico","Químico","Biológico","Ergonômico","Acidente","Psicossocial"];

export default function OrdensServico() {
  const { canEdit } = useAuth();
  const { sectors, roles } = useDatabaseOptions();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [formData, setFormData] = useState({
    job_role: "", sector: "", activities: "", hazards: "",
    risk_category: "", preventive_measures: "", required_ppe: "",
    emergency_procedures: "", prohibitions: "", worker_obligations: "",
    elaboration_date: format(new Date(), "yyyy-MM-dd"),
    revision_date: format(addMonths(new Date(), 24), "yyyy-MM-dd"),
    revision_reason: "", status: "Vigente", responsible_name: "", observations: ""
  });

  const loadData = async () => {
    const [res, s] = await Promise.all([
      supabase.from("service_orders").select("*").order("sector").order("job_role"),
      fetchSettings()
    ]);
    if (res.data) setOrders(res.data);
    setSettings(s);
    if (s?.resp_name && !formData.responsible_name) {
      setFormData(prev => ({ ...prev, responsible_name: s.resp_name }));
    }
  };

  useEffect(() => { loadData(); }, []);

  const resetForm = () => {
    setFormData({
      job_role: "", sector: "", activities: "", hazards: "",
      risk_category: "", preventive_measures: "", required_ppe: "",
      emergency_procedures: "", prohibitions: "", worker_obligations: "",
      elaboration_date: format(new Date(), "yyyy-MM-dd"),
      revision_date: format(addMonths(new Date(), 24), "yyyy-MM-dd"),
      revision_reason: "", status: "Vigente",
      responsible_name: settings?.resp_name || "", observations: ""
    });
    setEditingId(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase.from("service_orders").update(formData).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("service_orders").insert([formData]);
        if (error) throw error;
        // Create agenda event for revision
        if (formData.revision_date) {
          await supabase.from("agenda_events").insert([{
            title: `Revisão OS: ${formData.job_role} - ${formData.sector}`,
            date: formData.revision_date,
            description: `Fiscalizar revisão da Ordem de Serviço da função ${formData.job_role} no setor ${formData.sector} conforme NR-01.`
          }]);
        }
      }
      setShowModal(false);
      resetForm();
      loadData();
      alert(editingId ? "OS atualizada!" : "OS criada e evento adicionado à Agenda!");
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar OS.");
    }
  };

  const handleEdit = (o: ServiceOrder) => {
    setFormData({
      job_role: o.job_role, sector: o.sector, activities: o.activities || "",
      hazards: o.hazards || "", risk_category: o.risk_category || "",
      preventive_measures: o.preventive_measures || "", required_ppe: o.required_ppe || "",
      emergency_procedures: o.emergency_procedures || "", prohibitions: o.prohibitions || "",
      worker_obligations: o.worker_obligations || "", elaboration_date: o.elaboration_date,
      revision_date: o.revision_date || "", revision_reason: o.revision_reason || "",
      status: o.status, responsible_name: o.responsible_name || "", observations: o.observations || ""
    });
    setEditingId(o.id);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir esta Ordem de Serviço?")) return;
    await supabase.from("service_orders").delete().eq("id", id);
    loadData();
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][];
        if (!rows || rows.length < 2) { alert("Planilha vazia."); return; }

        const normalize = (s: any) => typeof s === "string" ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
        let hIdx = -1;
        let headers: string[] = [];
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          if (!Array.isArray(rows[i])) continue;
          const nr = rows[i].map(normalize);
          if (nr.some(h => ["setor","cargo","funcao","cargo/funcao","descricao das atividades","descricao"].includes(h))) {
            hIdx = i; headers = nr; break;
          }
        }
        if (hIdx === -1) { alert("Cabeçalho não encontrado. Use: setor, cargo/função, descrição das atividades"); return; }

        const sectorIdx = headers.findIndex(h => h === "setor");
        const roleIdx = headers.findIndex(h => ["cargo","funcao","cargo/funcao"].includes(h));
        const actIdx = headers.findIndex(h => ["descricao das atividades","descricao","atividades"].includes(h));

        if (sectorIdx === -1 || roleIdx === -1) { alert("Colunas 'setor' e 'cargo/função' são obrigatórias."); return; }

        const toInsert: any[] = [];
        for (let i = hIdx + 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || !r[roleIdx]) continue;
          toInsert.push({
            sector: r[sectorIdx] || "",
            job_role: r[roleIdx] || "",
            activities: actIdx >= 0 ? (r[actIdx] || "") : "",
            elaboration_date: format(new Date(), "yyyy-MM-dd"),
            revision_date: format(addMonths(new Date(), 24), "yyyy-MM-dd"),
            status: "Vigente",
            responsible_name: settings?.resp_name || ""
          });
        }
        if (toInsert.length === 0) { alert("Nenhum dado encontrado."); return; }

        const { error } = await supabase.from("service_orders").insert(toInsert);
        if (error) throw error;
        alert(`${toInsert.length} ordens de serviço importadas!`);
        loadData();
      } catch (err) { console.error(err); alert("Erro ao importar."); }
      finally { setImporting(false); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const generateSectorReport = () => {
    const doc = new jsPDF();
    addStandardHeaderToPDF(doc, settings, "Relatório de Ordens de Serviço por Setor");

    const grouped: Record<string, ServiceOrder[]> = {};
    orders.forEach(o => { if (!grouped[o.sector]) grouped[o.sector] = []; grouped[o.sector].push(o); });

    let y = 75;
    doc.setFontSize(10);
    doc.setFont("helvetica","normal");
    doc.setTextColor(0,0,0);
    doc.text(`Total de OS: ${orders.length}`, 14, y); y += 6;
    doc.text(`Vigentes: ${orders.filter(o=>o.status==="Vigente").length} | Revisadas: ${orders.filter(o=>o.status==="Revisada").length}`, 14, y);
    y += 12;

    const tableData = Object.entries(grouped).map(([sector, items]) => [
      sector,
      String(items.length),
      items.filter(i=>i.status==="Vigente").length.toString(),
      items.map(i => i.elaboration_date ? format(new Date(i.elaboration_date),"dd/MM/yyyy") : "-").join(", "),
      items.map(i => i.revision_date ? format(new Date(i.revision_date),"dd/MM/yyyy") : "-").join(", ")
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Setor","Total OS","Vigentes","Datas de Elaboração","Datas de Revisão"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [30,30,30], fontSize: 9 },
      styles: { fontSize: 8 }
    });

    doc.save(`Relatorio_OS_Setores_${format(new Date(),"yyyyMMdd")}.pdf`);
  };

  const filtered = orders.filter(o =>
    o.job_role.toLowerCase().includes(search.toLowerCase()) ||
    o.sector.toLowerCase().includes(search.toLowerCase())
  );

  const vigentes = orders.filter(o => o.status === "Vigente").length;
  const pendentes = orders.filter(o => {
    if (!o.revision_date) return false;
    return new Date(o.revision_date) <= new Date();
  }).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-blue-500" />
          Ordem de Serviço (NR-01)
        </h1>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <label className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition font-medium text-sm cursor-pointer">
                <Upload className="w-4 h-4" />
                {importing ? "Importando..." : "Importar Planilha"}
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} disabled={importing} />
              </label>
              <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium text-sm">
                <Plus className="w-4 h-4" /> Nova OS
              </button>
            </>
          )}
          <button onClick={generateSectorReport} className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition font-medium text-sm">
            <FileText className="w-4 h-4" /> Relatório por Setor
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500 uppercase">Total de OS</p>
          <p className="text-3xl font-bold text-gray-900">{orders.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500 uppercase">Vigentes</p>
          <p className="text-3xl font-bold text-emerald-600">{vigentes}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500 uppercase">Pendentes de Revisão</p>
          <p className="text-3xl font-bold text-orange-600">{pendentes}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-gray-500 uppercase">Setores</p>
          <p className="text-3xl font-bold text-blue-600">{new Set(orders.map(o=>o.sector)).size}</p>
        </div>
      </div>

      {/* Search + Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" placeholder="Buscar por função ou setor..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600 uppercase tracking-wider">
                <th className="p-4 font-medium">Função</th>
                <th className="p-4 font-medium">Setor</th>
                <th className="p-4 font-medium">Elaboração</th>
                <th className="p-4 font-medium">Revisão</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map(o => (
                <tr key={o.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-medium text-gray-900">{o.job_role}</td>
                  <td className="p-4"><SectorBadge sector={o.sector} /></td>
                  <td className="p-4 text-gray-700">{o.elaboration_date ? format(new Date(o.elaboration_date),"dd/MM/yyyy") : "-"}</td>
                  <td className={clsx("p-4 font-medium", o.revision_date && new Date(o.revision_date) <= new Date() ? "text-red-600" : "text-gray-700")}>
                    {o.revision_date ? format(new Date(o.revision_date),"dd/MM/yyyy") : "-"}
                  </td>
                  <td className="p-4">
                    <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-medium",
                      o.status === "Vigente" ? "bg-emerald-100 text-emerald-800" :
                      o.status === "Revisada" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"
                    )}>{o.status}</span>
                  </td>
                  <td className="p-4 text-right flex items-center justify-end gap-2">
                    {canEdit && (
                      <>
                        <button onClick={() => handleEdit(o)} className="p-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(o.id)} className="p-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Nenhuma ordem de serviço encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto pt-10">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 my-8">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-blue-600" />
                {editingId ? "Editar Ordem de Serviço" : "Nova Ordem de Serviço"}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Função / Cargo *</label>
                  <SelectWithNew name="job_role" required value={formData.job_role} onChange={handleChange} options={roles} placeholder="Selecione a função" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Setor *</label>
                  <SelectWithNew name="sector" required value={formData.sector} onChange={handleChange} options={sectors} placeholder="Selecione o setor" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição das Atividades *</label>
                <textarea name="activities" required value={formData.activities} onChange={handleChange} rows={3}
                  className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Descreva as atividades realizadas pelo trabalhador nesta função..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Perigos e Fatores de Risco *</label>
                <textarea name="hazards" required value={formData.hazards} onChange={handleChange} rows={3}
                  className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Identifique os perigos e riscos: ruído, poeira, postura inadequada, estresse, etc." />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categorias de Risco</label>
                <div className="flex flex-wrap gap-2">
                  {RISK_CATEGORIES.map(cat => {
                    const selected = (formData.risk_category || "").includes(cat);
                    return (
                      <button key={cat} type="button" onClick={() => {
                        const current = formData.risk_category ? formData.risk_category.split(", ").filter(Boolean) : [];
                        const next = selected ? current.filter(c => c !== cat) : [...current, cat];
                        setFormData({ ...formData, risk_category: next.join(", ") });
                      }} className={clsx("px-3 py-1.5 rounded-full text-xs font-medium border transition",
                        selected ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      )}>{cat}</button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medidas Preventivas *</label>
                  <textarea name="preventive_measures" required value={formData.preventive_measures} onChange={handleChange} rows={3}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Instruções de segurança e procedimentos operacionais..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EPIs Obrigatórios *</label>
                  <textarea name="required_ppe" required value={formData.required_ppe} onChange={handleChange} rows={3}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Lista dos EPIs necessários para a função..." />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Procedimentos de Emergência *</label>
                  <textarea name="emergency_procedures" required value={formData.emergency_procedures} onChange={handleChange} rows={3}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="O que fazer em caso de acidente ou doença do trabalho..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proibições *</label>
                  <textarea name="prohibitions" required value={formData.prohibitions} onChange={handleChange} rows={3}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Condutas vedadas ao trabalhador nesta função..." />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Obrigações do Trabalhador</label>
                <textarea name="worker_obligations" value={formData.worker_obligations} onChange={handleChange} rows={2}
                  className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Responsabilidades do colaborador conforme NR-01..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Elaboração *</label>
                  <input type="date" name="elaboration_date" required value={formData.elaboration_date} onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Próxima Revisão *</label>
                  <input type="date" name="revision_date" required value={formData.revision_date} onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select name="status" value={formData.status} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-lg">
                    <option>Vigente</option><option>Revisada</option><option>Cancelada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                  <input type="text" name="responsible_name" value={formData.responsible_name} onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-lg" />
                </div>
              </div>

              {editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo da Revisão</label>
                  <input type="text" name="revision_reason" value={formData.revision_reason} onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" placeholder="Ex: Mudança de processo, novo EPI, atualização do PGR..." />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea name="observations" value={formData.observations} onChange={handleChange} rows={2}
                  className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition">
                  {editingId ? "Salvar Alterações" : "Criar Ordem de Serviço"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
