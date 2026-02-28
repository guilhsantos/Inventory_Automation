import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-white">
      <h2 className="text-4xl font-black text-[#262626]">Ops! Página não encontrada</h2>
      <p className="text-gray-400 mt-4 mb-8 font-bold uppercase tracking-widest text-xs">
        O link que você acessou não existe ou está em manutenção.
      </p>
      <Link 
        href="/" 
        className="bg-[#5D286C] text-white px-10 py-5 rounded-2xl font-black hover:bg-[#7B1470] transition-all shadow-xl shadow-purple-100"
      >
        VOLTAR AO INÍCIO
      </Link>
    </div>
  );
}