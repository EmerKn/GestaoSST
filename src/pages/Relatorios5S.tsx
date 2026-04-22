import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { format, parseISO, startOfWeek, startOfMonth, startOfYear, isSameWeek, isSameMonth, isSameYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trophy, ArrowDown, ArrowUp, Calendar, Filter, Printer, Download } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchSettings, addStandardHeaderToPDF, addStandardFooterToPDF, CompanySettings } from "../utils/pdfUtils";
import { SectorBadge } from "../utils/sectorColors";
import { supabase } from "../lib/supabase";

export default function Relatorios5S() {
  const [data, setData] = useState<any[]>([]);
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  const reportRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [inspectionsRes, settingsRes] = await Promise.all([
          supabase.from('inspection_5s').select('*'),
          fetchSettings()
        ]);
        
        if (inspectionsRes.data) {
          setData(inspectionsRes.data);
        }
        setSettings(settingsRes);
      } catch (error) {
        console.error("Error loading 5S data:", error);
      }
    };
    
    loadData();
  }, []);

  // Process data based on selected period
  const processData = () => {
    if (!data.length) return { chartData: [], bestSector: null, worstSector: null };

    const now = new Date();
    let filteredData = data;

    if (period === "weekly") {
      filteredData = data.filter(d => isSameWeek(parseISO(d.date), now));
    } else if (period === "monthly") {
      filteredData = data.filter(d => isSameMonth(parseISO(d.date), now));
    } else if (period === "yearly") {
      filteredData = data.filter(d => isSameYear(parseISO(d.date), now));
    }

    // Group by sector
    const sectorScores: Record<string, number[]> = {};
    filteredData.forEach(d => {
      if (!sectorScores[d.sector]) sectorScores[d.sector] = [];
      sectorScores[d.sector].push(d.total_score);
    });

    // Calculate averages
    const chartData = Object.keys(sectorScores).map(sector => {
      const scores = sectorScores[sector];
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return {
        sector,
        score: parseFloat(avg.toFixed(1)),
        inspections: scores.length
      };
    }).sort((a, b) => b.score - a.score);

    const bestSector = chartData.length > 0 ? chartData[0] : null;
    const worstSector = chartData.length > 0 ? chartData[chartData.length - 1] : null;

    return { chartData, bestSector, worstSector };
  };

  const { chartData, bestSector, worstSector } = processData();

  // Process evolution data (monthly average for all sectors)
  const processEvolutionData = () => {
    const monthlyAverages: Record<string, { total: number, count: number }> = {};
    
    data.forEach(d => {
      const month = format(parseISO(d.date), "MMM/yy", { locale: ptBR });
      if (!monthlyAverages[month]) monthlyAverages[month] = { total: 0, count: 0 };
      monthlyAverages[month].total += d.total_score;
      monthlyAverages[month].count += 1;
    });

    return Object.keys(monthlyAverages).map(month => ({
      month,
      score: parseFloat((monthlyAverages[month].total / monthlyAverages[month].count).toFixed(1))
    })).reverse(); // Assuming data comes sorted by date DESC
  };

  const evolutionData = processEvolutionData();

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `Relatorio_5S_${format(new Date(), "yyyy-MM-dd")}`,
  });

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    let currentY = addStandardHeaderToPDF(doc, settings, "Relatório de Inspeções 5S");
    
    doc.setFontSize(12);
    doc.text(`Período: ${period === 'weekly' ? 'Semanal' : period === 'monthly' ? 'Mensal' : 'Anual'}`, 14, currentY);
    
    currentY += 10;
    
    if (bestSector) {
      doc.setFontSize(11);
      doc.setTextColor(21, 128, 61); // green-700
      doc.text(`Melhor Setor: ${bestSector.sector} (${bestSector.score.toFixed(1)} pts)`, 14, currentY);
      currentY += 6;
    }
    
    if (worstSector) {
      doc.setFontSize(11);
      doc.setTextColor(185, 28, 28); // red-700
      doc.text(`Pior Setor: ${worstSector.sector} (${worstSector.score.toFixed(1)} pts)`, 14, currentY);
      currentY += 10;
    }

    doc.setTextColor(0, 0, 0);
    
    autoTable(doc, {
      startY: currentY,
      head: [['Setor', 'Média de Pontuação', 'Qtd. Inspeções']],
      body: chartData.map(item => [item.sector, item.score.toFixed(1), item.inspections]),
      headStyles: { fillColor: [0, 0, 0] }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 20;
    
    addStandardFooterToPDF(doc, settings, finalY);

    doc.save(`Relatorio_5S_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
          <Trophy className="w-8 h-8 text-emerald-600" />
          Relatórios Programa 5S
        </h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
            <button 
              onClick={() => setPeriod("weekly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${period === "weekly" ? "bg-emerald-100 text-emerald-700" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Semanal
            </button>
            <button 
              onClick={() => setPeriod("monthly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${period === "monthly" ? "bg-emerald-100 text-emerald-700" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Mensal
            </button>
            <button 
              onClick={() => setPeriod("yearly")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${period === "yearly" ? "bg-emerald-100 text-emerald-700" : "text-gray-600 hover:bg-gray-50"}`}
            >
              Anual
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handlePrint()}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              <Printer className="w-5 h-5" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button 
              onClick={handleExportPDF}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">Gerar PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div ref={reportRef} className="space-y-6 print:p-8 print:bg-white">
        {/* Header for Print */}
        <div className="hidden print:block mb-8 border-b-2 border-gray-800 pb-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              {settings?.company_logo && (
                <img src={settings.company_logo} alt="Logo" className="h-16 object-contain" />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{settings?.company_name || "SST Gestão"}</h1>
                <p className="text-sm text-gray-600">{settings?.company_address}</p>
                <p className="text-sm text-gray-600">{settings?.company_phone} | {settings?.company_website}</p>
              </div>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p className="font-bold text-gray-800">Relatório de Inspeções 5S</p>
              <p>Emissão: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
              <p>Período: {period === 'weekly' ? 'Semanal' : period === 'monthly' ? 'Mensal' : 'Anual'}</p>
            </div>
          </div>
        </div>

        {/* Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
            <ArrowUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Maior Pontuação ({period === "weekly" ? "Semana" : period === "monthly" ? "Mês" : "Ano"})</p>
            <h3 className="text-xl font-bold text-gray-900 mb-1">
              {bestSector ? <SectorBadge sector={bestSector.sector} /> : "-"}
            </h3>
            <p className="text-emerald-600 font-bold">{bestSector ? `${bestSector.score} pts` : "-"}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center flex-shrink-0">
            <ArrowDown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Menor Pontuação ({period === "weekly" ? "Semana" : period === "monthly" ? "Mês" : "Ano"})</p>
            <h3 className="text-xl font-bold text-gray-900 mb-1">
              {worstSector ? <SectorBadge sector={worstSector.sector} /> : "-"}
            </h3>
            <p className="text-red-600 font-bold">{worstSector ? `${worstSector.score} pts` : "-"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comparativo Setores */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-6">Comparativo entre Setores</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="sector" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="score" fill="#4f46e5" name="Pontuação Média" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evolução Histórica */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-6">Evolução Histórica (Média Geral)</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ r: 6 }} name="Média 5S" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Footer for Print */}
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
  );
}
