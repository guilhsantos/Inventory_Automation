// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Se as variáveis não existirem (fase de build), não inicializa o cliente
// para evitar o crash, mas permite que o código seja compilado.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Variáveis do Supabase não encontradas.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
)