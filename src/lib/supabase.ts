import { createClient } from '@supabase/supabase-js'

// Estas variáveis buscam os valores que você configurou na Vercel ou no arquivo .env
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Exporta o cliente para ser usado em todo o sistema (Auth, Banco, etc.)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)