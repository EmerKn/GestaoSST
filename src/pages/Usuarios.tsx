import { useState, useEffect } from "react";
import { Users, Plus, Edit, Trash2, Shield, Eye, Printer, UserCheck, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useAuth, User, Role } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { hashPassword } from "../lib/auth";

export default function Usuarios() {
  const { isMaster, isProprietario } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [approvingUser, setApprovingUser] = useState<User | null>(null);
  const [approveRole, setApproveRole] = useState<Role>("visualizador");
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    role: "visualizador" as Role
  });

  useEffect(() => {
    if (isMaster) loadUsers();
  }, [isMaster]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('name');
      if (error) throw error;
      setUsers(data as any || []);
    } catch (error) {
      console.error("Failed to load users", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      setShowConfirmModal(true);
    } else {
      executeSave();
    }
  };

  const executeSave = async () => {
    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        username: formData.username,
        role: formData.role
      };

      let error;

      if (editingUser) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', editingUser.id);
        error = updateError;
      } else {
        // In a real Supabase app, you would use an Edge Function to create users
        // For now, we assume users sign up themselves and appear here for role assignment
        alert("Novos usuários devem se cadastrar na tela de login. Use esta página para gerenciar permissões de usuários existentes.");
        setShowConfirmModal(false);
        return;
      }

      if (!error) {
        setShowConfirmModal(false);
        closeModal();
        loadUsers();
      } else {
        alert(error.message || "Erro ao salvar usuário");
        setShowConfirmModal(false);
      }
    } catch (error) {
      alert("Erro de conexão");
      setShowConfirmModal(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este usuário?")) {
      try {
        // This only deletes the profile, not the auth user. 
        // In a production app, use an Edge Function to delete from auth.users as well.
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (!error) loadUsers();
        else alert("Erro ao excluir usuário");
      } catch (error) {
        alert("Erro ao excluir usuário");
      }
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      username: user.username,
      password: "", // Don't populate password
      role: user.role
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      username: "",
      password: "",
      role: "visualizador"
    });
  };

  const openApproveModal = (user: User) => {
    setApprovingUser(user);
    setApproveRole(user.role);
  };

  const closeApproveModal = () => {
    setApprovingUser(null);
    setApproveRole("visualizador");
  };

  const handleApprove = async () => {
    if (!approvingUser) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: approveRole,
          status: 'active',
          access_expires_at: null
        })
        .eq('id', approvingUser.id);

      if (error) throw error;
      
      closeApproveModal();
      loadUsers();
    } catch (error) {
      alert("Erro ao aprovar usuário");
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'proprietario':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full"><Shield className="w-3 h-3" /> Proprietário</span>;
      case 'master':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full"><Shield className="w-3 h-3" /> Master</span>;
      case 'operador':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full"><Printer className="w-3 h-3" /> Operador</span>;
      case 'visualizador':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded-full"><Eye className="w-3 h-3" /> Visualizador</span>;
      default:
        return null;
    }
  };

  if (!isMaster) {
    return <div className="p-8 text-center text-red-600 font-bold">Acesso Negado. Apenas usuários Master ou Proprietário podem acessar esta página.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-200 flex items-center gap-2">
          <UserCheck className="w-8 h-8 text-emerald-600" />
          Controle de Usuários
        </h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium">
          <Plus className="w-5 h-5" /> Novo Usuário
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
              <tr>
                <th className="p-4 font-semibold">Nome</th>
                <th className="p-4 font-semibold">Usuário (Login)</th>
                <th className="p-4 font-semibold">E-mail</th>
                <th className="p-4 font-semibold">Nível de Acesso</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-medium text-gray-900">{user.name}</td>
                  <td className="p-4 text-gray-600">{user.username}</td>
                  <td className="p-4 text-gray-600">{user.email}</td>
                  <td className="p-4">{getRoleBadge(user.role)}</td>
                  <td className="p-4">
                    {user.status === 'pending_approval' ? (
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full w-fit">
                          <Clock className="w-3 h-3" /> Pendente
                        </span>
                        {user.access_expires_at && (
                          <span className="text-xs text-gray-500">
                            Expira: {new Date(user.access_expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full w-fit">
                        <CheckCircle className="w-3 h-3" /> Ativo
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user.status === 'pending_approval' && (
                        <button onClick={() => openApproveModal(user)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition" title="Aprovar Acesso">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {/* Proprietário can edit anyone. Master cannot edit Proprietário. */}
                      {((isProprietario && user.role !== 'proprietario') || (isMaster && !isProprietario && user.role !== 'proprietario' && user.role !== 'master')) && (
                        <>
                          <button onClick={() => openEditModal(user)} className="p-2 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition" title="Editar">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(user.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition" title="Excluir">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">Nenhum usuário encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900">{editingUser ? "Editar Usuário" : "Novo Usuário"}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input required type="email" name="email" value={formData.email} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuário (Login)</label>
                  <input required type="text" name="username" value={formData.username} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg placeholder:text-gray-400" disabled={!!editingUser && formData.role === 'master'} />
                </div>
                {editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Usuário (Sync)
                    </label>
                    <input disabled type="text" value={formData.username} className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nível de Acesso</label>
                  <select 
                    name="role" 
                    value={formData.role} 
                    onChange={handleInputChange} 
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                    disabled={!isProprietario && formData.role === 'master'}
                  >
                    <option value="visualizador">1. Visualizador</option>
                    <option value="operador">2. Operador</option>
                    <option value="master">3. Master</option>
                    {isProprietario && <option value="proprietario">4. Proprietário</option>}
                  </select>
                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <p><strong>Visualizador:</strong> Apenas visualiza relatórios e painéis.</p>
                    <p><strong>Operador:</strong> Pode visualizar tudo e imprimir relatórios, mas não pode lançar dados.</p>
                    <p><strong>Master:</strong> Acesso total ao sistema e controle de usuários cadastrados.</p>
                    {isProprietario && <p><strong>Proprietário:</strong> Acesso total e capaz de limitar/excluir usuários Master.</p>}
                  </div>
                </div>
              </div>

              <div className="p-6 flex justify-end gap-3 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-xl">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium">Salvar Usuário</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar Alteração</h3>
            <p className="text-gray-600 mb-6">Você realmente deseja alterar esses dados?</p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium flex-1"
              >
                Sair
              </button>
              <button 
                onClick={executeSave}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium flex-1"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {approvingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Aprovar Acesso</h2>
              <button onClick={closeApproveModal} className="text-gray-400 hover:text-gray-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                O usuário <strong>{approvingUser.name}</strong> ({approvingUser.email}) solicitou acesso via Google.
              </p>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Definir Nível de Acesso Permanente</label>
                <select 
                  value={approveRole} 
                  onChange={(e) => setApproveRole(e.target.value as Role)} 
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="visualizador">Visualizador</option>
                  <option value="operador">Operador</option>
                  <option value="master">Master</option>
                  {isProprietario && <option value="proprietario">Proprietário</option>}
                </select>
              </div>
            </div>

            <div className="p-6 flex justify-end gap-3 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-xl">
              <button type="button" onClick={closeApproveModal} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition">Cancelar</button>
              <button type="button" onClick={handleApprove} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium">Aprovar Usuário</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
