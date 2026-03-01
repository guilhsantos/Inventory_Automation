"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Users, Mail, Shield, Search, Loader2 } from "lucide-react";

export default function UsersConfigPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    const { data } = await supabase.from("profiles").select("*").order("full_name");
    if (data) setProfiles(data);
    setLoading(false);
  }

  const filteredUsers = profiles.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-[#5D286C]" size={40} /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-black text-[#262626] flex items-center gap-3">
          <Users className="text-[#5D286C]" /> Gestão de Usuários
        </h1>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
          <input 
            type="text" 
            placeholder="Buscar usuário..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full p-4 pl-12 bg-white border-2 border-gray-50 rounded-2xl font-bold outline-none focus:border-[#5D286C] shadow-sm"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredUsers.map(user => (
          <div key={user.id} className="bg-white p-6 rounded-[2rem] border border-gray-50 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-all hover:shadow-md">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="bg-purple-50 text-[#5D286C] w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0">
                {user.full_name?.[0] || "?"}
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-[#262626] truncate">{user.full_name}</h3>
                <p className="text-sm text-gray-400 font-bold flex items-center gap-1">
                  <Mail size={12} /> {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 w-full md:w-auto justify-center">
              <Shield size={16} className="text-[#5D286C]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Acesso Operador</span>
            </div>
          </div>
        ))}
        {filteredUsers.length === 0 && <p className="text-center text-gray-400 py-10 font-bold">Nenhum usuário encontrado.</p>}
      </div>
    </div>
  );
}