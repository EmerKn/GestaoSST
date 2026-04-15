import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, FileText, X, UserPlus, Camera, Upload, Trash2 } from "lucide-react";
import { SectorBadge } from "../utils/sectorColors";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { ImageUpload } from "../components/ImageUpload";
import { WebcamCapture } from "../components/WebcamCapture";
import { useDatabaseOptions } from "../hooks/useDatabaseOptions";
import { SelectWithNew } from "../components/SelectWithNew";

export function filterRealData<T extends { id: number }>(data: T[] | null): T[] {
  if (!data) return [];
  const hasRealData = data.some(item => item.id > 0);
  if (hasRealData) {
    return data.filter(item => item.id > 0);
  }
  return data;
}

interface Employee {
  id: number;
  name: string;
  cpf: string;
  role: string;
  sector: string;
  shift: string;
  photo_url: string;
  admission_date: string;
}

export default function Funcionarios() {
  const { canEdit, isMobile } = useAuth();
  const { sectors, roles, shifts } = useDatabaseOptions();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    role: "",
    sector: "",
    shift: "",
    photo_url: "",
    admission_date: ""
  });

  const canEditPage = canEdit && !isMobile;

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase.from('employees').select('*').order('name');
      if (error) throw error;
      if (data) setEmployees(filterRealData(data));
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('employees').insert([formData]);
      if (error) throw error;
      
      alert("Funcionário cadastrado com sucesso!");
      setShowAddModal(false);
      setFormData({
        name: "",
        cpf: "",
        role: "",
        sector: "",
        shift: "",
        photo_url: "",
        admission_date: ""
      });
      fetchEmployees();
    } catch (error) {
      console.error("Error saving employee:", error);
      alert("Erro ao salvar funcionário.");
    }
  };

  const filtered = employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200">Funcionários</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar funcionário..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none placeholder:text-gray-400"
            />
          </div>
          {canEditPage && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium"
            >
              <Plus className="w-5 h-5" />
              <span>Novo</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600 uppercase tracking-wider">
                <th className="p-4 font-medium">Nome</th>
                <th className="p-4 font-medium">Cargo</th>
                <th className="p-4 font-medium">Setor</th>
                <th className="p-4 font-medium">Turno</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50 transition">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={emp.photo_url} alt={emp.name} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                      <div>
                        <p className="font-medium text-gray-900">{emp.name}</p>
                        <p className="text-sm text-gray-500">{emp.cpf}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-700">{emp.role}</td>
                  <td className="p-4">
                    <SectorBadge sector={emp.sector} />
                  </td>
                  <td className="p-4 text-gray-700">{emp.shift}</td>
                  <td className="p-4 text-right">
                    <Link 
                      to={`/funcionarios/${emp.id}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 transition text-sm font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      Ficha SST
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Nenhum funcionário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto pt-10">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-emerald-600" />
                Novo Funcionário
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  <input 
                    type="text" 
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                  <input 
                    type="text" 
                    name="cpf"
                    required
                    value={formData.cpf}
                    onChange={handleInputChange}
                    placeholder="000.000.000-00"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                  <SelectWithNew
                    name="role"
                    required
                    value={formData.role || ""}
                    onChange={handleInputChange}
                    options={roles}
                    placeholder="Selecione um cargo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Setor</label>
                  <SelectWithNew
                    name="sector"
                    required
                    value={formData.sector}
                    onChange={handleInputChange}
                    options={sectors}
                    placeholder="Selecione um setor"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Turno</label>
                  <SelectWithNew
                    name="shift"
                    value={formData.shift || ""}
                    onChange={handleInputChange}
                    options={shifts.length > 0 ? shifts : ["1º Turno", "2º Turno", "3º Turno", "Comercial"]}
                    placeholder="Selecione um turno"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Admissão</label>
                  <input 
                    type="date" 
                    name="admission_date"
                    required
                    value={formData.admission_date}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-gray-400"
                  />
                </div>
                <div className="md:col-span-2">
                  <ImageUpload
                    label="Foto do Funcionário (Opcional)"
                    currentImage={formData.photo_url}
                    onImageSelect={(file) => {
                      const reader = new FileReader();
                      reader.onloadend = () => setFormData(prev => ({ ...prev, photo_url: reader.result as string }));
                      reader.readAsDataURL(file);
                    }}
                    onWebcamClick={() => setShowWebcam(true)}
                  />
                  <p className="text-xs text-gray-500 mt-2">A imagem será redimensionada automaticamente. Deixe em branco para usar um avatar padrão.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-medium transition"
                >
                  Salvar Funcionário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showWebcam && (
        <WebcamCapture 
          onCapture={(dataUrl) => {
            setFormData(prev => ({ ...prev, photo_url: dataUrl }));
            setShowWebcam(false);
          }}
          onCancel={() => setShowWebcam(false)}
        />
      )}
    </div>
  );
}
