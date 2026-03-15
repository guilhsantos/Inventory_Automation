"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { Users, Mail, Shield, Search, Loader2, RefreshCw, UserPlus, Edit2, X, Save, Trash2 } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import ConfirmModal from "@/components/ConfirmModal";

export default function UsersConfigPage() {
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role: 'OP_ESTOQUE' });
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  useEffect(() => { 
    fetchUsers(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchUsers() {
    setLoading(true);
    // Ordenação por email para evitar erro 400 caso created_at falhe
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("email", { ascending: true });
    
    if (error) {
      showToast("Erro ao carregar usuários", "error");
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // Cliente temporário sem persistência para não deslogar o admin atual
      const tempSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );

      const { error } = await tempSupabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: { 
          data: { 
            full_name: newUser.full_name, 
            role: newUser.role 
          } 
        }
      });

      if (error) throw error;
      
      showToast("Acesso industrial criado com sucesso!");
      setIsCreateModalOpen(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'OP_ESTOQUE' });
      setTimeout(fetchUsers, 1500);
    } catch (err: any) {
      showToast(err.message || "Erro ao processar cadastro", "error");
    } finally { setIsSubmitting(false); }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editingUser.full_name,
          role: editingUser.role
        })
        .eq("id", editingUser.id);

      if (error) throw error;
      showToast("Utilizador atualizado!");
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err: any) { 
      showToast(err.message, "error"); 
    } finally { setIsSubmitting(false); }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      // Chama a função RPC que apaga o LOGIN (auth.users) e o PERFIL (public.profiles)
      const { error } = await supabase.rpc('delete_user_entirely', { 
        user_id_to_delete: userToDelete.id 
      });

      if (error) throw error;

      showToast("Login e perfil removidos permanentemente.");
      setUserToDelete(null);
      fetchUsers();
    } catch (err: any) {
      showToast("Erro ao remover: " + err.message, "error");
    }
  };

  const filteredUsers = profiles.filter(u => {
    const s = searchTerm.toLowerCase();
    return (u.full_name || "").toLowerCase().includes(s) || (u.email || "").toLowerCase().includes(s);
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#262626] flex items-center gap-3">
            <Users className="text-[#5D286C]" /> Gestão de Usuários
          </h1>
          <p className="text-gray-400 font-bold text-sm mt-1">Controle de acessos industrial.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={() => setIsCreateModalOpen(true)} 
            className="flex-1 md:flex-none bg-[#5D286C] text-white px-6 py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
          >
            <UserPlus size={20} /> NOVO USUÁRIO
          </button>
          <button onClick={fetchUsers} className="p-4 bg-white border-2 border-gray-50 rounded-2xl text-gray-400 hover:text-[#5D286C]">
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Listagem */}
      <div className="grid gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border-2 border-gray-50 shadow-sm">
            <Loader2 className="animate-spin text-[#5D286C] mb-4" size={40} />
            <p className="text-gray-400 font-black uppercase text-xs tracking-widest">Sincronizando Banco...</p>
          </div>
        ) : filteredUsers.map(user => (
          <div key={user.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-all hover:shadow-md">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="bg-purple-50 text-[#5D286C] w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0">
                {(user.full_name || user.email)?.[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-[#262626] truncate text-lg min-h-[1.5rem]">{user.full_name || ""}</h3>
                <p className="text-sm text-gray-400 font-bold"><Mail size={12} className="inline mr-1" /> {user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 flex-1 md:flex-none justify-center">
                <Shield size={16} className="text-[#5D286C]" />
                <span className="text-[10px] font-black uppercase text-gray-500">
                  {user.role === 'ADMIN' ? 'Administrador' : 'Operador'}
                </span>
              </div>
              <button 
                onClick={() => { setEditingUser(user); setIsEditModalOpen(true); }} 
                className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
              >
                <Edit2 size={20} />
              </button>
              <button 
                onClick={() => setUserToDelete(user)} 
                className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Criação */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setIsCreateModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"><X size={24} /></button>
            <h2 className="text-2xl font-black text-[#262626] mb-6 flex items-center gap-2"><UserPlus className="text-[#5D286C]" /> Criar Login</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <input required type="text" placeholder="Nome Completo" value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#5D286C]" />
              <input required type="email" placeholder="E-mail profissional" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#5D286C]" />
              <input required type="password" placeholder="Senha de acesso" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#5D286C]" />
              <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#5D286C]">
                <option value="OP_ESTOQUE">Operador de Estoque</option>
                <option value="ADMIN">Administrador</option>
              </select>
              <button disabled={isSubmitting} type="submit" className="w-full bg-[#5D286C] text-white p-5 rounded-2xl font-black shadow-xl mt-4">
                {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : "CRIAR ACESSO NO SISTEMA"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edição */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"><X size={24} /></button>
            <h2 className="text-2xl font-black text-[#262626] mb-6 flex items-center gap-2"><Edit2 className="text-[#5D286C]" /> Editar Perfil</h2>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <input type="text" required value={editingUser?.full_name || ""} onChange={e => setEditingUser({...editingUser, full_name: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#5D286C]" />
              <select value={editingUser?.role || "OP_ESTOQUE"} onChange={e => setEditingUser({...editingUser, role: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl font-bold outline-none focus:border-[#5D286C]">
                <option value="OP_ESTOQUE">Operador de Estoque</option>
                <option value="ADMIN">Administrador</option>
              </select>
              <button disabled={isSubmitting} type="submit" className="w-full bg-[#5D286C] text-white p-5 rounded-2xl font-black shadow-xl mt-4">
                {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : "SALVAR ALTERAÇÕES"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão */}
      <ConfirmModal 
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleDeleteUser}
        title="Excluir Definitivamente"
        message={`Deseja remover ${userToDelete?.email}? Isso apagará o login e o perfil permanentemente.`}
      />
    </div>
  );
}