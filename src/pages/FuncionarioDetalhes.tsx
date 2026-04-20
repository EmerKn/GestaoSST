import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import { Printer, ArrowLeft, Shield, AlertTriangle, GraduationCap, Flame, Stethoscope, FileText } from "lucide-react";
import { format, parseISO, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SectorBadge } from "../utils/sectorColors";
import { supabase } from "../lib/supabase";

interface EmployeeDetails {
  id: number;
  name: string;
  cpf: string;
  role: string;
  sector: string;
  shift: string;
  photo_url: string;
  admission_date: string;
  deliveries: any[];
  incidents: any[];
  trainings: any[];
  brigadeInfo: any;
  exams: any[];
  medication_deliveries: any[];
}

export default function FuncionarioDetalhes() {
  const { id } = useParams();
  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadEmployeeData = async () => {
      if (!id) return;
      
      try {
        const { data: empData, error: empError } = await supabase
          .from('employees')
          .select('*')
          .eq('id', id)
          .single();
          
        if (empError) throw empError;
        
        const [deliveriesRes, incidentsRes, trainingsRes, brigadeRes, examsRes, medDeliveriesRes] = await Promise.all([
          supabase.from('ppe_deliveries').select('*, ppes(name, photo_url, ca)').eq('employee_id', id).order('delivery_date', { ascending: false }),
          supabase.from('incidents').select('*').eq('employee_id', id).order('date', { ascending: false }),
          supabase.from('trainings').select('*').contains('participants', [empData.name]).order('date', { ascending: false }),
          supabase.from('brigade_members').select('*').eq('employee_id', id).single(),
          supabase.from('exams').select('*').eq('employee_id', id).order('exam_date', { ascending: false }),
          supabase.from('medication_deliveries').select('*, medications(name, dosage)').eq('employee_id', id).order('delivery_date', { ascending: false })
        ]);

        const formattedTrainings = trainingsRes.data?.map(t => ({
          id: t.id,
          date: t.date,
          name: t.name,
          instructor: t.instructor
        })) || [];

        setEmployee({
          ...empData,
          deliveries: deliveriesRes.data || [],
          incidents: incidentsRes.data || [],
          trainings: formattedTrainings,
          brigadeInfo: brigadeRes.data || null,
          exams: examsRes.data || [],
          medication_deliveries: medDeliveriesRes.data || []
        });
      } catch (error) {
        console.error("Error loading employee details:", error);
      }
    };

    loadEmployeeData();
  }, [id]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Ficha_SST_${employee?.name?.replace(/\s+/g, "_")}`,
  });

  if (!employee) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <Link to="/funcionarios" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition">
          <ArrowLeft className="w-5 h-5" />
          <span>Voltar</span>
        </Link>
        <button 
          onClick={() => handlePrint()}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium"
        >
          <Printer className="w-5 h-5" />
          <span>Imprimir Ficha A4</span>
        </button>
      </div>

      {/* Printable Area */}
      <div 
        ref={componentRef} 
        className="bg-white p-8 sm:p-12 rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-none print:p-0"
      >
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-6 mb-8 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-emerald-600 text-white flex items-center justify-center rounded-lg font-bold text-2xl">
              SST
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-tight">Ficha Individual de SST</h1>
              <p className="text-gray-600">Empresa Exemplo S.A. - CNPJ: 00.000.000/0001-00</p>
              <p className="text-gray-600 text-sm">Rua Fictícia, 123 - Centro - São Paulo/SP</p>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>Data de Emissão:</p>
            <p className="font-medium text-gray-900">{format(new Date(), "dd/MM/yyyy")}</p>
          </div>
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-[auto_1fr] gap-8 mb-10">
          <img 
            src={employee.photo_url} 
            alt={employee.name} 
            referrerPolicy="no-referrer"
            className="w-32 h-32 rounded-lg object-cover border-2 border-gray-200"
          />
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <p className="text-gray-500 font-medium uppercase text-xs">Nome Completo</p>
              <p className="font-bold text-gray-900 text-lg">{employee.name}</p>
            </div>
            <div>
              <p className="text-gray-500 font-medium uppercase text-xs">CPF</p>
              <p className="font-medium text-gray-900">{employee.cpf}</p>
            </div>
            <div>
              <p className="text-gray-500 font-medium uppercase text-xs">Cargo</p>
              <p className="font-medium text-gray-900">{employee.role}</p>
            </div>
            <div>
              <p className="text-gray-500 font-medium uppercase text-xs mb-1">Setor</p>
              <SectorBadge sector={employee.sector} />
            </div>
            <div>
              <p className="text-gray-500 font-medium uppercase text-xs">Turno</p>
              <p className="font-medium text-gray-900">{employee.shift}</p>
            </div>
            <div>
              <p className="text-gray-500 font-medium uppercase text-xs">Admissão</p>
              <p className="font-medium text-gray-900">{format(new Date(employee.admission_date), "dd/MM/yyyy")}</p>
            </div>
          </div>
        </div>

        {/* Brigade Info */}
        {employee.brigadeInfo && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-4 text-red-800">
            <Flame className="w-8 h-8 flex-shrink-0" />
            <div>
              <h3 className="font-bold uppercase tracking-wide">Membro da Brigada de Emergência</h3>
              <p>Função: <span className="font-medium">{employee.brigadeInfo.brigade_role}</span></p>
            </div>
          </div>
        )}

        {/* PPE Deliveries */}
        <div className="mb-10">
          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-2 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-600" />
            Histórico de Entrega de EPIs
          </h3>
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-700">
                <th className="p-2 font-bold">Data</th>
                <th className="p-2 font-bold">EPI</th>
                <th className="p-2 font-bold">CA</th>
                <th className="p-2 font-bold text-center">Qtd</th>
                <th className="p-2 font-bold">Assinatura do Funcionário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employee.deliveries.length > 0 ? employee.deliveries.map(d => (
                <tr key={d.id}>
                  <td className="p-2">{format(new Date(d.delivery_date), "dd/MM/yyyy")}</td>
                  <td className="p-2 flex items-center gap-2">
                    {d.ppes?.photo_url ? (
                      <img src={d.ppes.photo_url} alt={d.ppes?.name} className="w-8 h-8 object-cover rounded border border-gray-200" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-8 h-8 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-[10px] text-gray-400">Sem foto</div>
                    )}
                    <span>{d.ppes?.name}</span>
                  </td>
                  <td className="p-2">{d.ppes?.ca}</td>
                  <td className="p-2 text-center">{d.quantity}</td>
                  <td className="p-2 border-l border-gray-200"></td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="p-4 text-center text-gray-500 italic">Nenhum EPI registrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Trainings */}
        <div className="mb-10">
          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-2 mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-600" />
            Treinamentos Realizados
          </h3>
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-700">
                <th className="p-2 font-bold">Data</th>
                <th className="p-2 font-bold">Treinamento</th>
                <th className="p-2 font-bold">Instrutor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employee.trainings.length > 0 ? employee.trainings.map(t => (
                <tr key={t.id}>
                  <td className="p-2">{format(new Date(t.date), "dd/MM/yyyy")}</td>
                  <td className="p-2">{t.name}</td>
                  <td className="p-2">{t.instructor}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="p-4 text-center text-gray-500 italic">Nenhum treinamento registrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Exams */}
        <div className="mb-10">
          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-2 mb-4 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-emerald-600" />
            Exames Ocupacionais
          </h3>
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-700">
                <th className="p-2 font-bold">Data</th>
                <th className="p-2 font-bold">Tipo</th>
                <th className="p-2 font-bold">Exames Realizados</th>
                <th className="p-2 font-bold">Próximo Vencimento</th>
                <th className="p-2 font-bold text-center print:hidden">Anexo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employee.exams && employee.exams.length > 0 ? employee.exams.map(e => {
                const nextDate = e.next_exam_date ? parseISO(e.next_exam_date) : null;
                const isExpired = nextDate && isBefore(nextDate, new Date());
                return (
                  <tr key={e.id}>
                    <td className="p-2">{e.exam_date ? format(parseISO(e.exam_date), "dd/MM/yyyy") : "-"}</td>
                    <td className="p-2">{e.type}</td>
                    <td className="p-2">{e.specific_exams}</td>
                    <td className={`p-2 font-medium ${isExpired ? 'text-red-600' : ''}`}>
                      {nextDate ? format(nextDate, "dd/MM/yyyy") : "-"}
                    </td>
                    <td className="p-2 text-center print:hidden">
                      {e.file_url && (
                        <a href={e.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:text-indigo-800">
                          <FileText className="w-4 h-4" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={5} className="p-4 text-center text-gray-500 italic">Nenhum exame registrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Incidents */}
        <div className="mb-16">
          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-2 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Histórico de Lesões e Afastamentos
          </h3>
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-700">
                <th className="p-2 font-bold">Data</th>
                <th className="p-2 font-bold">Tipo</th>
                <th className="p-2 font-bold">Descrição</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employee.incidents.length > 0 ? employee.incidents.map(i => (
                <tr key={i.id}>
                  <td className="p-2">{format(new Date(i.date), "dd/MM/yyyy")}</td>
                  <td className="p-2 uppercase font-medium">{i.type}</td>
                  <td className="p-2">{i.description}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="p-4 text-center text-gray-500 italic">Nenhum incidente registrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Medication Deliveries */}
        <div className="mb-16">
          <h3 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-2 mb-4 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-indigo-600" />
            Histórico de Retirada de Medicamentos
          </h3>
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-700">
                <th className="p-2 font-bold">Data</th>
                <th className="p-2 font-bold">Medicamento Fornecido</th>
                <th className="p-2 font-bold text-center">Quantidade</th>
                <th className="p-2 font-bold">Assinatura do Funcionário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employee.medication_deliveries && employee.medication_deliveries.length > 0 ? employee.medication_deliveries.map(md => (
                <tr key={md.id}>
                  <td className="p-2">{format(new Date(md.delivery_date), "dd/MM/yyyy")}</td>
                  <td className="p-2 font-medium">{md.medications?.name} {md.medications?.dosage}</td>
                  <td className="p-2 text-center">{md.quantity} UN</td>
                  <td className="p-2 border-l border-gray-200"></td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="p-4 text-center text-gray-500 italic">Nenhum medicamento retirado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-16 mt-24 pt-8 border-t border-gray-300 text-center">
          <div>
            <div className="border-b border-gray-900 mb-2"></div>
            <p className="font-bold text-gray-900">{employee.name}</p>
            <p className="text-sm text-gray-500">Funcionário</p>
          </div>
          <div>
            <div className="border-b border-gray-900 mb-2"></div>
            <p className="font-bold text-gray-900">Técnico de Segurança do Trabalho</p>
            <p className="text-sm text-gray-500">Assinatura e Carimbo</p>
          </div>
        </div>

      </div>
    </div>
  );
}
