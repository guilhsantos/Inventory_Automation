"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Users, Mail, Shield, Search, Loader2, UserPlus, RefreshCw } from "lucide-react";
import { useToast } from "@/lib/toast-context";

export default function UsersConfigPage() {
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      showToast("Erro ao carregar usuários", "error");
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  }

  const filteredUsers = profiles.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4">
      {/* Header com Busca */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#262626] flex items-center gap-3">
            <Users className="text-[#5D286C]" /> Gestão de Usuários
          </h1>
          <p className="text-gray-400 font-bold text-sm mt-1">Gerencie os acessos e permissões da equipe.</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
           <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input 
              type="text" 
              placeholder="Buscar..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full p-4 pl-12 bg-white border-2 border-gray-50 rounded-2xl font-bold outline-none focus:border-[#5D286C] shadow-sm"
            />
          </div>
          <button onClick={fetchUsers} className="p-4 bg-white border-2 border-gray-50 rounded-2xl text-gray-400 hover:text-[#5D286C] transition-all">
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border-2 border-gray-50">
          <Loader2 className="animate-spin text-[#5D286C] mb-4" size={40} />
          <p className="text-gray-400 font-black uppercase text-xs tracking-widest">Sincronizando Banco...</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredUsers.map(user => (
            <div key={user.id} className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-all hover:shadow-md group">
              <div className="flex items-center gap-4 w-full md:w-auto">
                {/* Avatar simples com as iniciais */}
                <div className="bg-purple-50 text-[#5D286C] w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 group-hover:scale-105 transition-transform">
                  {(user.full_name || user.email)?.[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-[#262626] truncate text-lg">
                    {user.full_name || "Sem Nome Definido"}
                  </h3>
                  <p className="text-sm text-gray-400 font-bold flex items-center gap-1">
                    <Mail size={12} /> {user.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 flex-1 md:flex-none justify-center">
                  <Shield size={16} className="text-[#5D286C]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    {user.role === 'ADMIN' ? 'Administrador' : 'Operador'}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="text-center py-20 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200">
              <UserPlus className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-400 font-bold uppercase text-xs">Nenhum usuário localizado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}