import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Printer, BrainCircuit, Loader2, Calendar, Filter } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { GoogleGenAI } from '@google/genai';
import { fetchSettings, CompanySettings } from '../utils/pdfUtils';
import { supabase } from '../lib/supabase';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function RelatoriosInspecoes() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [data, setData] = useState<any>({
    nr10: [], nr12: [], nr24: [], nr35: [], nr6: [], '5s': [], fire: []
  });
  
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'semiannual' | 'annual'>('monthly');
  const [selectedSector, setSelectedSector] = useState<string>('Todos');
  const [sectors, setSectors] = useState<string[]>([]);
  
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Relatório de Inspeções',
    pageStyle: `
      @page { size: A4; margin: 20mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; }
        .no-print { display: none !important; }
        .print-break-inside-avoid { page-break-inside: avoid; }
        .print-page-break { page-break-before: always; }
      }
    `
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const endpoints = ['inspection_nr10', 'inspection_nr12', 'inspection_nr24', 'inspection_nr35', 'inspection_nr6', 'inspection_5s', 'inspection_fire'];
      const results = await Promise.all(
        endpoints.map(ep => supabase.from(ep).select('*').then(res => res.data || []))
      );
      
      const newData = {
        nr10: results[0],
        nr12: results[1],
        nr24: results[2],
        nr35: results[3],
        nr6: results[4],
        '5s': results[5],
        fire: results[6]
      };
      
      setData(newData);
      fetchSettings().then(setSettings);
      
      // Extract unique sectors
      const allSectors = new Set<string>();
      Object.values(newData).forEach((arr: any[]) => {
        arr.forEach(item => {
          if (item.sector) allSectors.add(item.sector);
          // Handle location as sector for some tables if sector is missing
          if (!item.sector && item.location) allSectors.add(item.location);
        });
      });
      setSectors(['Todos', ...Array.from(allSectors)]);
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to calculate compliance score (0-100) for an inspection
  const calculateCompliance = (type: string, item: any) => {
    let total = 0;
    let conforming = 0;
    
    if (type === '5s') {
      const sum = (item.item1 || 0) + (item.item2 || 0) + (item.item3 || 0) + (item.item4 || 0) + (item.item5 || 0);
      return (sum / 25) * 100;
    }
    
    const checkField = (val: string) => {
      if (val === 'Conforme') { total++; conforming++; }
      else if (val === 'Não Conforme') { total++; }
    };

    if (type === 'nr10') {
      checkField(item.panel_condition); checkField(item.grounding); checkField(item.signaling);
    } else if (type === 'nr12') {
      checkField(item.emergency_button); checkField(item.safety_guards); checkField(item.interlock_system);
    } else if (type === 'nr24') {
      checkField(item.cleanliness); checkField(item.lockers_condition); checkField(item.showers_condition);
    } else if (type === 'nr35') {
      checkField(item.anchor_points); checkField(item.lifelines); checkField(item.harnesses);
    } else if (type === 'nr6') {
      checkField(item.ppe_condition); checkField(item.ca_validity); checkField(item.proper_usage);
    } else if (type === 'fire') {
      checkField(item.equipment_condition); checkField(item.signaling); checkField(item.unobstructed);
    }
    
    return total > 0 ? (conforming / total) * 100 : 0;
  };

  // Process data for charts
  const processChartData = () => {
    // Group by period (week, month, year)
    const groupedData: Record<string, { sortKey: string, period: string, [key: string]: any }> = {};
    
    Object.entries(data).forEach(([type, items]: [string, any[]]) => {
      items.forEach(item => {
        if (!item.date) return;
        
        const itemSector = item.sector || item.location || 'Desconhecido';
        if (selectedSector !== 'Todos' && itemSector !== selectedSector) return;
        
        const date = parseISO(item.date);
        let periodKey = '';
        let sortKey = '';
        
        if (timeframe === 'weekly') {
          const start = startOfWeek(date);
          periodKey = format(start, 'dd/MM/yyyy');
          sortKey = format(start, 'yyyy-MM-dd');
        } else if (timeframe === 'monthly') {
          periodKey = format(date, 'MMM/yyyy', { locale: ptBR });
          sortKey = format(date, 'yyyy-MM');
        } else if (timeframe === 'semiannual') {
          const isFirstHalf = date.getMonth() < 6;
          periodKey = `${isFirstHalf ? '1º' : '2º'} Semestre ${format(date, 'yyyy')}`;
          sortKey = `${format(date, 'yyyy')}-${isFirstHalf ? '01' : '02'}`;
        } else {
          periodKey = format(date, 'yyyy');
          sortKey = format(date, 'yyyy');
        }
        
        if (!groupedData[sortKey]) {
          groupedData[sortKey] = { sortKey, period: periodKey, totalScore: 0, count: 0 };
        }
        
        const score = calculateCompliance(type, item);
        groupedData[sortKey].totalScore += score;
        groupedData[sortKey].count += 1;
        
        if (!groupedData[sortKey][type]) {
          groupedData[sortKey][type] = { score: 0, count: 0 };
        }
        groupedData[sortKey][type].score += score;
        groupedData[sortKey][type].count += 1;
      });
    });
    
    // Calculate averages
    return Object.values(groupedData).map(group => {
      const result: any = { sortKey: group.sortKey, period: group.period };
      result.Geral = group.count > 0 ? Math.round(group.totalScore / group.count) : 0;
      
      ['nr10', 'nr12', 'nr24', 'nr35', 'nr6', '5s', 'fire'].forEach(type => {
        if (group[type]) {
          result[type.toUpperCase()] = Math.round(group[type].score / group[type].count);
        } else {
          result[type.toUpperCase()] = null; // No data for this period
        }
      });
      
      return result;
    }).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  };

  const chartData = processChartData();
  
  // Sector comparison data
  const processSectorData = () => {
    const sectorScores: Record<string, { score: 0, count: 0 }> = {};
    
    Object.entries(data).forEach(([type, items]: [string, any[]]) => {
      items.forEach(item => {
        const itemSector = item.sector || item.location || 'Desconhecido';
        if (!sectorScores[itemSector]) sectorScores[itemSector] = { score: 0, count: 0 };
        
        sectorScores[itemSector].score += calculateCompliance(type, item);
        sectorScores[itemSector].count += 1;
      });
    });
    
    return Object.entries(sectorScores).map(([sector, stats]) => ({
      name: sector,
      Conformidade: Math.round(stats.score / stats.count)
    })).sort((a, b) => b.Conformidade - a.Conformidade);
  };
  
  const sectorData = processSectorData();

  const generateAIAnalysis = async () => {
    setAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || 'missing_key' });
      
      const promptData = {
        timeframe,
        selectedSector,
        chartData,
        sectorData
      };

      const prompt = `
        Você é um especialista em Segurança do Trabalho. Analise os seguintes dados de inspeções de segurança de uma empresa.
        Os dados representam o percentual de conformidade (0 a 100%) em diferentes tipos de inspeções (NR-10, NR-12, NR-24, NR-35, NR-6, 5S, Incêndio).
        
        Dados de evolução no tempo (${timeframe}):
        ${JSON.stringify(chartData)}
        
        Dados por setor (Geral):
        ${JSON.stringify(sectorData)}
        
        Por favor, forneça um relatório profissional contendo:
        1. Resumo Executivo das tendências observadas.
        2. Análise de pontos fortes e fracos (quais NRs ou setores precisam de mais atenção).
        3. Se houver dados suficientes, compare a evolução (ex: melhoria ou piora ao longo dos meses/anos).
        4. Proponha 3 a 5 ideias de melhorias práticas baseadas nos dados.
        
        Formate a resposta em HTML limpo (apenas tags como <h3>, <p>, <ul>, <li>, <strong>) para ser renderizado diretamente na página. Não use markdown.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiAnalysis(response.text || 'Não foi possível gerar a análise.');
    } catch (error) {
      console.error("Erro ao gerar análise:", error);
      setAiAnalysis('<p class="text-red-500">Erro ao gerar análise. Verifique a conexão ou a chave da API.</p>');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-200">Relatórios de Inspeções</h1>
          <p className="text-gray-500">Análise comparativa e tendências de segurança</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={generateAIAnalysis}
            disabled={analyzing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
            Análise Inteligente
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            <Printer className="w-4 h-4" />
            Imprimir Relatório
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 no-print">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtros:</span>
        </div>
        
        <select 
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value as any)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="weekly">Evolução Semanal</option>
          <option value="monthly">Evolução Mensal</option>
          <option value="semiannual">Evolução Semestral</option>
          <option value="annual">Evolução Anual</option>
        </select>

        <select 
          value={selectedSector}
          onChange={(e) => setSelectedSector(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          {sectors.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Printable Area */}
      <div ref={printRef} className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        
        {/* Print Header */}
        <div className="hidden print:flex justify-between items-center border-b-4 border-black pb-4 mb-8">
          <div className="flex items-center gap-4">
            {settings?.company_logo && (
              <img src={settings.company_logo} alt="Logo" className="h-16 object-contain" referrerPolicy="no-referrer" />
            )}
            <div>
              <h1 className="text-2xl font-extrabold uppercase tracking-wider text-black">{settings?.company_name || "Sistema de Gestão SST"}</h1>
              <p className="text-md font-bold text-red-600 uppercase">Relatório Analítico de Inspeções de Segurança</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p><strong>Data de Emissão:</strong> {format(new Date(), 'dd/MM/yyyy')}</p>
            <p><strong>Período Analisado:</strong> {timeframe === 'weekly' ? 'Semanal' : timeframe === 'monthly' ? 'Mensal' : timeframe === 'semiannual' ? 'Semestral' : 'Anual'}</p>
            <p><strong>Setor:</strong> {selectedSector}</p>
          </div>
        </div>

        <div className="space-y-12">
          {/* Chart 1: Evolution */}
          <div className="print-break-inside-avoid">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Evolução da Conformidade ({timeframe === 'weekly' ? 'Semanal' : timeframe === 'monthly' ? 'Mensal' : timeframe === 'semiannual' ? 'Semestral' : 'Anual'})
            </h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="period" />
                  <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="Geral" stroke="#111827" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="NR10" stroke={COLORS[0]} strokeWidth={2} />
                  <Line type="monotone" dataKey="NR12" stroke={COLORS[1]} strokeWidth={2} />
                  <Line type="monotone" dataKey="NR24" stroke={COLORS[2]} strokeWidth={2} />
                  <Line type="monotone" dataKey="NR35" stroke={COLORS[3]} strokeWidth={2} />
                  <Line type="monotone" dataKey="NR6" stroke={COLORS[4]} strokeWidth={2} />
                  <Line type="monotone" dataKey="5S" stroke={COLORS[5]} strokeWidth={2} />
                  <Line type="monotone" dataKey="FIRE" name="Incêndio" stroke={COLORS[6]} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Sector Comparison */}
          {selectedSector === 'Todos' && (
            <div className="print-break-inside-avoid">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Comparativo por Setor (Geral)</h2>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Legend />
                    <Bar dataKey="Conformidade" fill="#059669" radius={[4, 4, 0, 0]}>
                      {sectorData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.Conformidade < 70 ? '#EF4444' : entry.Conformidade < 90 ? '#F59E0B' : '#10B981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* AI Analysis Section */}
          {aiAnalysis && (
            <div className="print-break-inside-avoid bg-purple-50 p-6 rounded-xl border border-purple-100">
              <h2 className="text-lg font-bold text-purple-900 mb-4 flex items-center gap-2">
                <BrainCircuit className="w-5 h-5" />
                Análise Inteligente e Propostas de Melhoria
              </h2>
              <div 
                className="prose prose-sm max-w-none text-purple-900/80"
                dangerouslySetInnerHTML={{ __html: aiAnalysis }}
              />
            </div>
          )}
        </div>

        {/* Print Footer */}
        <div className="hidden print:block mt-24 pt-8 border-t border-gray-300">
          <div className="flex justify-around items-end">
            <div className="text-center">
              {settings?.resp_signature && (
                <img src={settings.resp_signature} alt="Assinatura" className="h-16 object-contain mx-auto mb-2" referrerPolicy="no-referrer" />
              )}
              <div className="w-64 border-b border-black mb-2 mx-auto"></div>
              <p className="text-sm font-bold">{settings?.resp_name || "Responsável pela Inspeção / SESMT"}</p>
              <p className="text-xs text-gray-500">{settings?.resp_role || "Assinatura e Carimbo"}</p>
            </div>
            <div className="text-center">
              <div className="w-64 border-b border-black mb-2 mx-auto"></div>
              <p className="text-sm font-bold">Responsável do Setor</p>
              <p className="text-xs text-gray-500">Assinatura e Carimbo</p>
            </div>
          </div>
          <div className="text-center mt-8 text-xs text-gray-400">
            Documento gerado pelo Sistema de Gestão SST em {format(new Date(), 'dd/MM/yyyy HH:mm')}
          </div>
        </div>

      </div>
    </div>
  );
}
