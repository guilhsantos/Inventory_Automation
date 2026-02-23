"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
    } else {
      router.push("/"); // Vai para a home, onde faremos o roteamento por cargo
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-purple-600 p-3 rounded-2xl shadow-lg shadow-purple-200">
            <Lock className="text-white" size={32} />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-black tracking-tight text-gray-900">
          SGA <span className="text-purple-600">|</span> REAUTO CAR
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500 font-medium uppercase tracking-[0.2em]">
          Acesse sua conta operacional
        </p>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 border border-gray-100 shadow-2xl shadow-purple-100 rounded-[2.5rem] sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2">
                E-mail Profissional
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Mail size={20} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-11 pr-4 py-4 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-purple-50 focus:border-purple-600 text-gray-900 font-bold transition-all outline-none"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2">
                Senha de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-4 py-4 bg-gray-50 border-transparent rounded-2xl focus:bg-white focus:ring-4 focus:ring-purple-50 focus:border-purple-600 text-gray-900 font-bold transition-all outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <p className="text-sm text-red-600 font-bold text-center">{error}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-xl shadow-purple-200 text-lg font-black text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all disabled:bg-gray-300 disabled:shadow-none"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <>
                    ENTRAR NO SISTEMA
                    <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <p className="mt-10 text-center text-[10px] text-gray-300 font-bold uppercase tracking-[0.4em]">
        Reauto Car Automação v1.0
      </p>
    </div>
  );
}