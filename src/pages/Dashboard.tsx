import { useState, useEffect } from "react";
import { Users, Shield, Flame, AlertTriangle, FileSignature, ClipboardCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "../lib/supabase";
import { filterRealData } from "./Funcionarios";

export default function Dashboard() {
  const [inspectionData, setInspectionData] = useState<any[]>([]);
  const [upcomingBrigadeTrainings, setUpcomingBrigadeTrainings] = useState<any[]>([]);
  const [upcomingTrainings, setUpcomingTrainings] = useState<any[]>([]);
  const [counts, setCounts] = useState({
    employees: 0,
    ppes: 0,
    fireEquipment: 0,
    occurrences: 0,
    workPermits: 0,
    inspections5s: 0
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch counts
        const [empRes, ppeRes, fireRes, occRes, wpRes, inspections5sRes, brigadeTrainingsRes, trainingsRes] = await Promise.all([
          supabase.from('employees').select('id'),
          supabase.from('ppes').select('id'),
          supabase.from('fire_equipment').select('id'),
          supabase.from('occurrences').select('id'),
          supabase.from('work_permits').select('id'),
          supabase.from('inspection_5s').select('id'),
          supabase.from('brigade_training_schedules').select('*').order('date', { ascending: true }),
          supabase.from('trainings').select('*').order('date', { ascending: true })
        ]);

        setCounts({
          employees: empRes.data ? filterRealData(empRes.data).length : 0,
          ppes: ppeRes.data ? filterRealData(ppeRes.data).length : 0,
          fireEquipment: fireRes.data ? filterRealData(fireRes.data).length : 0,
          occurrences: occRes.data ? filterRealData(occRes.data).length : 0,
          workPermits: wpRes.data ? filterRealData(wpRes.data).length : 0,
          inspections5s: inspections5sRes.data ? filterRealData(inspections5sRes.data).length : 0
        });

        if (brigadeTrainingsRes.data) {
          const today = new Date().toISOString().split('T')[0];
          const upcoming = brigadeTrainingsRes.data.filter(t => t.date >= today).slice(0, 5);
          setUpcomingBrigadeTrainings(upcoming);
        }

        if (trainingsRes.data) {
          const today = new Date();
          const currentMonth = today.getMonth();
          const currentYear = today.getFullYear();
          
          const upcoming = trainingsRes.data.filter(t => {
            if (!t.date) return false;
            const tDate = parseISO(t.date);
            return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear && t.date >= today.toISOString().split('T')[0];
          }).slice(0, 5);
          setUpcomingTrainings(upcoming);
        }

        const tables = [
          { name: 'inspection_nr10', label: 'NR-10' },
          { name: 'inspection_nr12', label: 'NR-12' },
          { name: 'inspection_nr24', label: 'NR-24' },
          { name: 'inspection_nr35', label: 'NR-35' },
          { name: 'inspection_nr6', label: 'NR-6' },
          { name: 'inspection_5s', label: '5S' },
          { name: 'inspection_fire', label: 'Incêndio' },
          { name: 'inspection_terceiros', label: 'Fornecedores/Terceirizados' }
        ];

        const aggregatedData: Record<string, any> = {};

        for (const table of tables) {
          const { data, error } = await supabase.from(table.name).select('date');
          if (error) continue;

          data.forEach((row: any) => {
            if (!row.date) return;
            const month = row.date.substring(0, 7); // YYYY-MM
            if (!aggregatedData[month]) {
              aggregatedData[month] = { month };
            }
            aggregatedData[month][table.label] = (aggregatedData[month][table.label] || 0) + 1;
          });
        }

        const formattedData = Object.values(aggregatedData)
          .sort((a: any, b: any) => a.month.localeCompare(b.month))
          .map((item: any) => {
            try {
              const date = parseISO(`${item.month}-01`);
              return {
                ...item,
                monthLabel: format(date, "MMM/yyyy", { locale: ptBR })
              };
            } catch (e) {
              return { ...item, monthLabel: item.month };
            }
          });

        setInspectionData(formattedData);
      } catch (err) {
        console.error("Error fetching inspection data:", err);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Funcionários</p>
            <p className="text-2xl font-bold text-gray-900">{counts.employees}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">EPIs Cadastrados</p>
            <p className="text-2xl font-bold text-gray-900">{counts.ppes}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Equip. Incêndio</p>
            <p className="text-2xl font-bold text-gray-900">{counts.fireEquipment}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-lg">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Ocorrências</p>
            <p className="text-2xl font-bold text-gray-900">{counts.occurrences}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
            <FileSignature className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Permissões de Trab.</p>
            <p className="text-2xl font-bold text-gray-900">{counts.workPermits}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Inspeções 5S</p>
            <p className="text-2xl font-bold text-gray-900">{counts.inspections5s}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Próximos Vencimentos</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-red-50 text-red-700 rounded-lg border border-red-100">
              <div>
                <p className="font-medium">Extintor PQS 4kg - Setor Produção</p>
                <p className="text-sm opacity-80">Vence em 5 dias</p>
              </div>
              <button className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition">Inspecionar</button>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 text-orange-700 rounded-lg border border-orange-100">
              <div>
                <p className="font-medium">Treinamento NR-35 - Equipe Manutenção</p>
                <p className="text-sm opacity-80">Vence em 15 dias</p>
              </div>
              <button className="px-3 py-1 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 transition">Agendar</button>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Próximos Cursos da Brigada</h3>
          <div className="space-y-3">
            {upcomingBrigadeTrainings.length > 0 ? (
              upcomingBrigadeTrainings.map((training) => (
                <div key={training.id} className="flex items-center justify-between p-3 bg-red-50 text-red-700 rounded-lg border border-red-100">
                  <div>
                    <p className="font-medium">{training.type}</p>
                    <p className="text-sm opacity-80">
                      Turma: {training.observations || 'Geral'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{format(parseISO(training.date), "dd/MM/yyyy")}</p>
                    <p className="text-xs opacity-80">{training.start_time} às {training.end_time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Nenhum curso agendado.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Treinamentos do Mês</h3>
          <div className="space-y-3">
            {upcomingTrainings.length > 0 ? (
              upcomingTrainings.map((training) => (
                <div key={training.id} className="flex items-center justify-between p-3 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                  <div>
                    <p className="font-medium">{training.name}</p>
                    <p className="text-sm opacity-80">
                      Instrutor: {training.instructor}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{format(parseISO(training.date), "dd/MM/yyyy")}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Nenhum treinamento agendado para este mês.</p>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Últimas Entregas de EPI</h3>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                    <img src={`https://picsum.photos/seed/${i}/100/100`} alt="Funcionario" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">João Silva</p>
                    <p className="text-sm text-gray-500">Luva de Raspa (CA: 12345)</p>
                  </div>
                </div>
                <span className="text-sm text-gray-500">Hoje, 10:30</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Inspeções Realizadas por Mês</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={inspectionData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthLabel" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="NR-10" stackId="a" fill="#3b82f6" />
              <Bar dataKey="NR-12" stackId="a" fill="#10b981" />
              <Bar dataKey="NR-24" stackId="a" fill="#f59e0b" />
              <Bar dataKey="NR-35" stackId="a" fill="#ef4444" />
              <Bar dataKey="NR-6" stackId="a" fill="#8b5cf6" />
              <Bar dataKey="5S" stackId="a" fill="#ec4899" />
              <Bar dataKey="Incêndio" stackId="a" fill="#f97316" />
              <Bar dataKey="Fornecedores/Terceirizados" stackId="a" fill="#06b6d4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
