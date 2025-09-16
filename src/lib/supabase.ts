import { createClient } from '@supabase/supabase-js'

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos para o banco de dados
export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string
          auth_user_id: string
          nome: string
          email: string
          is_admin: boolean
          is_approved: boolean
          approved_by: string | null
          approved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id: string
          nome: string
          email: string
          is_admin?: boolean
          is_approved?: boolean
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string
          nome?: string
          email?: string
          is_admin?: boolean
          is_approved?: boolean
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_approval_requests: {
        Row: {
          id: string
          user_id: string
          email: string
          nome: string
          status: 'pending' | 'approved' | 'rejected'
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          admin_notes: string | null
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          nome: string
          status?: 'pending' | 'approved' | 'rejected'
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          admin_notes?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          nome?: string
          status?: 'pending' | 'approved' | 'rejected'
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          admin_notes?: string | null
        }
      }
      clientes: {
        Row: {
          id: string
          usuario_id: string
          nome: string
          email: string | null
          telefone: string
          cpf: string
          endereco: string | null
          data_cadastro: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          usuario_id: string
          nome: string
          email?: string | null
          telefone: string
          cpf: string
          endereco?: string | null
          data_cadastro: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          usuario_id?: string
          nome?: string
          email?: string | null
          telefone?: string
          cpf?: string
          endereco?: string | null
          data_cadastro?: string
          created_at?: string
          updated_at?: string
        }
      }
      vendas: {
        Row: {
          id: string
          usuario_id: string
          cliente: string
          localizador: string | null
          valor: number
          quantidade_pessoas: number
          origem: string | null
          destino: string | null
          data_ida: string | null
          data_volta: string | null
          companhia_aerea: string | null
          forma_pagamento: string
          data_venda: string
          status: string
          observacoes: string | null
          tipo_venda: string
          custo: number | null
          fornecedor: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          usuario_id: string
          cliente: string
          localizador?: string | null
          valor: number
          quantidade_pessoas: number
          origem?: string | null
          destino?: string | null
          data_ida?: string | null
          data_volta?: string | null
          companhia_aerea?: string | null
          forma_pagamento: string
          data_venda: string
          status: string
          observacoes?: string | null
          tipo_venda: string
          custo?: number | null
          fornecedor?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          usuario_id?: string
          cliente?: string
          localizador?: string | null
          valor?: number
          quantidade_pessoas?: number
          origem?: string | null
          destino?: string | null
          data_ida?: string | null
          data_volta?: string | null
          companhia_aerea?: string | null
          forma_pagamento?: string
          data_venda?: string
          status?: string
          observacoes?: string | null
          tipo_venda?: string
          custo?: number | null
          fornecedor?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// Funções auxiliares para autenticação
export const signInWithPassword = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export const signUp = async (email: string, password: string, nome: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nome: nome,
      }
    }
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Funções para verificar status do usuário
export const getUserStatus = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('is_admin, is_approved, nome, email')
    .eq('auth_user_id', userId)
    .single()
  
  return { data, error }
}

export const checkUserApprovalStatus = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_approval_requests')
    .select('status, requested_at, reviewed_at, admin_notes')
    .eq('user_id', userId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .single()
  
  return { data, error }
}

// Funções para administradores
export const getPendingApprovalRequests = async () => {
  const { data, error } = await supabase
    .from('user_approval_requests')
    .select('*')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
  
  return { data, error }
}

export const getAllApprovalRequests = async () => {
  const { data, error } = await supabase
    .from('user_approval_requests')
    .select('*')
    .order('requested_at', { ascending: false })
  
  return { data, error }
}

export const approveUser = async (requestId: string, adminUserId: string, notes?: string) => {
  const { data, error } = await supabase.rpc('approve_user', {
    request_id: requestId,
    admin_user_id: adminUserId,
    notes: notes || null
  })
  
  return { data, error }
}

export const rejectUser = async (requestId: string, adminUserId: string, notes?: string) => {
  const { data, error } = await supabase.rpc('reject_user', {
    request_id: requestId,
    admin_user_id: adminUserId,
    notes: notes || null
  })
  
  return { data, error }
}

// Funções para gerenciar clientes
export const getClientes = async (userId: string) => {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })
  
  return { data, error }
}

export const createCliente = async (cliente: Database['public']['Tables']['clientes']['Insert']) => {
  const { data, error } = await supabase
    .from('clientes')
    .insert(cliente)
    .select()
    .single()
  
  return { data, error }
}

export const updateCliente = async (id: string, cliente: Database['public']['Tables']['clientes']['Update']) => {
  const { data, error } = await supabase
    .from('clientes')
    .update({ ...cliente, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  return { data, error }
}

export const deleteCliente = async (id: string) => {
  const { error } = await supabase
    .from('clientes')
    .delete()
    .eq('id', id)
  
  return { error }
}

// Funções para gerenciar vendas
export const getVendas = async (userId: string) => {
  const { data, error } = await supabase
    .from('vendas')
    .select('*')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })
  
  return { data, error }
}

export const createVenda = async (venda: Database['public']['Tables']['vendas']['Insert']) => {
  const { data, error } = await supabase
    .from('vendas')
    .insert(venda)
    .select()
    .single()
  
  return { data, error }
}

export const updateVenda = async (id: string, venda: Database['public']['Tables']['vendas']['Update']) => {
  const { data, error } = await supabase
    .from('vendas')
    .update({ ...venda, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  return { data, error }
}

export const deleteVenda = async (id: string) => {
  const { error } = await supabase
    .from('vendas')
    .delete()
    .eq('id', id)
  
  return { error }
}

export const deleteVendas = async (ids: string[]) => {
  const { error } = await supabase
    .from('vendas')
    .delete()
    .in('id', ids)
  
  return { error }
}