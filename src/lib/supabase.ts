// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// Usamos strings vazias como fallback para evitar que o build quebre
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)