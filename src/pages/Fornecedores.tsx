import React, { useState, useEffect } from "react";
import { Users, Building2, Plus, X, Save, Search, Phone, MapPin, User, BarChart2, CheckCircle, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from "../lib/supabase";
import { clsx } from "clsx";
import { ImageUpload } from "../components/ImageUpload";
import { useDatabaseOptions } from "../hooks/useDatabaseOptions";
import { SelectWithNew } from "../components/SelectWithNew";

type Supplier = {
  id: number;
  company_name: string;
  cnpj?: string;
  address: string;
  address_number?: string;
  zip_code?: string;
  city?: string;
  state?: string;
  phone: string;
  contact_name: string;
  type?: string;
  activity_description?: string;
  sector?: string;
};

type SupplierEmployee = {
  id: number;
  supplier_id: number;
  employee_name: string;
  cpf?: string;
  employee_role: string;
  photo_url?: string;
};

export default function Fornecedores() {
  const { sectors } = useDatabaseOptions();
  const [activeTab, setActiveTab] = useState<"list" | "new" | "dashboard">("dashboard");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<SupplierEmployee[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState({
    company_name: "",
    cnpj: "",
    address: "",
    address_number: "",
    zip_code: "",
    city: "",
    state: "",
    phone: "",
    contact_name: "",
    type: "",
    activity_description: "",
    sector: ""
  });

  const [newEmployees, setNewEmployees] = useState<{employee_name: string, cpf: string, employee_role: string, photo_url: string}[]>([]);
  const [tempEmployee, setTempEmployee] = useState({ employee_name: "", cpf: "", employee_role: "", photo_url: "" });

  const [employeeFormData, setEmployeeFormData] = useState({
    employee_name: "",
    cpf: "",
    employee_role: "",
    photo_url: ""
  });

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [suppRes, empRes, inspRes] = await Promise.all([
        supabase.from('suppliers').select('*').order('company_name'),
        supabase.from('supplier_employees').select('*').order('employee_name'),
        supabase.from('inspection_terceiros').select('*')
      ]);

      if (suppRes.data) setSuppliers(suppRes.data);
      if (empRes.data) setEmployees(empRes.data);
      if (inspRes.data) setInspections(inspRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEmployeeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmployeeFormData({ ...employeeFormData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.from('suppliers').insert([formData]).select().single();
      if (error) throw error;
      
      if (data && newEmployees.length > 0) {
        const employeesToInsert = newEmployees.map(emp => ({
          supplier_id: data.id,
          ...emp
        }));
        const { error: empError } = await supabase.from('supplier_employees').insert(employeesToInsert);
        if (empError) throw empError;
      }
      
      alert("Fornecedor cadastrado com sucesso!");
      setFormData({ company_name: "", cnpj: "", address: "", address_number: "", zip_code: "", city: "", state: "", phone: "", contact_name: "", type: "", activity_description: "", sector: "" });
      setNewEmployees([]);
      setActiveTab("list");
      loadData();
    } catch (error: any) {
      console.error("Error saving supplier:", error);
      if (error.code === 'PGRST204' || error.message?.includes('column')) {
        alert("Erro: As colunas 'type', 'activity_description' e 'sector' precisam ser criadas na tabela 'suppliers' no banco de dados.");
      } else {
        alert("Erro ao salvar fornecedor.");
      }
    }
  };

  const handleAddTempEmployee = () => {
    if (tempEmployee.employee_name.trim()) {
      setNewEmployees([...newEmployees, tempEmployee]);
      setTempEmployee({ employee_name: "", cpf: "", employee_role: "", photo_url: "" });
    }
  };

  const handleRemoveTempEmployee = (index: number) => {
    setNewEmployees(newEmployees.filter((_, i) => i !== index));
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;

    try {
      const { error } = await supabase.from('supplier_employees').insert([{
        supplier_id: selectedSupplier.id,
        ...employeeFormData
      }]);
      
      if (error) throw error;
      
      alert("Funcionário adicionado com sucesso!");
      setEmployeeFormData({ employee_name: "", cpf: "", employee_role: "", photo_url: "" });
      setShowEmployeeModal(false);
      loadData();
    } catch (error) {
      console.error("Error saving employee:", error);
      alert("Erro ao salvar funcionário.");
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.contact_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Dashboard calculations
  const totalInspections = inspections.length;
  const trainedCount = inspections.filter(i => i.received_training === "Sim").length;
  const integratedCount = inspections.filter(i => i.participated_integration === "Sim").length;

  const monthlyData = inspections.reduce((acc: any, curr: any) => {
    if (!curr.date) return acc;
    const month = curr.date.substring(0, 7);
    if (!acc[month]) acc[month] = { month, count: 0 };
    acc[month].count += 1;
    return acc;
  }, {});

  const chartData = Object.values(monthlyData)
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

  const pieData = [
    { name: 'Treinados', value: trainedCount, color: '#10b981' },
    { name: 'Não Treinados', value: totalInspections - trainedCount, color: '#ef4444' }
  ];

  const pieDataIntegration = [
    { name: 'Integrados', value: integratedCount, color: '#3b82f6' },
    { name: 'Não Integrados', value: totalInspections - integratedCount, color: '#f59e0b' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-emerald-600" />
          Fornecedores e Terceiros
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={clsx(
              "px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors",
              activeTab === "dashboard" ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            )}
          >
            <BarChart2 className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={clsx(
              "px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors",
              activeTab === "list" ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            )}
          >
            <Users className="w-4 h-4" />
            Lista
          </button>
          <button
            onClick={() => setActiveTab("new")}
            className={clsx(
              "px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors",
              activeTab === "new" ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            )}
          >
            <Plus className="w-4 h-4" />
            Novo Cadastro
          </button>
        </div>
      </div>

      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total de Inspeções</p>
                <p className="text-2xl font-bold text-slate-900">{totalInspections}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Receberam Treinamento</p>
                <p className="text-2xl font-bold text-slate-900">{trainedCount}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Participaram da Integração</p>
                <p className="text-2xl font-bold text-slate-900">{integratedCount}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Inspeções por Mês</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monthLabel" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" name="Inspeções" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Status de Treinamento e Integração</h3>
              <div className="grid grid-cols-2 gap-4 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieDataIntegration}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieDataIntegration.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Fornecedores/Terceirizados Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
            <div className="p-4 bg-emerald-50 border-b border-slate-200">
              <h3 className="text-lg font-bold text-indigo-900">Planilha de Controle: Inspeções Realizadas</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider">
                    <th className="p-3 font-medium">Data</th>
                    <th className="p-3 font-medium">Inspetor</th>
                    <th className="p-3 font-medium">Empresa</th>
                    <th className="p-3 font-medium">Trabalhador</th>
                    <th className="p-3 font-medium">Tipo</th>
                    <th className="p-3 font-medium">Treinamento</th>
                    <th className="p-3 font-medium">Integração</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {inspections.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</td>
                      <td className="p-3">{item.inspector}</td>
                      <td className="p-3">{item.company_name}</td>
                      <td className="p-3">{item.worker_name}</td>
                      <td className="p-3">{item.worker_type}</td>
                      <td className="p-3">
                        <span className={clsx(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                          item.received_training === "Sim" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                        )}>
                          {item.received_training === "Sim" ? "Conforme" : "Não Conforme"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={clsx(
                          "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                          item.participated_integration === "Sim" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                        )}>
                          {item.participated_integration === "Sim" ? "Conforme" : "Não Conforme"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {inspections.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-slate-500">Nenhuma inspeção de fornecedores/terceirizados registrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "list" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar fornecedores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
              />
            </div>
          </div>
          <div className="divide-y divide-slate-200">
            {filteredSuppliers.map(supplier => {
              const supplierEmployees = employees.filter(e => e.supplier_id === supplier.id);
              return (
                <div key={supplier.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-emerald-500" />
                        {supplier.company_name}
                        {supplier.type && (
                          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-emerald-100 text-indigo-800 rounded-full">
                            {supplier.type}
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-slate-500 mb-2">
                        <MapPin className="w-4 h-4" />
                        <span>
                          {supplier.address ? `${supplier.address}${supplier.address_number ? `, ${supplier.address_number}` : ''}` : "Endereço não informado"}
                          {supplier.city && supplier.state ? ` - ${supplier.city}/${supplier.state}` : ''}
                          {supplier.zip_code ? ` - CEP: ${supplier.zip_code}` : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        {supplier.cnpj && <span className="flex items-center gap-1 font-medium text-slate-700">CNPJ: {supplier.cnpj}</span>}
                        <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {supplier.phone || "Não informado"}</span>
                        <span className="flex items-center gap-1"><User className="w-4 h-4" /> {supplier.contact_name || "Não informado"}</span>
                      </div>
                      {(supplier.activity_description || supplier.sector) && (
                        <div className="text-sm text-slate-600 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          {supplier.sector && <p><span className="font-medium">Setor:</span> {supplier.sector}</p>}
                          {supplier.activity_description && <p><span className="font-medium">Atividade:</span> {supplier.activity_description}</p>}
                        </div>
                      )}
                    </div>
                    <div>
                      <button
                        onClick={() => {
                          setSelectedSupplier(supplier);
                          setShowEmployeeModal(true);
                        }}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Funcionário
                      </button>
                    </div>
                  </div>
                  
                  {supplierEmployees.length > 0 && (
                    <div className="mt-4 pl-4 border-l-2 border-emerald-100">
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Funcionários Cadastrados:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {supplierEmployees.map(emp => (
                          <div key={emp.id} className="bg-white border border-slate-200 p-3 rounded-lg flex items-center gap-3">
                            {emp.photo_url ? (
                              <img src={emp.photo_url} alt={emp.employee_name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg">
                                {emp.employee_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-slate-900">{emp.employee_name}</p>
                              {emp.cpf && <p className="text-xs text-slate-500">CPF: {emp.cpf}</p>}
                              <p className="text-xs text-slate-500">{emp.employee_role || "Sem cargo"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredSuppliers.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                Nenhum fornecedor encontrado.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "new" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-800">Novo Cadastro de Fornecedor/Terceiro</h3>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Empresa *</label>
                <input
                  type="text"
                  name="company_name"
                  required
                  value={formData.company_name}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                <input
                  type="text"
                  name="cnpj"
                  value={formData.cnpj}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contato da Empresa</label>
                <input
                  type="text"
                  name="contact_name"
                  value={formData.contact_name}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                />
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Número</label>
                  <input
                    type="text"
                    name="address_number"
                    value={formData.address_number}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
                  <input
                    type="text"
                    name="zip_code"
                    value={formData.zip_code}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                    placeholder="00000-000"
                  />
                </div>
                <div className="md:col-span-5">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
                <select
                  name="type"
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                >
                  <option value="">Selecione...</option>
                  <option value="Fornecedor">Fornecedor</option>
                  <option value="Terceiro">Terceiro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Setor onde será executado o serviço</label>
                <SelectWithNew
                  name="sector"
                  value={formData.sector || ""}
                  onChange={handleInputChange}
                  options={sectors}
                  placeholder="Selecione um setor"
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição da Atividade</label>
                <textarea
                  name="activity_description"
                  rows={3}
                  value={formData.activity_description}
                  onChange={(e) => setFormData({ ...formData, activity_description: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                ></textarea>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <h4 className="text-md font-semibold text-slate-800 mb-4">Funcionários que executarão as atividades</h4>
              
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Funcionário</label>
                    <input
                      type="text"
                      value={tempEmployee.employee_name}
                      onChange={(e) => setTempEmployee({ ...tempEmployee, employee_name: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                      placeholder="Ex: João Silva"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
                    <input
                      type="text"
                      value={tempEmployee.cpf}
                      onChange={(e) => setTempEmployee({ ...tempEmployee, cpf: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Função</label>
                    <input
                      type="text"
                      value={tempEmployee.employee_role}
                      onChange={(e) => setTempEmployee({ ...tempEmployee, employee_role: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                      placeholder="Ex: Eletricista"
                    />
                  </div>
                  <div>
                    <ImageUpload
                      label="Foto do Funcionário"
                      currentImage={tempEmployee.photo_url}
                      onImageSelect={(file) => {
                        const reader = new FileReader();
                        reader.onloadend = () => setTempEmployee({...tempEmployee, photo_url: reader.result as string});
                        reader.readAsDataURL(file);
                      }}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddTempEmployee}
                      disabled={!tempEmployee.employee_name.trim()}
                      className="w-full px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium disabled:opacity-50"
                    >
                      Adicionar Funcionário
                    </button>
                  </div>
                </div>
              </div>

              {newEmployees.length > 0 && (
                <div className="space-y-2">
                  {newEmployees.map((emp, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-3 border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        {emp.photo_url && (
                          <img src={emp.photo_url} alt={emp.employee_name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                        )}
                        <div>
                          <span className="font-medium text-slate-800">{emp.employee_name}</span>
                          {emp.cpf && <span className="text-slate-500 text-sm ml-2">CPF: {emp.cpf}</span>}
                          {emp.employee_role && <span className="text-slate-500 text-sm ml-2">- {emp.employee_role}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTempEmployee(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab("list")}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar Cadastro
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Employee Modal */}
      {showEmployeeModal && selectedSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Adicionar Funcionário</h3>
              <button onClick={() => setShowEmployeeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddEmployee} className="p-4 space-y-4">
              <div className="bg-emerald-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-indigo-800 font-medium">Empresa: {selectedSupplier.company_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Funcionário *</label>
                <input
                  type="text"
                  name="employee_name"
                  required
                  value={employeeFormData.employee_name}
                  onChange={handleEmployeeInputChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CPF</label>
                <input
                  type="text"
                  name="cpf"
                  value={employeeFormData.cpf}
                  onChange={handleEmployeeInputChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cargo/Função</label>
                <input
                  type="text"
                  name="employee_role"
                  value={employeeFormData.employee_role}
                  onChange={handleEmployeeInputChange}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                />
              </div>
              <div>
                <ImageUpload
                  label="Foto do Funcionário"
                  currentImage={employeeFormData.photo_url}
                  onImageSelect={(file) => {
                    const reader = new FileReader();
                    reader.onloadend = () => setEmployeeFormData({...employeeFormData, photo_url: reader.result as string});
                    reader.readAsDataURL(file);
                  }}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
