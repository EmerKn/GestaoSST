import React, { useState, useEffect } from 'react';
import { Package, Shield, Loader2, ArrowUpRight, BarChart2, Download, TrendingUp, X } from 'lucide-react';
import { format, parseISO, startOfMonth, startOfYear } from 'date-fns';
import { fetchSettings, CompanySettings, addStandardHeaderToPDF, addStandardFooterToPDF } from '../utils/pdfUtils';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PPE {
  id: number;
  name: string;
  ca: string;
  price: number;
  stock: number;
}

interface PPEDelivery {
  id: number;
  ppe_id: number;
  employee_id: number;
  delivery_date: string;
  quantity: number;
  ppes?: { name: string; price: number };
  employees?: { name: string; sector: string };
}

export default function RelatorioEPI() {
  const [loading, setLoading] = useState(true);
  const [ppes, setPpes] = useState<PPE[]>([]);
  const [deliveries, setDeliveries] = useState<PPEDelivery[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [reportPeriod, setReportPeriod] = useState<"mensal" | "anual">("mensal");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ppesResponse, deliveriesResponse, settingsData] = await Promise.all([
        supabase.from('ppes').select('*').order('name'),
        supabase.from('ppe_deliveries').select('*, ppes(name, price), employees(name, sector)'),
        fetchSettings()
      ]);
      
      if (ppesResponse.data) setPpes(ppesResponse.data);
      if (deliveriesResponse.data) setDeliveries(deliveriesResponse.data);
      setSettings(settingsData);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  const now = new Date();
  const startDate = reportPeriod === "mensal" ? startOfMonth(now) : startOfYear(now);

  const periodDeliveries = deliveries.filter(d => parseISO(d.delivery_date) >= startDate);

  const totalDelivered = periodDeliveries.reduce((acc, d) => acc + d.quantity, 0);

  // Group by Sector
  const getUsageBySector = () => {
    const count: Record<string, number> = {};
    periodDeliveries.forEach(d => {
      const sec = d.employees?.sector || "Não Informado";
      count[sec] = (count[sec] || 0) + d.quantity;
    });
    return Object.keys(count).map(k => ({ setor: k, entregas: count[k] })).sort((a,b) => b.entregas - a.entregas);
  };

  // Group by PPE
  const getTopPpes = () => {
    const map: Record<number, { name: string; quantity: number; price: number; totalR$: number }> = {};
    periodDeliveries.forEach(d => {
      if (!map[d.ppe_id]) {
        const ppeData = ppes.find(p => p.id === d.ppe_id);
        map[d.ppe_id] = { name: ppeData?.name || d.ppes?.name || "Desconhecido", quantity: 0, price: ppeData?.price || d.ppes?.price || 0, totalR$: 0 };
      }
      map[d.ppe_id].quantity += d.quantity;
      map[d.ppe_id].totalR$ += (map[d.ppe_id].price * d.quantity);
    });
    return Object.values(map).sort((a,b) => b.quantity - a.quantity);
  };

  const topPpes = getTopPpes();
  const totalFinancialCost = topPpes.reduce((acc, item) => acc + item.totalR$, 0);

  const handleGeneratePDF = () => {
    const doc = new jsPDF();
    const title = reportPeriod === "mensal" ? "Relatório Mensal de Gestão de EPIs" : "Relatório Anual de Gestão de EPIs";
    let currentY = addStandardHeaderToPDF(doc, settings, title);
    
    doc.setFontSize(11);
    doc.text(`Período analisado: A partir de ${format(startDate, "dd/MM/yyyy")}`, 14, currentY);
    currentY += 8;
    doc.text(`Total de EPIs Entregues: ${totalDelivered} unidades`, 14, currentY);
    currentY += 8;
    doc.text(`Custo Estimado do Consumo: R$ ${totalFinancialCost.toFixed(2).replace('.', ',')}`, 14, currentY);
    currentY += 12;

    const sectorData = getUsageBySector();
    doc.setFontSize(12);
    doc.text("Distribuição por Setor", 14, currentY);
    currentY += 6;
    
    autoTable(doc, {
      startY: currentY,
      head: [["Setor Destino", "Total Unidades Retiradas"]],
      body: sectorData.map(s => [s.setor, s.entregas.toString()]),
      margin: { bottom: 20 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    doc.text("EPIs Mais Fornecidos (Ordem Decrescente)", 14, currentY);
    currentY += 6;
    
    autoTable(doc, {
      startY: currentY,
      head: [["Equipamento / EPI", "Qtd. Total", "Custo T. (R$)"]],
      body: topPpes.map(item => [item.name, item.quantity.toString(), `R$ ${item.totalR$.toFixed(2).replace('.', ',')}`]),
      margin: { bottom: 20 }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 30;
    
    if (finalY > 260) {
      doc.addPage();
      finalY = 40;
    }

    // Assinaturas
    doc.setDrawColor(0);
    doc.line(60, finalY, 150, finalY);
    doc.setFontSize(10);
    
    if (settings?.resp_signature) {
       doc.addImage(settings.resp_signature, 'PNG', 85, finalY - 20, 40, 15);
    }
    doc.text(settings?.resp_name || "Responsável Almoxarifado/SST", 105, finalY + 5, { align: 'center' });
    doc.text("Encarregado de SST", 105, finalY + 10, { align: 'center' });

    addStandardFooterToPDF(doc, settings, finalY + 30);
    
    setPdfPreviewUrl(doc.output('datauristring'));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Relatório Estratégico de EPIs</h2>
          <p className="text-gray-500">Métricas financeiras e logísticas por distribuição setorial</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={reportPeriod}
            onChange={(e) => setReportPeriod(e.target.value as any)}
            className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="mensal">Consumo do Mês</option>
            <option value="anual">Consumo Anual</option>
          </select>
          <button 
            onClick={handleGeneratePDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition"
          >
            <Download className="w-4 h-4" />
            Exportar A4 PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight className="w-6 h-6 text-orange-600" />
            <h3 className="text-lg font-bold text-orange-900">Total de Entregas</h3>
          </div>
          <p className="text-4xl font-black text-orange-700">{totalDelivered} <span className="text-lg font-medium">un</span></p>
        </div>
        <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100 flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
            <h3 className="text-lg font-bold text-emerald-900">Total Gasto Previsto (R$)</h3>
          </div>
          <p className="text-4xl font-black text-emerald-700">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(totalFinancialCost)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-emerald-600" />
            Volume Entregue por Setor
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getUsageBySector()} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="setor" tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#ECFDF5' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="entregas" name="EPIs Lançados" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600"/> Tabela Decrescente de Custo e Gasto
           </h3>
           <div className="overflow-x-auto max-h-64 pr-2">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-100 bg-gray-50 text-gray-600 sticky top-0">
                    <th className="py-3 px-3 font-bold">EPI Equipamento</th>
                    <th className="py-3 px-3 font-bold text-center">Quantidade</th>
                    <th className="py-3 px-3 font-bold text-right">Custo Somado</th>
                  </tr>
                </thead>
                <tbody>
                  {topPpes.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium text-gray-900">{item.name}</td>
                      <td className="py-3 px-3 text-center font-bold text-gray-700">{item.quantity}</td>
                      <td className="py-3 px-3 text-right font-medium text-emerald-700">
                         {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalR$)}
                      </td>
                    </tr>
                  ))}
                  {topPpes.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-500 italic">Nenhuma entrega registrada neste período.</td>
                    </tr>
                  )}
                </tbody>
              </table>
           </div>
        </div>
      </div>

      {pdfPreviewUrl && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">
             <div className="flex justify-between items-center p-4 border-b">
                <h2 className="text-xl font-bold">Pré-visualização do Relatório Oficial</h2>
                <button onClick={() => setPdfPreviewUrl(null)} className="text-gray-500 hover:text-gray-900 transition"><X className="w-6 h-6"/></button>
             </div>
             <iframe src={pdfPreviewUrl} className="flex-1 w-full bg-gray-100" title="PDF Ficha" />
             <div className="p-4 border-t flex justify-end gap-3">
                <button onClick={() => setPdfPreviewUrl(null)} className="px-4 py-2 hover:bg-gray-100 text-gray-700 font-medium rounded-lg transition">Fechar</button>
                <a href={pdfPreviewUrl} download={`Relatorio_EPI_${format(new Date(), "yyyy-MM-dd")}.pdf`} onClick={() => setPdfPreviewUrl(null)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium">
                   <Download className="w-4 h-4"/> Baixar PDF
                </a>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
