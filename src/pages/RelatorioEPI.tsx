import React, { useState, useEffect, useRef } from 'react';
import { Printer, Package, Shield, Loader2, ArrowUpRight, AlertTriangle, CheckCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { format, parseISO, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, differenceInDays } from 'date-fns';
import { fetchSettings, CompanySettings } from '../utils/pdfUtils';
import { supabase } from '../lib/supabase';

interface PPE {
  id: number;
  name: string;
  ca: string;
  price: number;
  stock: number;
  last_purchase_date?: string;
  validity_date?: string;
}

interface PPEDelivery {
  id: number;
  ppe_id: number;
  employee_id: number;
  delivery_date: string;
  quantity: number;
}

export default function RelatorioEPI() {
  const [loading, setLoading] = useState(true);
  const [ppes, setPpes] = useState<PPE[]>([]);
  const [deliveries, setDeliveries] = useState<PPEDelivery[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [reportPeriod, setReportPeriod] = useState<"semana" | "mes" | "semestre" | "ano">("mes");
  
  const printRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Relatório de EPIs',
    pageStyle: `
      @page { size: A4; margin: 20mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; }
        .no-print { display: none !important; }
      }
    `
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [ppesResponse, deliveriesResponse, settingsData] = await Promise.all([
          supabase.from('ppes').select('*').order('name'),
          supabase.from('ppe_deliveries').select('*'),
          fetchSettings()
        ]);
        
        if (ppesResponse.data) {
          setPpes(ppesResponse.data);
        }
        if (deliveriesResponse.data) {
          setDeliveries(deliveriesResponse.data);
        }
        setSettings(settingsData);
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  }

  const totalStockValue = ppes.reduce((acc, ppe) => acc + (ppe.price * ppe.stock), 0);
  const totalItems = ppes.reduce((acc, ppe) => acc + ppe.stock, 0);

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

  const periodDeliveries = deliveries.filter(d => {
    const dDate = parseISO(d.delivery_date);
    return isWithinInterval(dDate, { start: startDate, end: endDate });
  });

  const totalDelivered = periodDeliveries.reduce((acc, d) => acc + d.quantity, 0);

  let validCount = 0;
  let expiringSoonCount = 0;
  let expiredCount = 0;

  const ppesWithValidity = ppes.map(ppe => {
    let status = "Sem Validade";
    if (ppe.validity_date) {
      const validityDate = parseISO(ppe.validity_date);
      const daysToExpiration = differenceInDays(validityDate, now);
      
      if (daysToExpiration < 0) {
        status = "Vencido";
        expiredCount++;
      } else if (daysToExpiration <= 30) {
        status = "A Vencer";
        expiringSoonCount++;
      } else {
        status = "Válido";
        validCount++;
      }
    }
    return { ...ppe, status };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Relatório Geral de EPIs</h2>
          <p className="text-gray-500">Movimentação, estoque e validades</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={reportPeriod}
            onChange={(e) => setReportPeriod(e.target.value as any)}
            className="p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="semana">Esta Semana</option>
            <option value="mes">Este Mês</option>
            <option value="semestre">Últimos 6 Meses</option>
            <option value="ano">Este Ano</option>
          </select>
          <button 
            onClick={handlePrint}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            <Printer className="w-4 h-4" />
            Imprimir Relatório
          </button>
        </div>
      </div>

      <div ref={printRef} className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        {/* Print Header */}
        <div className="hidden print:flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-8">
          <div className="flex items-center gap-4">
            {settings?.company_logo && (
              <img src={settings.company_logo} alt="Logo" className="h-16 object-contain" referrerPolicy="no-referrer" />
            )}
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wider">{settings?.company_name || "Sistema de Gestão SST"}</h1>
              <p className="text-sm text-gray-600">Relatório de Movimentação e Estoque de EPIs</p>
              <p className="text-sm text-gray-600">Período: {format(startDate, 'dd/MM/yyyy')} a {format(endDate, 'dd/MM/yyyy')}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p><strong>Data de Emissão:</strong> {format(new Date(), 'dd/MM/yyyy')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="w-5 h-5 text-orange-600" />
              <h3 className="text-sm font-bold text-orange-900">Saídas / Entregues (Período)</h3>
            </div>
            <p className="text-2xl font-black text-orange-700">{totalDelivered} un</p>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-emerald-900">Estoque Atual</h3>
            </div>
            <p className="text-2xl font-black text-emerald-700">{totalItems} un</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-bold text-purple-900">Valor em Estoque</h3>
            </div>
            <p className="text-2xl font-black text-purple-700">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totalStockValue)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">CAs Válidos</span>
            </div>
            <span className="text-3xl font-black text-emerald-600">{validCount}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">CAs a Vencer</span>
            </div>
            <span className="text-3xl font-black text-orange-500">{expiringSoonCount}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col items-center justify-center">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">CAs Vencidos</span>
            </div>
            <span className="text-3xl font-black text-red-600">{expiredCount}</span>
          </div>
        </div>

        <h3 className="text-lg font-bold text-gray-800 mb-4">Detalhamento por EPI</h3>
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="py-2 px-3 font-bold text-gray-900">EPI</th>
              <th className="py-2 px-3 font-bold text-gray-900">CA</th>
              <th className="py-2 px-3 font-bold text-gray-900">Validade CA</th>
              <th className="py-2 px-3 font-bold text-gray-900 text-center">Status CA</th>
              <th className="py-2 px-3 font-bold text-gray-900 text-right">Estoque</th>
            </tr>
          </thead>
          <tbody>
            {ppesWithValidity.map((ppe, index) => (
              <tr key={ppe.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="py-2 px-3 border-b border-gray-200 font-medium">{ppe.name}</td>
                <td className="py-2 px-3 border-b border-gray-200">{ppe.ca}</td>
                <td className="py-2 px-3 border-b border-gray-200">
                  {ppe.validity_date ? format(parseISO(ppe.validity_date), 'dd/MM/yyyy') : '-'}
                </td>
                <td className="py-2 px-3 border-b border-gray-200 text-center">
                  {ppe.status !== "Sem Validade" && (
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      ppe.status === "Válido" ? "bg-emerald-100 text-emerald-800" :
                      ppe.status === "A Vencer" ? "bg-orange-100 text-orange-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {ppe.status}
                    </span>
                  )}
                  {ppe.status === "Sem Validade" && <span className="text-gray-400">-</span>}
                </td>
                <td className="py-2 px-3 border-b border-gray-200 text-right font-bold text-gray-700">{ppe.stock} un</td>
              </tr>
            ))}
            {ppesWithValidity.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-500">Nenhum EPI cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Print Footer */}
        <div className="hidden print:block mt-24 pt-8 border-t border-gray-300">
          <div className="flex justify-around items-end">
            <div className="text-center">
              {settings?.resp_signature && (
                <img src={settings.resp_signature} alt="Assinatura" className="h-16 object-contain mx-auto mb-2" referrerPolicy="no-referrer" />
              )}
              <div className="w-64 border-b border-black mb-2 mx-auto"></div>
              <p className="text-sm font-bold">{settings?.resp_name || "Responsável pelo Almoxarifado / SESMT"}</p>
              <p className="text-xs text-gray-500">{settings?.resp_role || "Assinatura e Carimbo"}</p>
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
