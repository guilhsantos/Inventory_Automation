"use client";

import { ShoppingCart, PlusCircle, List } from "lucide-react";
import Link from "next/link";

export default function OrdersPage() {
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
      <div className="text-center md:text-left">
        <h1 className="text-3xl font-black text-[#262626] flex items-center gap-3">
          <ShoppingCart className="text-[#5D286C]" /> Gestão de Pedidos
        </h1>
        <p className="text-gray-500 font-bold mt-2">Selecione uma ação para gerenciar as ordens de saída.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link 
          href="/orders/new"
          className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-50 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group"
        >
          <div className="bg-purple-50 text-[#5D286C] p-5 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
            <PlusCircle size={32} />
          </div>
          <h3 className="text-xl font-black text-[#262626]">Novo Pedido</h3>
          <p className="text-gray-400 text-sm font-medium mt-1">Cadastrar novo cliente e kits</p>
        </Link>

        <Link 
          href="/orders/list"
          className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-50 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center group"
        >
          <div className="bg-gray-50 text-gray-500 p-5 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
            <List size={32} />
          </div>
          <h3 className="text-xl font-black text-[#262626]">Lista de Pedidos</h3>
          <p className="text-gray-400 text-sm font-medium mt-1">Visualizar e gerenciar status</p>
        </Link>
      </div>
    </div>
  );
}