"use client"

import { useState, useEffect } from 'react'
import { Plus, Search, Filter, TrendingUp, Users, DollarSign, Calendar, MapPin, Phone, Mail, Edit, Trash2, Eye, Plane, CreditCard, CheckCircle, Building2, Calculator, Copy, Check, LogOut, Lock, User, BarChart3, UserCheck, UserX, Clock, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { supabase, signInWithPassword, signUp, signOut, getCurrentUser, getUserStatus, checkUserApprovalStatus, getPendingApprovalRequests, getAllApprovalRequests, approveUser, rejectUser, getClientes, createCliente, updateCliente, deleteCliente, getVendas, createVenda, updateVenda, deleteVenda, deleteVendas } from '@/lib/supabase'

// Tipos de dados
interface Cliente {
  id: string
  nome: string
  email?: string
  telefone: string
  cpf: string
  endereco?: string
  dataCadastro: string
}

interface VendaAereo {
  id: string
  cliente: string
  localizador?: string
  valor: number
  quantidadePessoas: number
  origem?: string
  destino?: string
  dataIda?: string
  dataVolta?: string
  companhiaAerea?: string
  formaPagamento: 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'transferencia'
  dataVenda: string
  status: 'confirmada' | 'pendente' | 'cancelada'
  observacoes?: string
  tipoVenda: 'aereo' | 'pacotes' | 'hotel' | 'aluguel_carro' | 'assessoria_visto'
  // Dados financeiros
  custo?: number
  fornecedor?: string
}

interface Usuario {
  id: string
  nome: string
  email: string
  isAdmin: boolean
  isApproved: boolean
}

interface ApprovalRequest {
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

// Taxas de parcelamento
const TAXAS_PARCELAMENTO = {
  1: 4.2,
  2: 6.09,
  3: 7.01,
  4: 7.91,
  5: 8.8,
  6: 9.67,
  7: 12.59,
  8: 13.42,
  9: 14.25,
  10: 15.06,
  11: 15.87,
  12: 16.66
}

// Chaves para localStorage (fallback)
const STORAGE_KEYS = {
  CLIENTES: 'avia_destinos_clientes',
  VENDAS_AEREO: 'avia_destinos_vendas_aereo',
  USUARIOS: 'avia_destinos_usuarios',
  USUARIO_LOGADO: 'usuarioLogado',
  SESSION_EXPIRY: 'sessionExpiry'
}

// 🔧 FUNÇÕES CORRIGIDAS PARA MANIPULAÇÃO DE DATAS
const formatDateForInput = (dateString: string) => {
  if (!dateString) return ''
  // Se já está no formato YYYY-MM-DD, retorna como está
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString
  }
  // Se está em outro formato, converte para YYYY-MM-DD
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''
  return date.toISOString().split('T')[0]
}

const formatDateForDisplay = (dateString: string) => {
  if (!dateString) return ''
  try {
    // Cria a data considerando o fuso horário local para evitar problemas de UTC
    const [year, month, day] = dateString.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return date.toLocaleDateString('pt-BR')
  } catch (error) {
    console.error('Erro ao formatar data para exibição:', error)
    return dateString
  }
}

const formatDateTime = (dateString: string) => {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    return date.toLocaleString('pt-BR')
  } catch (error) {
    console.error('Erro ao formatar data/hora:', error)
    return dateString
  }
}

// 🔧 FUNÇÃO CORRIGIDA: Verificar se data está no intervalo considerando TAMBÉM data de volta
const isDateInRange = (dateString: string, startDate: string, endDate: string, dataVolta?: string) => {
  if (!dateString) return false
  if (!startDate && !endDate) return true
  
  try {
    // Converte as datas para objetos Date usando apenas a parte da data (sem horário)
    const checkDate = new Date(dateString + 'T00:00:00')
    const start = startDate ? new Date(startDate + 'T00:00:00') : null
    const end = endDate ? new Date(endDate + 'T23:59:59') : null
    
    // Verifica se a data de ida está no intervalo
    let idaNoIntervalo = false
    if (start && end) {
      idaNoIntervalo = checkDate >= start && checkDate <= end
    } else if (start) {
      idaNoIntervalo = checkDate >= start
    } else if (end) {
      idaNoIntervalo = checkDate <= end
    } else {
      idaNoIntervalo = true
    }
    
    // Se tem data de volta, verifica se ela também está no intervalo
    if (dataVolta) {
      const voltaDate = new Date(dataVolta + 'T00:00:00')
      let voltaNoIntervalo = false
      
      if (start && end) {
        voltaNoIntervalo = voltaDate >= start && voltaDate <= end
      } else if (start) {
        voltaNoIntervalo = voltaDate >= start
      } else if (end) {
        voltaNoIntervalo = voltaDate <= end
      } else {
        voltaNoIntervalo = true
      }
      
      // Retorna true se IDA OU VOLTA estiver no intervalo
      return idaNoIntervalo || voltaNoIntervalo
    }
    
    // Se não tem volta, retorna apenas o resultado da ida
    return idaNoIntervalo
  } catch (error) {
    console.error('Erro ao verificar intervalo de datas:', error)
    return false
  }
}

// 🔧 NOVA FUNÇÃO: Obter dados de faturamento mensal para gráfico de barras
const getFaturamentoMensalCompleto = (vendas: VendaAereo[]) => {
  // Obter ano atual
  const anoAtual = new Date().getFullYear()
  
  // Criar array com todos os meses do ano
  const mesesDoAno = []
  for (let mes = 1; mes <= 12; mes++) {
    const chave = `${anoAtual}-${String(mes).padStart(2, '0')}`
    mesesDoAno.push({
      mes: chave,
      mesFormatado: new Date(anoAtual, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      valor: 0
    })
  }
  
  // Agrupar vendas por mês/ano baseado na data da venda
  vendas.forEach(venda => {
    try {
      const data = new Date(venda.dataVenda + 'T00:00:00')
      const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
      
      // Encontrar o mês correspondente
      const mesIndex = mesesDoAno.findIndex(m => m.mes === chave)
      if (mesIndex !== -1) {
        mesesDoAno[mesIndex].valor += venda.valor
      }
    } catch (error) {
      console.error('Erro ao processar data da venda:', error)
    }
  })
  
  return mesesDoAno
}

// Função auxiliar para formatar mês/ano
const formatarMesAno = (mesAno: string) => {
  try {
    const [ano, mes] = mesAno.split('-')
    const data = new Date(parseInt(ano), parseInt(mes) - 1, 1)
    return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  } catch (error) {
    return mesAno
  }
}

// Função para obter label do tipo de venda
const getTipoVendaLabel = (tipo: string) => {
  const tipos = {
    'aereo': 'Aéreo',
    'pacotes': 'Pacotes',
    'hotel': 'Hotel',
    'aluguel_carro': 'Aluguel de Carro',
    'assessoria_visto': 'Assessoria de Visto'
  }
  return tipos[tipo as keyof typeof tipos] || tipo
}

export default function SistemaVendasViagem() {
  // Estados de autenticação
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false)
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', senha: '' })
  const [registerForm, setRegisterForm] = useState({ nome: '', email: '', senha: '', confirmarSenha: '' })
  const [usuarioLogado, setUsuarioLogado] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [userStatus, setUserStatus] = useState<'loading' | 'approved' | 'pending' | 'rejected' | 'not_found'>('loading')

  // Estados para aprovação de usuários (admin)
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([])
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null)
  const [approvalNotes, setApprovalNotes] = useState('')

  // Estados principais - COM PERSISTÊNCIA EM NUVEM
  const [activeTab, setActiveTab] = useState('dashboard')
  const [activeAereoTab, setActiveAereoTab] = useState('vendas')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vendasAereo, setVendasAereo] = useState<VendaAereo[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  
  // Estados para seleção múltipla de vendas
  const [vendasSelecionadas, setVendasSelecionadas] = useState<string[]>([])
  const [modoSelecao, setModoSelecao] = useState(false)
  
  // Filtros de data da viagem (intervalo)
  const [filtroDataViagemInicio, setFiltroDataViagemInicio] = useState('')
  const [filtroDataViagemFim, setFiltroDataViagemFim] = useState('')
  
  // 🔧 NOVOS FILTROS: Para dashboard (baseado na data da venda)
  const [filtroDataVendaInicio, setFiltroDataVendaInicio] = useState('')
  const [filtroDataVendaFim, setFiltroDataVendaFim] = useState('')
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCalculadoraOpen, setIsCalculadoraOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'cliente' | 'aereo' | 'financeiro'>('cliente')
  const [editingItem, setEditingItem] = useState<any>(null)
  const [valorBase, setValorBase] = useState('')
  const [taxasCalculadas, setTaxasCalculadas] = useState<{parcela: number, valor: number}[]>([])
  const [copiado, setCopiado] = useState(false)

  // 🔄 EFEITO PARA VERIFICAR AUTENTICAÇÃO E CARREGAR DADOS
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (user) {
          console.log('✅ Usuário autenticado:', user.email)
          
          // Verificar status do usuário
          const { data: userStatusData, error: statusError } = await getUserStatus(user.id)
          
          if (statusError) {
            console.error('❌ Erro ao verificar status do usuário:', statusError)
            setUserStatus('not_found')
            return
          }

          if (userStatusData) {
            const usuario: Usuario = {
              id: user.id,
              nome: userStatusData.nome,
              email: userStatusData.email,
              isAdmin: userStatusData.is_admin,
              isApproved: userStatusData.is_approved
            }
            
            setUsuarioLogado(usuario)
            
            if (userStatusData.is_approved) {
              setIsLoggedIn(true)
              setUserStatus('approved')
              await carregarDadosNuvem(user.id)
              
              // Se for admin, carregar solicitações de aprovação
              if (userStatusData.is_admin) {
                await carregarSolicitacoesAprovacao()
              }
            } else {
              setUserStatus('pending')
            }
          } else {
            setUserStatus('not_found')
          }
        } else {
          console.log('❌ Usuário não autenticado')
          await carregarDadosLocal()
        }
      } catch (error) {
        console.error('❌ Erro ao verificar autenticação:', error)
        await carregarDadosLocal()
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Função para carregar solicitações de aprovação (admin)
  const carregarSolicitacoesAprovacao = async () => {
    try {
      const { data, error } = await getAllApprovalRequests()
      if (error) {
        console.error('❌ Erro ao carregar solicitações:', error)
      } else {
        setApprovalRequests(data || [])
      }
    } catch (error) {
      console.error('❌ Erro ao carregar solicitações:', error)
    }
  }

  // 🔄 FUNÇÃO PARA CARREGAR DADOS DA NUVEM
  const carregarDadosNuvem = async (userId: string) => {
    try {
      console.log('🔄 Carregando dados da nuvem para usuário:', userId)
      
      // Carregar clientes
      const { data: clientesData, error: clientesError } = await getClientes(userId)
      if (clientesError) {
        console.error('❌ Erro ao carregar clientes:', clientesError)
      } else {
        const clientesFormatados = clientesData?.map(cliente => ({
          id: cliente.id,
          nome: cliente.nome,
          email: cliente.email || undefined,
          telefone: cliente.telefone,
          cpf: cliente.cpf,
          endereco: cliente.endereco || undefined,
          dataCadastro: cliente.data_cadastro
        })) || []
        setClientes(clientesFormatados)
        console.log(`✅ ${clientesFormatados.length} clientes carregados da nuvem`)
      }

      // Carregar vendas
      const { data: vendasData, error: vendasError } = await getVendas(userId)
      if (vendasError) {
        console.error('❌ Erro ao carregar vendas:', vendasError)
      } else {
        const vendasFormatadas = vendasData?.map(venda => ({
          id: venda.id,
          cliente: venda.cliente,
          localizador: venda.localizador || undefined,
          valor: venda.valor,
          quantidadePessoas: venda.quantidade_pessoas,
          origem: venda.origem || undefined,
          destino: venda.destino || undefined,
          dataIda: venda.data_ida || undefined,
          dataVolta: venda.data_volta || undefined,
          companhiaAerea: venda.companhia_aerea || undefined,
          formaPagamento: venda.forma_pagamento as any,
          dataVenda: venda.data_venda,
          status: venda.status as any,
          observacoes: venda.observacoes || undefined,
          tipoVenda: venda.tipo_venda as any,
          custo: venda.custo || 0,
          fornecedor: venda.fornecedor || undefined
        })) || []
        setVendasAereo(vendasFormatadas)
        console.log(`✅ ${vendasFormatadas.length} vendas carregadas da nuvem`)
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados da nuvem:', error)
      showToast('❌ Erro ao carregar dados da nuvem. Usando dados locais.', 'error')
      await carregarDadosLocal()
    }
  }

  // 🔄 FUNÇÃO PARA CARREGAR DADOS LOCAIS (FALLBACK)
  const carregarDadosLocal = async () => {
    try {
      console.log('🔄 Carregando dados locais como fallback...')
      
      if (typeof window !== 'undefined') {
        const clientesLocal = localStorage.getItem(STORAGE_KEYS.CLIENTES)
        const vendasLocal = localStorage.getItem(STORAGE_KEYS.VENDAS_AEREO)
        
        if (clientesLocal) {
          const clientesData = JSON.parse(clientesLocal)
          setClientes(clientesData)
          console.log(`✅ ${clientesData.length} clientes carregados do localStorage`)
        }
        
        if (vendasLocal) {
          const vendasData = JSON.parse(vendasLocal)
          setVendasAereo(vendasData)
          console.log(`✅ ${vendasData.length} vendas carregadas do localStorage`)
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar dados locais:', error)
    }
  }

  // 🔄 FUNÇÃO PARA MIGRAR DADOS LOCAIS PARA NUVEM
  const migrarDadosParaNuvem = async (userId: string) => {
    try {
      console.log('🔄 Iniciando migração de dados locais para nuvem...')
      
      if (typeof window !== 'undefined') {
        const clientesLocal = localStorage.getItem(STORAGE_KEYS.CLIENTES)
        const vendasLocal = localStorage.getItem(STORAGE_KEYS.VENDAS_AEREO)
        
        // Migrar clientes
        if (clientesLocal) {
          const clientesData = JSON.parse(clientesLocal)
          for (const cliente of clientesData) {
            const { error } = await createCliente({
              usuario_id: userId,
              nome: cliente.nome,
              email: cliente.email,
              telefone: cliente.telefone,
              cpf: cliente.cpf,
              endereco: cliente.endereco,
              data_cadastro: cliente.dataCadastro
            })
            if (error) {
              console.error('❌ Erro ao migrar cliente:', error)
            }
          }
          console.log(`✅ ${clientesData.length} clientes migrados para nuvem`)
        }
        
        // Migrar vendas
        if (vendasLocal) {
          const vendasData = JSON.parse(vendasLocal)
          for (const venda of vendasData) {
            const { error } = await createVenda({
              usuario_id: userId,
              cliente: venda.cliente,
              localizador: venda.localizador,
              valor: venda.valor,
              quantidade_pessoas: venda.quantidadePessoas,
              origem: venda.origem,
              destino: venda.destino,
              data_ida: venda.dataIda,
              data_volta: venda.dataVolta,
              companhia_aerea: venda.companhiaAerea,
              forma_pagamento: venda.formaPagamento,
              data_venda: venda.dataVenda,
              status: venda.status,
              observacoes: venda.observacoes,
              tipo_venda: venda.tipoVenda,
              custo: venda.custo || 0,
              fornecedor: venda.fornecedor
            })
            if (error) {
              console.error('❌ Erro ao migrar venda:', error)
            }
          }
          console.log(`✅ ${vendasData.length} vendas migradas para nuvem`)
        }
        
        // Limpar dados locais após migração bem-sucedida
        localStorage.removeItem(STORAGE_KEYS.CLIENTES)
        localStorage.removeItem(STORAGE_KEYS.VENDAS_AEREO)
        console.log('✅ Dados locais limpos após migração')
        
        showToast('✅ Dados migrados para nuvem com sucesso!')
      }
    } catch (error) {
      console.error('❌ Erro na migração:', error)
      showToast('❌ Erro ao migrar dados. Tente novamente.', 'error')
    }
  }

  // Funções de autenticação
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!loginForm.email || !loginForm.senha) {
      showToast('⚠️ Por favor, preencha todos os campos!', 'error')
      return
    }

    try {
      setLoading(true)
      console.log('🔄 Tentando fazer login...')
      
      const { data, error } = await signInWithPassword(loginForm.email, loginForm.senha)
      
      if (error) {
        console.error('❌ Erro no login:', error.message)
        showToast(`❌ Erro no login: ${error.message}`, 'error')
        return
      }

      if (data.user) {
        console.log('✅ Login bem-sucedido:', data.user.email)
        
        // Verificar status do usuário
        const { data: userStatusData, error: statusError } = await getUserStatus(data.user.id)
        
        if (statusError || !userStatusData) {
          showToast('❌ Erro ao verificar status do usuário', 'error')
          return
        }

        const usuario: Usuario = {
          id: data.user.id,
          nome: userStatusData.nome,
          email: userStatusData.email,
          isAdmin: userStatusData.is_admin,
          isApproved: userStatusData.is_approved
        }
        
        setUsuarioLogado(usuario)
        
        if (userStatusData.is_approved) {
          setIsLoggedIn(true)
          setUserStatus('approved')
          setIsLoginDialogOpen(false)
          setLoginForm({ email: '', senha: '' })
          
          // Verificar se há dados locais para migrar
          const temDadosLocais = localStorage.getItem(STORAGE_KEYS.CLIENTES) || localStorage.getItem(STORAGE_KEYS.VENDAS_AEREO)
          if (temDadosLocais) {
            const migrar = confirm('🔄 Encontramos dados salvos localmente.\\n\\nDeseja migrar estes dados para a nuvem?\\n\\nIsso permitirá acessá-los de qualquer dispositivo.')
            if (migrar) {
              await migrarDadosParaNuvem(data.user.id)
            }
          }
          
          // Carregar dados da nuvem
          await carregarDadosNuvem(data.user.id)
          
          // Se for admin, carregar solicitações
          if (userStatusData.is_admin) {
            await carregarSolicitacoesAprovacao()
          }
          
          showToast('✅ Login realizado com sucesso!')
        } else {
          setUserStatus('pending')
          setIsLoginDialogOpen(false)
          showToast('⏳ Sua conta está aguardando aprovação do administrador.')
        }
      }
    } catch (error) {
      console.error('❌ Erro inesperado no login:', error)
      showToast('❌ Erro inesperado. Tente novamente.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!registerForm.nome || !registerForm.email || !registerForm.senha || !registerForm.confirmarSenha) {
      showToast('⚠️ Por favor, preencha todos os campos!', 'error')
      return
    }

    if (registerForm.senha !== registerForm.confirmarSenha) {
      showToast('❌ As senhas não coincidem!', 'error')
      return
    }

    if (registerForm.senha.length < 6) {
      showToast('❌ A senha deve ter pelo menos 6 caracteres!', 'error')
      return
    }

    try {
      setLoading(true)
      console.log('🔄 Tentando criar conta...')
      
      const { data, error } = await signUp(registerForm.email, registerForm.senha, registerForm.nome)
      
      if (error) {
        console.error('❌ Erro no registro:', error.message)
        showToast(`❌ Erro ao criar conta: ${error.message}`, 'error')
        return
      }

      console.log('✅ Conta criada com sucesso')
      showToast('✅ Conta criada! Sua solicitação foi enviada para aprovação do administrador.')
      setIsRegisterDialogOpen(false)
      setRegisterForm({ nome: '', email: '', senha: '', confirmarSenha: '' })
    } catch (error) {
      console.error('❌ Erro inesperado no registro:', error)
      showToast('❌ Erro inesperado. Tente novamente.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      console.log('🚪 Fazendo logout...')
      await signOut()
      setIsLoggedIn(false)
      setUsuarioLogado(null)
      setUserStatus('loading')
      setClientes([])
      setVendasAereo([])
      setVendasSelecionadas([])
      setModoSelecao(false)
      setApprovalRequests([])
      console.log('✅ Logout realizado com sucesso')
      showToast('✅ Logout realizado com sucesso!')
    } catch (error) {
      console.error('❌ Erro no logout:', error)
      showToast('❌ Erro ao fazer logout', 'error')
    }
  }

  // Funções para aprovação de usuários (admin)
  const handleApproveUser = async (requestId: string, notes?: string) => {
    if (!usuarioLogado?.isAdmin) return

    try {
      setLoading(true)
      const { error } = await approveUser(requestId, usuarioLogado.id, notes)
      
      if (error) {
        console.error('❌ Erro ao aprovar usuário:', error)
        showToast('❌ Erro ao aprovar usuário', 'error')
        return
      }

      showToast('✅ Usuário aprovado com sucesso!')
      await carregarSolicitacoesAprovacao()
      setIsApprovalDialogOpen(false)
      setSelectedRequest(null)
      setApprovalNotes('')
    } catch (error) {
      console.error('❌ Erro ao aprovar usuário:', error)
      showToast('❌ Erro ao aprovar usuário', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRejectUser = async (requestId: string, notes?: string) => {
    if (!usuarioLogado?.isAdmin) return

    try {
      setLoading(true)
      const { error } = await rejectUser(requestId, usuarioLogado.id, notes)
      
      if (error) {
        console.error('❌ Erro ao rejeitar usuário:', error)
        showToast('❌ Erro ao rejeitar usuário', 'error')
        return
      }

      showToast('✅ Usuário rejeitado!')
      await carregarSolicitacoesAprovacao()
      setIsApprovalDialogOpen(false)
      setSelectedRequest(null)
      setApprovalNotes('')
    } catch (error) {
      console.error('❌ Erro ao rejeitar usuário:', error)
      showToast('❌ Erro ao rejeitar usuário', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Funções auxiliares
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const getFormaPagamentoLabel = (forma: string) => {
    const formas = {
      'dinheiro': 'Dinheiro',
      'cartao_credito': 'Cartão de Crédito',
      'cartao_debito': 'Cartão de Débito',
      'pix': 'PIX',
      'transferencia': 'Transferência'
    }
    return formas[forma as keyof typeof formas] || forma
  }

  // Função para mostrar toast (simulação)
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    console.log(`🔔 Toast ${type}:`, message)
    alert(message)
  }

  // Função para calcular taxas de parcelamento
  const calcularTaxas = (valor: number) => {
    const taxas = []
    for (let parcela = 1; parcela <= 12; parcela++) {
      const taxa = TAXAS_PARCELAMENTO[parcela as keyof typeof TAXAS_PARCELAMENTO]
      const valorComTaxa = valor * (1 + taxa / 100)
      const valorParcela = valorComTaxa / parcela
      taxas.push({ parcela, valor: valorParcela })
    }
    return taxas
  }

  // Função para gerar texto das taxas para copiar
  const gerarTextoTaxas = (valor: number, taxas: {parcela: number, valor: number}[]) => {
    let texto = `🌟 *AVIA DESTINOS* 🌟\\n\\n💰 *Opções de Parcelamento no cartão de crédito*\\nValor base: ${formatCurrency(valor)}\\n\\n`
    
    taxas.forEach(({ parcela, valor: valorParcela }) => {
      if (parcela === 1) {
        const valorTotal = valor * (1 + TAXAS_PARCELAMENTO[1] / 100)
        texto += `💳 *1x* - ${formatCurrency(valorTotal)}\\n`
      } else {
        texto += `💳 *${parcela}x* de ${formatCurrency(valorParcela)}\\n`
      }
    })
    
    texto += `\\n*AVIA DESTINOS* - Transformando sonhos, em destinos! 🌍`
    return texto
  }

  // Função para copiar texto - CORRIGIDA COMPLETAMENTE
  const copiarTaxas = async () => {
    console.log('🔄 Iniciando função copiarTaxas')
    
    if (taxasCalculadas.length === 0 || !valorBase) {
      console.log('❌ Dados insuficientes para copiar')
      showToast('❌ Calcule as taxas primeiro!', 'error')
      return
    }
    
    const valor = parseFloat(valorBase)
    if (isNaN(valor) || valor <= 0) {
      console.log('❌ Valor inválido:', valorBase)
      showToast('❌ Digite um valor válido!', 'error')
      return
    }
    
    const texto = gerarTextoTaxas(valor, taxasCalculadas)
    console.log('📝 Texto gerado para cópia:', texto.substring(0, 100) + '...')
    
    try {
      // Método 1: Clipboard API moderna
      if (navigator.clipboard && window.isSecureContext) {
        console.log('✅ Tentando Clipboard API')
        await navigator.clipboard.writeText(texto)
        console.log('✅ Copiado com Clipboard API')
        setCopiado(true)
        showToast('✅ Taxas copiadas com sucesso!')
        setTimeout(() => setCopiado(false), 3000)
        return
      }
      
      // Método 2: Fallback com textarea
      console.log('🔄 Usando fallback com textarea')
      const textArea = document.createElement('textarea')
      textArea.value = texto
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      textArea.style.opacity = '0'
      textArea.style.pointerEvents = 'none'
      textArea.setAttribute('readonly', '')
      
      document.body.appendChild(textArea)
      
      // Selecionar e copiar
      textArea.focus()
      textArea.select()
      textArea.setSelectionRange(0, texto.length)
      
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      
      if (successful) {
        console.log('✅ Copiado com execCommand')
        setCopiado(true)
        showToast('✅ Taxas copiadas com sucesso!')
        setTimeout(() => setCopiado(false), 3000)
        return
      }
      
      throw new Error('execCommand falhou')
    } catch (err) {
      console.error('❌ Erro ao copiar:', err)
      
      // Método 3: Fallback manual
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      
      if (isMobile) {
        // Para mobile - criar modal com texto selecionável
        const modal = document.createElement('div')
        modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.8);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        `
        
        const content = document.createElement('div')
        content.style.cssText = `
          background: white;
          padding: 20px;
          border-radius: 8px;
          max-width: 90%;
          max-height: 80%;
          overflow: auto;
        `
        
        content.innerHTML = `
          <h3 style="color: #e91e63; margin-bottom: 15px; font-size: 18px;">📋 Copie o texto abaixo:</h3>
          <textarea readonly style="width: 100%; height: 300px; font-family: monospace; font-size: 12px; border: 1px solid #ccc; padding: 10px; resize: none;">${texto}</textarea>
          <div style="margin-top: 15px; text-align: center;">
            <button id="fecharModal" style="background: #e91e63; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 16px;">Fechar</button>
          </div>
        `
        
        modal.appendChild(content)
        document.body.appendChild(modal)
        
        // Selecionar texto automaticamente
        const textarea = content.querySelector('textarea') as HTMLTextAreaElement
        textarea.focus()
        textarea.select()
        
        // Fechar modal
        const fecharBtn = content.querySelector('#fecharModal') as HTMLButtonElement
        fecharBtn.onclick = () => document.body.removeChild(modal)
        modal.onclick = (e) => {
          if (e.target === modal) document.body.removeChild(modal)
        }
        
        showToast('📋 Texto disponível para cópia! Toque e segure para selecionar.')
      } else {
        // Para desktop - usar prompt
        prompt('Não foi possível copiar automaticamente. Copie o texto abaixo (Ctrl+C):', texto)
        showToast('📋 Texto disponível para cópia!')
      }
    }
  }

  // Funções para seleção múltipla de vendas
  const toggleSelecaoVenda = (vendaId: string) => {
    console.log('🔄 Toggle seleção venda:', vendaId)
    setVendasSelecionadas(prev => {
      const novaSelecao = prev.includes(vendaId) 
        ? prev.filter(id => id !== vendaId)
        : [...prev, vendaId]
      console.log('✅ Nova seleção:', novaSelecao)
      return novaSelecao
    })
  }

  const selecionarTodasVendas = () => {
    console.log('🔄 Selecionando todas as vendas')
    if (vendasSelecionadas.length === vendasAereoFiltradas.length) {
      console.log('✅ Desmarcando todas')
      setVendasSelecionadas([])
    } else {
      const todasIds = vendasAereoFiltradas.map(v => v.id)
      console.log('✅ Selecionando todas:', todasIds)
      setVendasSelecionadas(todasIds)
    }
  }

  // Função para excluir vendas selecionadas - CORRIGIDA COM SUPABASE
  const excluirVendasSelecionadas = async () => {
    console.log('🗑️ Iniciando exclusão de vendas selecionadas:', vendasSelecionadas)
    
    if (vendasSelecionadas.length === 0) {
      console.log('❌ Nenhuma venda selecionada')
      showToast('❌ Selecione pelo menos uma venda para excluir!', 'error')
      return
    }

    const vendasParaExcluir = vendasAereo.filter(v => vendasSelecionadas.includes(v.id))
    console.log('📋 Vendas para excluir:', vendasParaExcluir)
    
    const confirmacao = confirm(
      `⚠️ CONFIRMAÇÃO DE EXCLUSÃO MÚLTIPLA ⚠️\\n\\n` +
      `Tem certeza que deseja excluir ${vendasSelecionadas.length} venda(s)?\\n\\n` +
      vendasParaExcluir.map(v => `• ${v.cliente} - ${getTipoVendaLabel(v.tipoVenda)} (${formatCurrency(v.valor)})`).join('\\n') +
      `\\n\\n⚠️ Esta ação NÃO pode ser desfeita!\\n\\n` +
      `Clique em \"OK\" para confirmar a exclusão.`
    )

    if (confirmacao) {
      console.log('✅ Confirmação recebida, excluindo vendas')
      
      try {
        if (isLoggedIn && usuarioLogado) {
          // Excluir da nuvem
          const { error } = await deleteVendas(vendasSelecionadas)
          if (error) {
            console.error('❌ Erro ao excluir vendas da nuvem:', error)
            showToast('❌ Erro ao excluir vendas da nuvem', 'error')
            return
          }
        }
        
        // Atualizar o estado local
        setVendasAereo(prev => {
          const novasVendas = prev.filter(v => !vendasSelecionadas.includes(v.id))
          console.log('✅ Estado atualizado. Vendas restantes:', novasVendas.length)
          return novasVendas
        })
        
        showToast(`✅ ${vendasSelecionadas.length} venda(s) excluída(s) com sucesso!`)
        setVendasSelecionadas([])
        setModoSelecao(false)
        console.log('✅ Exclusão múltipla concluída')
      } catch (error) {
        console.error('❌ Erro na exclusão múltipla:', error)
        showToast('❌ Erro ao excluir vendas', 'error')
      }
    } else {
      console.log('❌ Exclusão cancelada pelo usuário')
    }
  }

  // 🔧 ESTATÍSTICAS DO DASHBOARD COM FILTROS
  const vendasFiltradas = vendasAereo.filter(venda => {
    if (!filtroDataVendaInicio && !filtroDataVendaFim) return true
    
    try {
      const dataVenda = new Date(venda.dataVenda + 'T00:00:00')
      const inicio = filtroDataVendaInicio ? new Date(filtroDataVendaInicio + 'T00:00:00') : null
      const fim = filtroDataVendaFim ? new Date(filtroDataVendaFim + 'T23:59:59') : null
      
      if (inicio && fim) {
        return dataVenda >= inicio && dataVenda <= fim
      } else if (inicio) {
        return dataVenda >= inicio
      } else if (fim) {
        return dataVenda <= fim
      }
      
      return true
    } catch (error) {
      console.error('Erro ao filtrar vendas por data:', error)
      return false
    }
  })

  const faturamentoTotal = vendasFiltradas.reduce((sum, venda) => sum + venda.valor, 0)
  const totalVendas = vendasFiltradas.length
  const totalCustos = vendasFiltradas.reduce((sum, venda) => sum + (venda.custo || 0), 0)
  const totalLucro = faturamentoTotal - totalCustos
  const vendasConfirmadas = vendasAereo.filter(v => v.status === 'confirmada').length
  const vendasPendentes = vendasAereo.filter(v => v.status === 'pendente').length
  const totalClientes = clientes.length

  // 🔧 FUNÇÃO CORRIGIDA: Obter próximas viagens considerando data de volta
  const getProximasViagens = () => {
    const hoje = new Date()
    const proximosSete = new Date()
    proximosSete.setDate(hoje.getDate() + 7)
    
    return vendasAereo.filter(venda => {
      if (!venda.dataIda) return false
      
      const dataIda = new Date(venda.dataIda + 'T00:00:00')
      const dataVolta = venda.dataVolta ? new Date(venda.dataVolta + 'T00:00:00') : null
      
      // Verifica se a ida OU a volta está nos próximos 7 dias
      const idaProxima = dataIda >= hoje && dataIda <= proximosSete
      const voltaProxima = dataVolta ? (dataVolta >= hoje && dataVolta <= proximosSete) : false
      
      return idaProxima || voltaProxima
    }).sort((a, b) => {
      // Ordena pela data mais próxima (ida ou volta)
      if (!a.dataIda || !b.dataIda) return 0
      const dataA = new Date(a.dataIda + 'T00:00:00')
      const dataB = new Date(b.dataIda + 'T00:00:00')
      return dataA.getTime() - dataB.getTime()
    })
  }

  // Função para abrir dialog
  const openDialog = (type: 'cliente' | 'aereo' | 'financeiro', item?: any) => {
    setDialogType(type)
    setEditingItem(item || null)
    setIsDialogOpen(true)
  }

  // Função para excluir cliente - CORRIGIDA COM SUPABASE
  const excluirCliente = async (id: string) => {
    console.log('🗑️ Iniciando exclusão de cliente:', id)
    
    const cliente = clientes.find(c => c.id === id)
    if (!cliente) {
      console.log('❌ Cliente não encontrado:', id)
      showToast('❌ Cliente não encontrado!', 'error')
      return
    }
    
    const confirmacao = confirm(
      `⚠️ CONFIRMAÇÃO DE EXCLUSÃO ⚠️\\n\\n` +
      `Tem certeza que deseja excluir o cliente?\\n\\n` +
      `👤 Nome: ${cliente.nome}\\n` +
      `📧 Email: ${cliente.email || 'Não informado'}\\n` +
      `📱 Telefone: ${cliente.telefone}\\n\\n` +
      `⚠️ Esta ação NÃO pode ser desfeita!\\n\\n` +
      `Clique em \"OK\" para confirmar a exclusão.`
    )
    
    if (confirmacao) {
      console.log('✅ Confirmação recebida, excluindo cliente')
      
      try {
        if (isLoggedIn && usuarioLogado) {
          // Excluir da nuvem
          const { error } = await deleteCliente(id)
          if (error) {
            console.error('❌ Erro ao excluir cliente da nuvem:', error)
            showToast('❌ Erro ao excluir cliente da nuvem', 'error')
            return
          }
        }
        
        // Atualizar o estado local
        setClientes(prev => {
          const novosClientes = prev.filter(c => c.id !== id)
          console.log('✅ Estado atualizado. Clientes restantes:', novosClientes.length)
          return novosClientes
        })
        
        showToast(`✅ Cliente \"${cliente.nome}\" foi excluído com sucesso!`)
        console.log('✅ Exclusão de cliente concluída')
      } catch (error) {
        console.error('❌ Erro na exclusão do cliente:', error)
        showToast('❌ Erro ao excluir cliente', 'error')
      }
    } else {
      console.log('❌ Exclusão cancelada pelo usuário')
    }
  }

  // Função para excluir venda individual - CORRIGIDA COM SUPABASE
  const excluirVenda = async (id: string) => {
    console.log('🗑️ Iniciando exclusão de venda:', id)
    
    const venda = vendasAereo.find(v => v.id === id)
    if (!venda) {
      console.log('❌ Venda não encontrada:', id)
      showToast('❌ Venda não encontrada!', 'error')
      return
    }
    
    const confirmacao = confirm(
      `⚠️ CONFIRMAÇÃO DE EXCLUSÃO ⚠️\\n\\n` +
      `Tem certeza que deseja excluir esta venda?\\n\\n` +
      `👤 Cliente: ${venda.cliente}\\n` +
      `🏷️ Tipo: ${getTipoVendaLabel(venda.tipoVenda)}\\n` +
      `✈️ Localizador: ${venda.localizador || 'N/A'}\\n` +
      `💰 Valor: ${formatCurrency(venda.valor)}\\n` +
      `📅 Data da Venda: ${formatDateForDisplay(venda.dataVenda)}\\n\\n` +
      `⚠️ Esta ação NÃO pode ser desfeita!\\n\\n` +
      `Clique em \"OK\" para confirmar a exclusão.`
    )
    
    if (confirmacao) {
      console.log('✅ Confirmação recebida, excluindo venda')
      
      try {
        if (isLoggedIn && usuarioLogado) {
          // Excluir da nuvem
          const { error } = await deleteVenda(id)
          if (error) {
            console.error('❌ Erro ao excluir venda da nuvem:', error)
            showToast('❌ Erro ao excluir venda da nuvem', 'error')
            return
          }
        }
        
        // Atualizar o estado local
        setVendasAereo(prev => {
          const novasVendas = prev.filter(v => v.id !== id)
          console.log('✅ Estado atualizado. Vendas restantes:', novasVendas.length)
          return novasVendas
        })
        
        showToast(`✅ Venda do cliente \"${venda.cliente}\" foi excluída com sucesso!`)
        console.log('✅ Exclusão de venda concluída')
      } catch (error) {
        console.error('❌ Erro na exclusão da venda:', error)
        showToast('❌ Erro ao excluir venda', 'error')
      }
    } else {
      console.log('❌ Exclusão cancelada pelo usuário')
    }
  }

  // 🔧 FUNÇÃO CORRIGIDA PARA SALVAR ITEM - COM SUPABASE
  const handleSave = async (formData: FormData) => {
    const data = Object.fromEntries(formData.entries())
    
    try {
      if (dialogType === 'cliente') {
        const clienteData = {
          nome: data.nome as string,
          email: data.email as string || undefined,
          telefone: data.telefone as string,
          cpf: data.cpf as string,
          endereco: data.endereco as string || undefined,
          dataCadastro: editingItem?.dataCadastro || new Date().toISOString().split('T')[0]
        }
        
        if (editingItem) {
          // Atualizar cliente existente
          if (isLoggedIn && usuarioLogado) {
            const { data: clienteAtualizado, error } = await updateCliente(editingItem.id, {
              nome: clienteData.nome,
              email: clienteData.email,
              telefone: clienteData.telefone,
              cpf: clienteData.cpf,
              endereco: clienteData.endereco,
              data_cadastro: clienteData.dataCadastro
            })
            
            if (error) {
              console.error('❌ Erro ao atualizar cliente na nuvem:', error)
              showToast('❌ Erro ao atualizar cliente na nuvem', 'error')
              return
            }
          }
          
          setClientes(prev => 
            prev.map(c => c.id === editingItem.id ? { ...clienteData, id: editingItem.id } : c)
          )
          showToast('✅ Cliente atualizado com sucesso!')
        } else {
          // Criar novo cliente
          let novoId = Date.now().toString()
          
          if (isLoggedIn && usuarioLogado) {
            const { data: clienteCriado, error } = await createCliente({
              usuario_id: usuarioLogado.id,
              nome: clienteData.nome,
              email: clienteData.email,
              telefone: clienteData.telefone,
              cpf: clienteData.cpf,
              endereco: clienteData.endereco,
              data_cadastro: clienteData.dataCadastro
            })
            
            if (error) {
              console.error('❌ Erro ao criar cliente na nuvem:', error)
              showToast('❌ Erro ao criar cliente na nuvem', 'error')
              return
            }
            
            if (clienteCriado) {
              novoId = clienteCriado.id
            }
          }
          
          setClientes(prev => [...prev, { ...clienteData, id: novoId }])
          showToast('✅ Cliente cadastrado com sucesso!')
        }
      } else if (dialogType === 'aereo') {
        // 🔧 CORREÇÃO CRÍTICA: Garantir que as datas sejam salvas no formato correto
        const dataVenda = data.dataVenda as string || new Date().toISOString().split('T')[0]
        const dataIda = data.dataIda as string || undefined
        const dataVolta = data.dataVolta as string || undefined
        
        console.log('🔧 Salvando venda com datas:', {
          dataVenda,
          dataIda,
          dataVolta
        })
        
        const vendaData = {
          cliente: data.cliente as string,
          localizador: data.localizador as string || undefined,
          valor: Number(data.valor),
          quantidadePessoas: Number(data.quantidadePessoas),
          origem: data.origem as string || undefined,
          destino: data.destino as string || undefined,
          dataIda: dataIda,
          dataVolta: dataVolta,
          companhiaAerea: data.companhiaAerea as string || undefined,
          formaPagamento: data.formaPagamento as 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'transferencia',
          dataVenda: dataVenda,
          status: data.status as 'confirmada' | 'pendente' | 'cancelada',
          observacoes: data.observacoes as string || undefined,
          tipoVenda: data.tipoVenda as 'aereo' | 'pacotes' | 'hotel' | 'aluguel_carro' | 'assessoria_visto',
          custo: editingItem?.custo || 0,
          fornecedor: editingItem?.fornecedor || data.companhiaAerea as string || undefined
        }
        
        if (editingItem) {
          // Atualizar venda existente
          if (isLoggedIn && usuarioLogado) {
            const { data: vendaAtualizada, error } = await updateVenda(editingItem.id, {
              cliente: vendaData.cliente,
              localizador: vendaData.localizador,
              valor: vendaData.valor,
              quantidade_pessoas: vendaData.quantidadePessoas,
              origem: vendaData.origem,
              destino: vendaData.destino,
              data_ida: vendaData.dataIda,
              data_volta: vendaData.dataVolta,
              companhia_aerea: vendaData.companhiaAerea,
              forma_pagamento: vendaData.formaPagamento,
              data_venda: vendaData.dataVenda,
              status: vendaData.status,
              observacoes: vendaData.observacoes,
              tipo_venda: vendaData.tipoVenda,
              custo: vendaData.custo,
              fornecedor: vendaData.fornecedor
            })
            
            if (error) {
              console.error('❌ Erro ao atualizar venda na nuvem:', error)
              showToast('❌ Erro ao atualizar venda na nuvem', 'error')
              return
            }
          }
          
          setVendasAereo(prev => 
            prev.map(v => v.id === editingItem.id ? { ...vendaData, id: editingItem.id } : v)
          )
          showToast('✅ Venda atualizada com sucesso!')
        } else {
          // Criar nova venda
          let novoId = Date.now().toString()
          
          if (isLoggedIn && usuarioLogado) {
            const { data: vendaCriada, error } = await createVenda({
              usuario_id: usuarioLogado.id,
              cliente: vendaData.cliente,
              localizador: vendaData.localizador,
              valor: vendaData.valor,
              quantidade_pessoas: vendaData.quantidadePessoas,
              origem: vendaData.origem,
              destino: vendaData.destino,
              data_ida: vendaData.dataIda,
              data_volta: vendaData.dataVolta,
              companhia_aerea: vendaData.companhiaAerea,
              forma_pagamento: vendaData.formaPagamento,
              data_venda: vendaData.dataVenda,
              status: vendaData.status,
              observacoes: vendaData.observacoes,
              tipo_venda: vendaData.tipoVenda,
              custo: vendaData.custo || 0,
              fornecedor: vendaData.fornecedor
            })
            
            if (error) {
              console.error('❌ Erro ao criar venda na nuvem:', error)
              showToast('❌ Erro ao criar venda na nuvem', 'error')
              return
            }
            
            if (vendaCriada) {
              novoId = vendaCriada.id
            }
          }
          
          setVendasAereo(prev => [...prev, { ...vendaData, id: novoId }])
          showToast('✅ Venda registrada com sucesso!')
        }
      } else if (dialogType === 'financeiro') {
        const vendaAtualizada = {
          ...editingItem,
          custo: Number(data.custo),
          fornecedor: data.fornecedor as string
        }
        
        if (isLoggedIn && usuarioLogado) {
          const { error } = await updateVenda(editingItem.id, {
            custo: vendaAtualizada.custo,
            fornecedor: vendaAtualizada.fornecedor
          })
          
          if (error) {
            console.error('❌ Erro ao atualizar dados financeiros na nuvem:', error)
            showToast('❌ Erro ao atualizar dados financeiros na nuvem', 'error')
            return
          }
        }
        
        setVendasAereo(prev => 
          prev.map(v => v.id === editingItem.id ? vendaAtualizada : v)
        )
        showToast('✅ Dados financeiros atualizados com sucesso!')
      }
      
      setIsDialogOpen(false)
      setEditingItem(null)
    } catch (error) {
      console.error('❌ Erro ao salvar:', error)
      showToast('❌ Erro ao salvar dados', 'error')
    }
  }

  // 🔧 FILTRAR VENDAS AÉREAS COM CORREÇÃO DE DATAS (CONSIDERANDO DATA DE VOLTA)
  const vendasAereoFiltradas = vendasAereo.filter(venda => {
    const matchSearch = venda.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (venda.localizador && venda.localizador.toLowerCase().includes(searchTerm.toLowerCase())) ||
                       (venda.origem && venda.origem.toLowerCase().includes(searchTerm.toLowerCase())) ||
                       (venda.destino && venda.destino.toLowerCase().includes(searchTerm.toLowerCase())) ||
                       getTipoVendaLabel(venda.tipoVenda).toLowerCase().includes(searchTerm.toLowerCase())
    
    // 🔧 CORREÇÃO: Usar função atualizada que considera data de volta
    const matchDateViagem = venda.dataIda ? isDateInRange(venda.dataIda, filtroDataViagemInicio, filtroDataViagemFim, venda.dataVolta) : true
    
    return matchSearch && matchDateViagem
  })

  // Se estiver carregando, mostrar loading
  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50 dark:bg-pink-950 flex items-center justify-center">
        <Card className="w-full max-w-md bg-white dark:bg-pink-900 border-pink-200 dark:border-pink-800">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto mb-4"></div>
            <p className="text-pink-600 dark:text-pink-400">Carregando sistema...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Se usuário está aguardando aprovação
  if (userStatus === 'pending') {
    return (
      <div className="min-h-screen bg-pink-50 dark:bg-pink-950 flex items-center justify-center">
        <Card className="w-full max-w-md bg-white dark:bg-pink-900 border-pink-200 dark:border-pink-800">
          <CardHeader className="text-center">
            <img 
              src="https://k6hrqrxuu8obbfwn.public.blob.vercel-storage.com/temp/ed3007d0-fd94-4cc7-8795-b2632e307727.jpg" 
              alt="Avia Destinos Logo" 
              className="h-16 w-auto mx-auto rounded-lg mb-4"
            />
            <CardTitle className="text-2xl font-bold text-pink-900 dark:text-pink-100">
              Aguardando Aprovação
            </CardTitle>
            <CardDescription className="text-pink-600 dark:text-pink-400">
              Sua conta foi criada e está aguardando aprovação do administrador
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                Conta Pendente de Aprovação
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                O administrador foi notificado sobre sua solicitação. Você receberá acesso assim que sua conta for aprovada.
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-pink-600 dark:text-pink-400 mb-4">
                Usuário: {usuarioLogado?.nome} ({usuarioLogado?.email})
              </p>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="border-pink-200 text-pink-700 hover:bg-pink-50"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Se não estiver logado, mostrar tela de login
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-pink-50 dark:bg-pink-950 flex items-center justify-center">
        <Card className="w-full max-w-md bg-white dark:bg-pink-900 border-pink-200 dark:border-pink-800">
          <CardHeader className="text-center">
            <img 
              src="https://k6hrqrxuu8obbfwn.public.blob.vercel-storage.com/temp/ed3007d0-fd94-4cc7-8795-b2632e307727.jpg" 
              alt="Avia Destinos Logo" 
              className="h-16 w-auto mx-auto rounded-lg mb-4"
            />
            <CardTitle className="text-2xl font-bold text-pink-900 dark:text-pink-100">
              Avia Destinos
            </CardTitle>
            <CardDescription className="text-pink-600 dark:text-pink-400">
              Sistema de Controle de Vendas - Acesso Controlado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col space-y-2">
              <Button
                onClick={() => setIsLoginDialogOpen(true)}
                className="bg-pink-600 hover:bg-pink-700 text-white w-full"
                disabled={loading}
              >
                <Lock className="h-4 w-4 mr-2" />
                {loading ? 'Carregando...' : 'Fazer Login'}
              </Button>
              <Button
                onClick={() => setIsRegisterDialogOpen(true)}
                variant="outline"
                className="border-pink-200 text-pink-700 hover:bg-pink-50 w-full"
                disabled={loading}
              >
                <User className="h-4 w-4 mr-2" />
                Solicitar Acesso
              </Button>
            </div>
            
            <div className="text-center text-sm text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-800/50 p-3 rounded-lg">
              <p className="font-medium">🔒 Sistema com Aprovação</p>
              <p>Novos usuários precisam de aprovação do administrador</p>
              <p>Dados sincronizados na nuvem</p>
            </div>
          </CardContent>
        </Card>

        {/* Dialog de Login */}
        <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
          <DialogContent className="bg-white dark:bg-pink-900 border-pink-200 dark:border-pink-800">
            <DialogHeader>
              <DialogTitle className="text-pink-900 dark:text-pink-100">
                🔐 Login Seguro
              </DialogTitle>
              <DialogDescription className="text-pink-600 dark:text-pink-400">
                Digite suas credenciais para acessar o sistema.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loginEmail" className="text-pink-900 dark:text-pink-100">
                  E-mail
                </Label>
                <Input
                  id="loginEmail"
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                  className="border-pink-200 focus:ring-pink-500"
                  placeholder="seu@email.com"
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="loginSenha" className="text-pink-900 dark:text-pink-100">
                  Senha
                </Label>
                <Input
                  id="loginSenha"
                  type="password"
                  value={loginForm.senha}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, senha: e.target.value }))}
                  required
                  className="border-pink-200 focus:ring-pink-500"
                  placeholder="Digite sua senha"
                  disabled={loading}
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsLoginDialogOpen(false)}
                  className="border-pink-200 text-pink-700 hover:bg-pink-50"
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  className="bg-pink-600 hover:bg-pink-700 text-white"
                  disabled={loading}
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog de Registro */}
        <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
          <DialogContent className="bg-white dark:bg-pink-900 border-pink-200 dark:border-pink-800">
            <DialogHeader>
              <DialogTitle className="text-pink-900 dark:text-pink-100">
                📝 Solicitar Acesso
              </DialogTitle>
              <DialogDescription className="text-pink-600 dark:text-pink-400">
                Crie sua conta. Ela será enviada para aprovação do administrador.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="registerNome" className="text-pink-900 dark:text-pink-100">
                  Nome Completo
                </Label>
                <Input
                  id="registerNome"
                  value={registerForm.nome}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, nome: e.target.value }))}
                  required
                  className="border-pink-200 focus:ring-pink-500"
                  placeholder="Seu nome completo"
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="registerEmail" className="text-pink-900 dark:text-pink-100">
                  E-mail
                </Label>
                <Input
                  id="registerEmail"
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                  className="border-pink-200 focus:ring-pink-500"
                  placeholder="seu@email.com"
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="registerSenha" className="text-pink-900 dark:text-pink-100">
                  Senha
                </Label>
                <Input
                  id="registerSenha"
                  type="password"
                  value={registerForm.senha}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, senha: e.target.value }))}
                  required
                  minLength={6}
                  className="border-pink-200 focus:ring-pink-500"
                  placeholder="Mínimo 6 caracteres"
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="registerConfirmarSenha" className="text-pink-900 dark:text-pink-100">
                  Confirmar Senha
                </Label>
                <Input
                  id="registerConfirmarSenha"
                  type="password"
                  value={registerForm.confirmarSenha}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmarSenha: e.target.value }))}
                  required
                  className="border-pink-200 focus:ring-pink-500"
                  placeholder="Digite a senha novamente"
                  disabled={loading}
                />
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <Shield className="h-4 w-4 inline mr-1" />
                  Sua conta será enviada para aprovação do administrador antes de ter acesso ao sistema.
                </p>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsRegisterDialogOpen(false)}
                  className="border-pink-200 text-pink-700 hover:bg-pink-50"
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  className="bg-pink-600 hover:bg-pink-700 text-white"
                  disabled={loading}
                >
                  {loading ? 'Enviando...' : 'Solicitar Acesso'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-pink-50 dark:bg-pink-950">
      {/* Header */}
      <header className="bg-white dark:bg-pink-900 border-b border-pink-200 dark:border-pink-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img 
                src="https://k6hrqrxuu8obbfwn.public.blob.vercel-storage.com/temp/ed3007d0-fd94-4cc7-8795-b2632e307727.jpg" 
                alt="Avia Destinos Logo" 
                className="h-10 w-auto rounded-lg"
              />
              <div>
                <h1 className="text-xl font-bold text-pink-900 dark:text-pink-100">
                  Avia Destinos
                </h1>
                <p className="text-sm text-pink-600 dark:text-pink-400">
                  Sistema Seguro com Aprovação {usuarioLogado?.isAdmin && '👑 Admin'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-pink-700 dark:text-pink-300">
                Olá, {usuarioLogado?.nome}
              </span>
              
              {/* Botão de Aprovações (apenas para admin) */}
              {usuarioLogado?.isAdmin && (
                <Button
                  onClick={() => setActiveTab('aprovacoes')}
                  variant="outline"
                  className="border-orange-200 text-orange-700 hover:bg-orange-50"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Aprovações ({approvalRequests.filter(r => r.status === 'pending').length})
                </Button>
              )}
              
              <Button
                onClick={() => setIsCalculadoraOpen(true)}
                className="bg-pink-600 hover:bg-pink-700 text-white"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Calculadora de Taxas
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pink-400 h-4 w-4" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64 border-pink-200 focus:ring-pink-500"
                />
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="border-pink-200 text-pink-700 hover:bg-pink-50"
                disabled={loading}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full ${usuarioLogado?.isAdmin ? 'grid-cols-4' : 'grid-cols-3'} bg-white dark:bg-pink-900 border border-pink-200 dark:border-pink-800`}>
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-pink-600 data-[state=active]:text-white">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="clientes" className="data-[state=active]:bg-pink-600 data-[state=active]:text-white">
              Clientes
            </TabsTrigger>
            <TabsTrigger value="aereo" className="data-[state=active]:bg-pink-600 data-[state=active]:text-white">
              Vendas
            </TabsTrigger>
            {usuarioLogado?.isAdmin && (
              <TabsTrigger value="aprovacoes" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white">
                Aprovações ({approvalRequests.filter(r => r.status === 'pending').length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Aba de Aprovações (apenas para admin) */}
          {usuarioLogado?.isAdmin && (
            <TabsContent value="aprovacoes" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  Gerenciar Aprovações de Usuários
                </h2>
                <Button
                  onClick={carregarSolicitacoesAprovacao}
                  variant="outline"
                  className="border-orange-200 text-orange-700 hover:bg-orange-50"
                  disabled={loading}
                >
                  🔄 Atualizar
                </Button>
              </div>

              {/* Solicitações Pendentes */}
              <Card className="bg-white dark:bg-orange-900 border-orange-100 dark:border-orange-800">
                <CardHeader>
                  <CardTitle className="text-orange-900 dark:text-orange-100 flex items-center">
                    <Clock className="h-5 w-5 mr-2" />
                    Solicitações Pendentes ({approvalRequests.filter(r => r.status === 'pending').length})
                  </CardTitle>
                  <CardDescription className="text-orange-600 dark:text-orange-400">
                    Usuários aguardando aprovação para acessar o sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {approvalRequests.filter(r => r.status === 'pending').map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-4 border border-orange-100 dark:border-orange-800 rounded-lg bg-orange-50 dark:bg-orange-800/20">
                        <div className="flex-1">
                          <p className="font-medium text-orange-900 dark:text-orange-100">
                            {request.nome}
                          </p>
                          <p className="text-sm text-orange-600 dark:text-orange-400">
                            {request.email}
                          </p>
                          <p className="text-xs text-orange-500 dark:text-orange-500">
                            Solicitado em: {formatDateTime(request.requested_at)}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(request)
                              setIsApprovalDialogOpen(true)
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectUser(request.id, 'Rejeitado pelo administrador')}
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            disabled={loading}
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                        </div>
                      </div>
                    ))}
                    {approvalRequests.filter(r => r.status === 'pending').length === 0 && (
                      <p className="text-center text-orange-600 dark:text-orange-400 py-4">
                        Nenhuma solicitação pendente
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Histórico de Aprovações */}
              <Card className="bg-white dark:bg-pink-900 border-pink-100 dark:border-pink-800">
                <CardHeader>
                  <CardTitle className="text-pink-900 dark:text-pink-100">
                    Histórico de Aprovações
                  </CardTitle>
                  <CardDescription className="text-pink-600 dark:text-pink-400">
                    Todas as solicitações processadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-pink-50 dark:bg-pink-800">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase">
                            Nome
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase">
                            Email
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase">
                            Status
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase">
                            Data Solicitação
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase">
                            Data Revisão
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase">
                            Observações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-pink-100 dark:divide-pink-800">
                        {approvalRequests.map((request) => (
                          <tr key={request.id} className="hover:bg-pink-50 dark:hover:bg-pink-800">
                            <td className="px-4 py-2 text-sm text-pink-900 dark:text-pink-100">
                              {request.nome}
                            </td>
                            <td className="px-4 py-2 text-sm text-pink-700 dark:text-pink-300">
                              {request.email}
                            </td>
                            <td className="px-4 py-2">
                              <Badge 
                                variant={
                                  request.status === 'approved' ? 'default' : 
                                  request.status === 'pending' ? 'secondary' : 'destructive'
                                }
                                className={
                                  request.status === 'approved' ? 'bg-green-600 hover:bg-green-700' :
                                  request.status === 'pending' ? 'bg-yellow-600 hover:bg-yellow-700' : ''
                                }
                              >
                                {request.status === 'approved' ? 'Aprovado' :
                                 request.status === 'pending' ? 'Pendente' : 'Rejeitado'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-sm text-pink-700 dark:text-pink-300">
                              {formatDateTime(request.requested_at)}
                            </td>
                            <td className="px-4 py-2 text-sm text-pink-700 dark:text-pink-300">
                              {request.reviewed_at ? formatDateTime(request.reviewed_at) : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-pink-700 dark:text-pink-300">
                              {request.admin_notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {approvalRequests.length === 0 && (
                    <p className="text-center text-pink-600 dark:text-pink-400 py-4">
                      Nenhuma solicitação encontrada
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* 🔧 FILTROS DO DASHBOARD */}
            <Card className="bg-white dark:bg-pink-900 border-pink-100 dark:border-pink-800">
              <CardHeader>
                <CardTitle className="text-pink-900 dark:text-pink-100 flex items-center">
                  <Filter className="h-5 w-5 mr-2" />
                  Filtros do Dashboard
                </CardTitle>
                <CardDescription className="text-pink-600 dark:text-pink-400">
                  Filtre os dados do dashboard por período de vendas realizadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="dashboardInicio" className="text-sm text-pink-600 dark:text-pink-400 whitespace-nowrap">
                      De:
                    </Label>
                    <Input
                      id="dashboardInicio"
                      type="date"
                      value={filtroDataVendaInicio}
                      onChange={(e) => setFiltroDataVendaInicio(e.target.value)}
                      className="w-40 border-pink-200 focus:ring-pink-500"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="dashboardFim" className="text-sm text-pink-600 dark:text-pink-400 whitespace-nowrap">
                      Até:
                    </Label>
                    <Input
                      id="dashboardFim"
                      type="date"
                      value={filtroDataVendaFim}
                      onChange={(e) => setFiltroDataVendaFim(e.target.value)}
                      className="w-40 border-pink-200 focus:ring-pink-500"
                    />
                  </div>
                  {(filtroDataVendaInicio || filtroDataVendaFim) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFiltroDataVendaInicio('')
                        setFiltroDataVendaFim('')
                      }}
                      className="border-pink-200 text-pink-700 hover:bg-pink-50"
                    >
                      Limpar Filtros
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-white dark:bg-pink-900 border-pink-100 dark:border-pink-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-pink-900 dark:text-pink-100">
                    Faturamento Total
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-pink-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-pink-900 dark:text-pink-100">
                    {formatCurrency(faturamentoTotal)}
                  </div>
                  <p className="text-xs text-pink-600 dark:text-pink-400">
                    {(filtroDataVendaInicio || filtroDataVendaFim) ? 'Período filtrado' : 'Todas as vendas'}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-pink-900 border-pink-100 dark:border-pink-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-pink-900 dark:text-pink-100">
                    Total de Vendas
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-pink-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-pink-900 dark:text-pink-100">
                    {totalVendas}
                  </div>
                  <p className="text-xs text-pink-600 dark:text-pink-400">
                    {(filtroDataVendaInicio || filtroDataVendaFim) ? 'Período filtrado' : 'Vendas cadastradas'}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-pink-900 border-pink-100 dark:border-pink-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-pink-900 dark:text-pink-100">
                    Total de Custos
                  </CardTitle>
                  <Building2 className="h-4 w-4 text-pink-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-pink-900 dark:text-pink-100">
                    {formatCurrency(totalCustos)}
                  </div>
                  <p className="text-xs text-pink-600 dark:text-pink-400">
                    {(filtroDataVendaInicio || filtroDataVendaFim) ? 'Período filtrado' : 'Custos operacionais'}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-pink-900 border-pink-100 dark:border-pink-800">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-pink-900 dark:text-pink-100">
                    Total de Lucro
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-pink-600" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${totalLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totalLucro)}
                  </div>
                  <p className="text-xs text-pink-600 dark:text-pink-400">
                    {(filtroDataVendaInicio || filtroDataVendaFim) ? 'Período filtrado' : 'Faturamento - Custos'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 🔧 GRÁFICO DE FATURAMENTO MENSAL CORRIGIDO - Barras proporcionais aos valores */}
            <Card className="bg-white dark:bg-pink-900 border-pink-100 dark:border-pink-800">
              <CardHeader>
                <CardTitle className="text-pink-900 dark:text-pink-100 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Faturamento Mensal - {new Date().getFullYear()}
                </CardTitle>
                <CardDescription className="text-pink-600 dark:text-pink-400">
                  Gráfico de barras verticais do faturamento de todos os meses do ano
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const dadosFaturamento = getFaturamentoMensalCompleto(vendasAereo)
                  const valorMaximo = Math.max(...dadosFaturamento.map(d => d.valor), 0)
                  
                  return (
                    <div className="space-y-4">
                      {/* Gráfico de Barras Verticais - CORRIGIDO para altura proporcional */}
                      <div className="flex items-end justify-between h-64 bg-pink-50 dark:bg-pink-800 rounded-lg p-4 space-x-2">
                        {dadosFaturamento.map((item, index) => (
                          <div key={item.mes} className="flex flex-col items-center flex-1">
                            <div className="flex-1 flex items-end w-full">
                              <div
                                className="bg-gradient-to-t from-pink-500 to-pink-600 rounded-t-md w-full transition-all duration-500 ease-out hover:from-pink-600 hover:to-pink-700 cursor-pointer relative group"
                                style={{
                                  height: `${valorMaximo > 0 ? Math.max((item.valor / valorMaximo) * 200, 4) : 4}px`,
                                  minHeight: '4px'
                                }}
                                title={`${item.mesFormatado}: ${formatCurrency(item.valor)}`}
                              >
                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                  {formatCurrency(item.valor)}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-pink-600 dark:text-pink-400 transform -rotate-45 origin-center whitespace-nowrap">
                              {item.mesFormatado.split(' ')[0].substring(0, 3)}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Resumo */}
                      <div className="mt-6 p-4 bg-pink-50 dark:bg-pink-800 rounded-lg">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-xs text-pink-600 dark:text-pink-400">Total do Ano</p>
                            <p className="text-lg font-bold text-pink-900 dark:text-pink-100">
                              {formatCurrency(dadosFaturamento.reduce((sum, item) => sum + item.valor, 0))}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-pink-600 dark:text-pink-400">Média Mensal</p>
                            <p className="text-lg font-bold text-pink-900 dark:text-pink-100">
                              {formatCurrency(dadosFaturamento.reduce((sum, item) => sum + item.valor, 0) / 12)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-pink-600 dark:text-pink-400">Melhor Mês</p>
                            <p className="text-lg font-bold text-pink-900 dark:text-pink-100">
                              {formatCurrency(valorMaximo)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Próximas Viagens - CORRIGIDO para considerar data de volta */}
            <Card className="bg-white dark:bg-pink-900 border-pink-100 dark:border-pink-800">
              <CardHeader>
                <CardTitle className="text-pink-900 dark:text-pink-100 flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Próximas Viagens (7 dias)
                </CardTitle>
                <CardDescription className="text-pink-600 dark:text-pink-400">
                  Viagens com datas próximas que precisam de atenção (considera ida e volta)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {getProximasViagens().slice(0, 5).map((venda) => (
                    <div key={venda.id} className="flex items-center justify-between p-4 border border-pink-100 dark:border-pink-800 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-pink-900 dark:text-pink-100">
                          {venda.cliente}
                        </p>
                        <p className="text-sm text-pink-600 dark:text-pink-400">
                          {getTipoVendaLabel(venda.tipoVenda)}
                          {venda.origem && venda.destino && ` - ${venda.origem} → ${venda.destino}`}
                        </p>
                        <p className="text-xs text-pink-500 dark:text-pink-500">
                          {venda.quantidadePessoas} pax
                          {venda.companhiaAerea && ` | ${venda.companhiaAerea}`}
                          {venda.localizador && ` | Localizador: ${venda.localizador}`}
                        </p>
                      </div>
                      <div className="text-right">
                        {venda.dataIda && (
                          <p className="font-bold text-pink-900 dark:text-pink-100">
                            {formatDateForDisplay(venda.dataIda)}
                            {venda.dataVolta && (
                              <span className="text-xs block text-pink-600">
                                Volta: {formatDateForDisplay(venda.dataVolta)}
                              </span>
                            )}
                          </p>
                        )}
                        <Badge 
                          variant={venda.status === 'confirmada' ? 'default' : venda.status === 'pendente' ? 'secondary' : 'destructive'}
                          className={venda.status === 'confirmada' ? 'bg-pink-600 hover:bg-pink-700' : ''}
                        >
                          {venda.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {getProximasViagens().length === 0 && (
                    <p className="text-center text-pink-600 dark:text-pink-400 py-4">
                      Nenhuma viagem nos próximos 7 dias
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clientes */}
          <TabsContent value="clientes" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-pink-900 dark:text-pink-100">
                Gerenciar Clientes
              </h2>
              <div className="flex space-x-2">
                {/* Botão de Exclusão de Cliente */}
                <Button 
                  onClick={() => {
                    setModoSelecao(!modoSelecao)
                    setVendasSelecionadas([])
                  }}
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {modoSelecao ? 'Cancelar Seleção' : 'Excluir Cliente'}
                </Button>
                <Button 
                  onClick={() => openDialog('cliente')}
                  className="bg-pink-600 hover:bg-pink-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Cliente
                </Button>
              </div>
            </div>

            {/* Modo de seleção ativo */}
            {modoSelecao && (
              <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <p className="text-red-700 dark:text-red-300 font-medium">
                        Modo de Exclusão de Vendas Ativo
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {vendasSelecionadas.length} venda(s) selecionada(s)
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        onClick={selecionarTodasVendas}
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-700 hover:bg-red-50"
                      >
                        {vendasSelecionadas.length === vendasAereoFiltradas.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                      </Button>
                      <Button
                        onClick={excluirVendasSelecionadas}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                        disabled={vendasSelecionadas.length === 0}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir Selecionadas ({vendasSelecionadas.length})
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clientes
                .filter(cliente => 
                  cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (cliente.email && cliente.email.toLowerCase().includes(searchTerm.toLowerCase()))
                )
                .map((cliente) => (
                <Card key={cliente.id} className="bg-white dark:bg-pink-900 border-pink-100 dark:border-pink-800">
                  <CardHeader>
                    <CardTitle className="text-pink-900 dark:text-pink-100">
                      {cliente.nome}
                    </CardTitle>
                    <CardDescription className="text-pink-600 dark:text-pink-400">
                      Cliente desde {formatDateForDisplay(cliente.dataCadastro)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {cliente.email && (
                      <div className="flex items-center space-x-2 text-sm text-pink-700 dark:text-pink-300">
                        <Mail className="h-4 w-4" />
                        <span>{cliente.email}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2 text-sm text-pink-700 dark:text-pink-300">
                      <Phone className="h-4 w-4" />
                      <span>{cliente.telefone}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-pink-700 dark:text-pink-300">
                      <User className="h-4 w-4" />
                      <span>{cliente.cpf}</span>
                    </div>
                    {cliente.endereco && (
                      <div className="flex items-center space-x-2 text-sm text-pink-700 dark:text-pink-300">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{cliente.endereco}</span>
                      </div>
                    )}
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDialog('cliente', cliente)}
                        className="border-pink-200 text-pink-700 hover:bg-pink-50"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => excluirCliente(cliente.id)}
                        className="border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {clientes.length === 0 && (
                <div className="col-span-full text-center py-8 text-pink-600 dark:text-pink-400">
                  Nenhum cliente cadastrado. Clique em "Novo Cliente" para começar.
                </div>
              )}
            </div>
          </TabsContent>

          {/* Vendas */}
          <TabsContent value="aereo" className="space-y-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-pink-900 dark:text-pink-100 flex items-center">
                  <DollarSign className="h-6 w-6 mr-2" />
                  Vendas
                </h2>
                <Button 
                  onClick={() => openDialog('aereo')}
                  className="bg-pink-600 hover:bg-pink-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Venda
                </Button>
              </div>

              {/* Filtros de Data - CORRIGIDOS */}
              <div className="grid grid-cols-1 gap-6 p-4 bg-white dark:bg-pink-900 rounded-lg border border-pink-200 dark:border-pink-800">
                {/* Filtro Data da Viagem */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-pink-600" />
                    <Label className="text-sm font-medium text-pink-700 dark:text-pink-300">
                      Filtrar por Data da Viagem (ida ou volta):
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1">
                      <Label htmlFor="dataViagemInicio" className="text-xs text-pink-600 dark:text-pink-400">
                        De:
                      </Label>
                      <Input
                        id="dataViagemInicio"
                        type="date"
                        value={filtroDataViagemInicio}
                        onChange={(e) => setFiltroDataViagemInicio(e.target.value)}
                        className="border-pink-200 focus:ring-pink-500"
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="dataViagemFim" className="text-xs text-pink-600 dark:text-pink-400">
                        Até:
                      </Label>
                      <Input
                        id="dataViagemFim"
                        type="date"
                        value={filtroDataViagemFim}
                        onChange={(e) => setFiltroDataViagemFim(e.target.value)}
                        className="border-pink-200 focus:ring-pink-500"
                      />
                    </div>
                    {(filtroDataViagemInicio || filtroDataViagemFim) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setFiltroDataViagemInicio('')
                          setFiltroDataViagemFim('')
                        }}
                        className="border-pink-200 text-pink-700 hover:bg-pink-50 mt-5"
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Tabs value={activeAereoTab} onValueChange={setActiveAereoTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 bg-white dark:bg-pink-900 border border-pink-200 dark:border-pink-800">
                <TabsTrigger value="vendas" className="data-[state=active]:bg-pink-600 data-[state=active]:text-white">
                  Vendas
                </TabsTrigger>
                <TabsTrigger value="financeiro" className="data-[state=active]:bg-pink-600 data-[state=active]:text-white">
                  Financeiro
                </TabsTrigger>
              </TabsList>

              {/* Aba Vendas */}
              <TabsContent value="vendas">
                <Card className="bg-white dark:bg-pink-900 border-pink-100 dark:border-pink-800">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-pink-50 dark:bg-pink-800">
                          <tr>
                            {modoSelecao && (
                              <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                                <input
                                  type="checkbox"
                                  checked={vendasSelecionadas.length === vendasAereoFiltradas.length && vendasAereoFiltradas.length > 0}
                                  onChange={selecionarTodasVendas}
                                  className="rounded border-pink-300 text-pink-600 focus:ring-pink-500"
                                />
                              </th>
                            )}
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Cliente
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Tipo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Localizador
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Rota
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Pax
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Datas Viagem
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Data Venda
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Valor
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Pagamento
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-pink-100 dark:divide-pink-800">
                          {vendasAereoFiltradas.map((venda) => (
                            <tr key={venda.id} className={`hover:bg-pink-50 dark:hover:bg-pink-800 ${vendasSelecionadas.includes(venda.id) ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                              {modoSelecao && (
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <input
                                    type="checkbox"
                                    checked={vendasSelecionadas.includes(venda.id)}
                                    onChange={() => toggleSelecaoVenda(venda.id)}
                                    className="rounded border-pink-300 text-pink-600 focus:ring-pink-500"
                                  />
                                </td>
                              )}
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-pink-900 dark:text-pink-100">
                                {venda.cliente}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-pink-700 dark:text-pink-300">
                                <Badge variant="outline" className="border-pink-200 text-pink-700">
                                  {getTipoVendaLabel(venda.tipoVenda)}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-pink-700 dark:text-pink-300">
                                {venda.localizador || 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-pink-700 dark:text-pink-300">
                                {venda.origem && venda.destino ? (
                                  <div className="flex items-center">
                                    <span className="truncate max-w-20">{venda.origem}</span>
                                    <Plane className="h-3 w-3 mx-1 text-pink-500" />
                                    <span className="truncate max-w-20">{venda.destino}</span>
                                  </div>
                                ) : 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-pink-700 dark:text-pink-300">
                                {venda.quantidadePessoas}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-pink-700 dark:text-pink-300">
                                {venda.dataIda ? (
                                  <div>
                                    <div className="font-medium">Ida: {formatDateForDisplay(venda.dataIda)}</div>
                                    {venda.dataVolta && (
                                      <div className="text-xs">Volta: {formatDateForDisplay(venda.dataVolta)}</div>
                                    )}
                                  </div>
                                ) : 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-pink-700 dark:text-pink-300">
                                {formatDateForDisplay(venda.dataVenda)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-pink-900 dark:text-pink-100">
                                {formatCurrency(venda.valor)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-pink-700 dark:text-pink-300">
                                <div className="flex items-center">
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  <span className="text-xs">{getFormaPagamentoLabel(venda.formaPagamento)}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge 
                                  variant={venda.status === 'confirmada' ? 'default' : venda.status === 'pendente' ? 'secondary' : 'destructive'}
                                  className={venda.status === 'confirmada' ? 'bg-pink-600 hover:bg-pink-700' : ''}
                                >
                                  {venda.status}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex space-x-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openDialog('aereo', venda)}
                                    className="border-pink-200 text-pink-700 hover:bg-pink-50"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  {!modoSelecao && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => excluirVenda(venda.id)}
                                      className="border-red-200 text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {vendasAereoFiltradas.length === 0 && (
                      <div className="text-center py-8 text-pink-600 dark:text-pink-400">
                        {(filtroDataViagemInicio || filtroDataViagemFim) ? 'Nenhuma venda encontrada para os filtros aplicados.' : 'Nenhuma venda registrada. Clique em "Nova Venda" para começar.'}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Aba Financeiro */}
              <TabsContent value="financeiro">
                <Card className="bg-white dark:bg-pink-900 border-pink-100 dark:border-pink-800">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-pink-50 dark:bg-pink-800">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Cliente
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Tipo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Localizador
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Fornecedor
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Valor Venda
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Custo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Lucro
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-pink-900 dark:text-pink-100 uppercase tracking-wider">
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-pink-100 dark:divide-pink-800">
                          {vendasAereoFiltradas.map((venda) => {
                            const lucro = venda.valor - (venda.custo || 0)
                            return (
                              <tr key={venda.id} className="hover:bg-pink-50 dark:hover:bg-pink-800">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-pink-900 dark:text-pink-100">
                                  {venda.cliente}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-pink-700 dark:text-pink-300">
                                  <Badge variant="outline" className="border-pink-200 text-pink-700">
                                    {getTipoVendaLabel(venda.tipoVenda)}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-pink-700 dark:text-pink-300">
                                  {venda.localizador || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-pink-700 dark:text-pink-300">
                                  <div className="flex items-center">
                                    <Building2 className="h-3 w-3 mr-1" />
                                    {venda.fornecedor || 'Não informado'}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-pink-900 dark:text-pink-100">
                                  {formatCurrency(venda.valor)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-pink-700 dark:text-pink-300">
                                  {formatCurrency(venda.custo || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <span className={lucro >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {formatCurrency(lucro)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openDialog('financeiro', venda)}
                                    className="border-pink-200 text-pink-700 hover:bg-pink-50"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {vendasAereoFiltradas.length === 0 && (
                      <div className="text-center py-8 text-pink-600 dark:text-pink-400">
                        Nenhuma venda registrada para análise financeira.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Dialog para aprovação de usuários */}
        <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
          <DialogContent className="bg-white dark:bg-orange-900 border-orange-200 dark:border-orange-800">
            <DialogHeader>
              <DialogTitle className="text-orange-900 dark:text-orange-100">
                ✅ Aprovar Usuário
              </DialogTitle>
              <DialogDescription className="text-orange-600 dark:text-orange-400">
                Confirme a aprovação do usuário para acesso ao sistema.
              </DialogDescription>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="space-y-4">
                <div className="p-4 bg-orange-50 dark:bg-orange-800/20 rounded-lg">
                  <h3 className="font-medium text-orange-900 dark:text-orange-100 mb-2">
                    Dados do Usuário:
                  </h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    <strong>Nome:</strong> {selectedRequest.nome}
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    <strong>Email:</strong> {selectedRequest.email}
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    <strong>Solicitado em:</strong> {formatDateTime(selectedRequest.requested_at)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="approvalNotes" className="text-orange-900 dark:text-orange-100">
                    Observações (opcional)
                  </Label>
                  <Textarea
                    id="approvalNotes"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="border-orange-200 focus:ring-orange-500"
                    placeholder="Adicione observações sobre a aprovação..."
                  />
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsApprovalDialogOpen(false)
                      setSelectedRequest(null)
                      setApprovalNotes('')
                    }}
                    className="border-orange-200 text-orange-700 hover:bg-orange-50"
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => handleApproveUser(selectedRequest.id, approvalNotes)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={loading}
                  >
                    {loading ? 'Aprovando...' : 'Aprovar Usuário'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog para formulários */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl bg-white dark:bg-pink-900 border-pink-200 dark:border-pink-800 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-pink-900 dark:text-pink-100">
                {editingItem ? 'Editar' : 'Nova'} {
                  dialogType === 'cliente' ? 'Cliente' : 
                  dialogType === 'aereo' ? 'Venda' : 'Dados Financeiros'
                }
              </DialogTitle>
              <DialogDescription className="text-pink-600 dark:text-pink-400">
                Preencha os dados abaixo para {editingItem ? 'atualizar' : 'cadastrar'} {
                  dialogType === 'cliente' ? 'o cliente' : 
                  dialogType === 'aereo' ? 'a venda' : 'os dados financeiros'
                }.
              </DialogDescription>
            </DialogHeader>
            
            <form action={handleSave} className="space-y-4">
              {dialogType === 'cliente' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="nome" className="text-pink-900 dark:text-pink-100">Nome Completo *</Label>
                    <Input
                      id="nome"
                      name="nome"
                      defaultValue={editingItem?.nome || ''}
                      required
                      className="border-pink-200 focus:ring-pink-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf" className="text-pink-900 dark:text-pink-100">CPF *</Label>
                    <Input
                      id="cpf"
                      name="cpf"
                      defaultValue={editingItem?.cpf || ''}
                      required
                      className="border-pink-200 focus:ring-pink-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone" className="text-pink-900 dark:text-pink-100">Telefone *</Label>
                    <Input
                      id="telefone"
                      name="telefone"
                      defaultValue={editingItem?.telefone || ''}
                      required
                      className="border-pink-200 focus:ring-pink-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-pink-900 dark:text-pink-100">E-mail (opcional)</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={editingItem?.email || ''}
                      className="border-pink-200 focus:ring-pink-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endereco" className="text-pink-900 dark:text-pink-100">Endereço (opcional)</Label>
                    <Textarea
                      id="endereco"
                      name="endereco"
                      defaultValue={editingItem?.endereco || ''}
                      className="border-pink-200 focus:ring-pink-500"
                    />
                  </div>
                </>
              )}

              {dialogType === 'aereo' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cliente" className="text-pink-900 dark:text-pink-100">Nome do Cliente *</Label>
                      <Input
                        id="cliente"
                        name="cliente"
                        defaultValue={editingItem?.cliente || ''}
                        required
                        className="border-pink-200 focus:ring-pink-500"
                        placeholder="Nome do cliente"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tipoVenda" className="text-pink-900 dark:text-pink-100">Tipo de Venda *</Label>
                      <Select name="tipoVenda" defaultValue={editingItem?.tipoVenda || 'aereo'}>
                        <SelectTrigger className="border-pink-200 focus:ring-pink-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aereo">Aéreo</SelectItem>
                          <SelectItem value="pacotes">Pacotes</SelectItem>
                          <SelectItem value="hotel">Hotel</SelectItem>
                          <SelectItem value="aluguel_carro">Aluguel de Carro</SelectItem>
                          <SelectItem value="assessoria_visto">Assessoria de Visto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantidadePessoas" className="text-pink-900 dark:text-pink-100">Quantidade de Pessoas *</Label>
                      <Input
                        id="quantidadePessoas"
                        name="quantidadePessoas"
                        type="number"
                        min="1"
                        defaultValue={editingItem?.quantidadePessoas || '1'}
                        required
                        className="border-pink-200 focus:ring-pink-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="valor" className="text-pink-900 dark:text-pink-100">Valor da Venda (R$) *</Label>
                      <Input
                        id="valor"
                        name="valor"
                        type="number"
                        step="0.01"
                        defaultValue={editingItem?.valor || ''}
                        required
                        className="border-pink-200 focus:ring-pink-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="formaPagamento" className="text-pink-900 dark:text-pink-100">Forma de Pagamento *</Label>
                      <Select name="formaPagamento" defaultValue={editingItem?.formaPagamento || 'cartao_credito'}>
                        <SelectTrigger className="border-pink-200 focus:ring-pink-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                          <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="transferencia">Transferência</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* 🔧 CAMPO OBRIGATÓRIO: Data da Venda */}
                  <div className="space-y-2">
                    <Label htmlFor="dataVenda" className="text-pink-900 dark:text-pink-100">Data da Venda *</Label>
                    <Input
                      id="dataVenda"
                      name="dataVenda"
                      type="date"
                      defaultValue={formatDateForInput(editingItem?.dataVenda || new Date().toISOString().split('T')[0])}
                      required
                      className="border-pink-200 focus:ring-pink-500"
                    />
                  </div>

                  {/* Campos opcionais */}
                  <div className="space-y-4 p-4 bg-pink-50 dark:bg-pink-800 rounded-lg">
                    <h3 className="text-sm font-medium text-pink-900 dark:text-pink-100">Informações Adicionais (Opcional)</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="localizador" className="text-pink-900 dark:text-pink-100">Localizador</Label>
                        <Input
                          id="localizador"
                          name="localizador"
                          defaultValue={editingItem?.localizador || ''}
                          className="border-pink-200 focus:ring-pink-500 font-mono"
                          placeholder="ABC123"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companhiaAerea" className="text-pink-900 dark:text-pink-100">Companhia/Fornecedor</Label>
                        <Input
                          id="companhiaAerea"
                          name="companhiaAerea"
                          defaultValue={editingItem?.companhiaAerea || ''}
                          className="border-pink-200 focus:ring-pink-500"
                          placeholder="LATAM Airlines, GOL, Azul, etc."
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="origem" className="text-pink-900 dark:text-pink-100">Origem</Label>
                        <Input
                          id="origem"
                          name="origem"
                          defaultValue={editingItem?.origem || ''}
                          className="border-pink-200 focus:ring-pink-500"
                          placeholder="São Paulo (GRU)"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="destino" className="text-pink-900 dark:text-pink-100">Destino</Label>
                        <Input
                          id="destino"
                          name="destino"
                          defaultValue={editingItem?.destino || ''}
                          className="border-pink-200 focus:ring-pink-500"
                          placeholder="Rio de Janeiro (GIG)"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dataIda" className="text-pink-900 dark:text-pink-100">Data de Ida</Label>
                        <Input
                          id="dataIda"
                          name="dataIda"
                          type="date"
                          defaultValue={formatDateForInput(editingItem?.dataIda || '')}
                          className="border-pink-200 focus:ring-pink-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dataVolta" className="text-pink-900 dark:text-pink-100">Data de Volta</Label>
                        <Input
                          id="dataVolta"
                          name="dataVolta"
                          type="date"
                          defaultValue={formatDateForInput(editingItem?.dataVolta || '')}
                          className="border-pink-200 focus:ring-pink-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status" className="text-pink-900 dark:text-pink-100">Status</Label>
                        <Select name="status" defaultValue={editingItem?.status || 'pendente'}>
                          <SelectTrigger className="border-pink-200 focus:ring-pink-500">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="confirmada">Confirmada</SelectItem>
                            <SelectItem value="cancelada">Cancelada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="observacoes" className="text-pink-900 dark:text-pink-100">Observações</Label>
                      <Textarea
                        id="observacoes"
                        name="observacoes"
                        defaultValue={editingItem?.observacoes || ''}
                        className="border-pink-200 focus:ring-pink-500"
                        placeholder="Informações adicionais sobre a venda..."
                      />
                    </div>
                  </div>
                </>
              )}

              {dialogType === 'financeiro' && (
                <>
                  <div className="space-y-4">
                    <div className="p-4 bg-pink-50 dark:bg-pink-800 rounded-lg">
                      <h3 className="font-medium text-pink-900 dark:text-pink-100 mb-2">
                        Venda: {editingItem?.cliente} - {getTipoVendaLabel(editingItem?.tipoVenda)}
                      </h3>
                      <p className="text-sm text-pink-600 dark:text-pink-400">
                        Valor da Venda: {formatCurrency(editingItem?.valor || 0)}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="custo" className="text-pink-900 dark:text-pink-100">Valor do Custo (R$)</Label>
                      <Input
                        id="custo"
                        name="custo"
                        type="number"
                        step="0.01"
                        defaultValue={editingItem?.custo || ''}
                        required
                        className="border-pink-200 focus:ring-pink-500"
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="fornecedor" className="text-pink-900 dark:text-pink-100">Fornecedor</Label>
                      <Input
                        id="fornecedor"
                        name="fornecedor"
                        defaultValue={editingItem?.fornecedor || ''}
                        required
                        className="border-pink-200 focus:ring-pink-500"
                        placeholder="Nome da companhia aérea ou fornecedor"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="border-pink-200 text-pink-700 hover:bg-pink-50"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  className="bg-pink-600 hover:bg-pink-700 text-white"
                  disabled={loading}
                >
                  {loading ? 'Salvando...' : (editingItem ? 'Atualizar' : 'Salvar')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog Calculadora de Taxas */}
        <Dialog open={isCalculadoraOpen} onOpenChange={setIsCalculadoraOpen}>
          <DialogContent className="max-w-4xl bg-white dark:bg-pink-900 border-pink-200 dark:border-pink-800 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-pink-900 dark:text-pink-100 flex items-center">
                <Calculator className="h-5 w-5 mr-2" />
                Calculadora de Taxas - Parcelamento no Cartão
              </DialogTitle>
              <DialogDescription className="text-pink-600 dark:text-pink-400">
                Calcule as opções de parcelamento com as taxas aplicadas e copie para enviar ao cliente.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="valorBase" className="text-pink-900 dark:text-pink-100">Valor Base (R$)</Label>
                <Input
                  id="valorBase"
                  type="number"
                  step="0.01"
                  value={valorBase}
                  onChange={(e) => setValorBase(e.target.value)}
                  className="border-pink-200 focus:ring-pink-500"
                  placeholder="1000.00"
                />
              </div>

              <div className="flex space-x-4">
                <Button
                  onClick={() => {
                    if (valorBase) {
                      const valor = parseFloat(valorBase)
                      const taxas = calcularTaxas(valor)
                      setTaxasCalculadas(taxas)
                    }
                  }}
                  className="bg-pink-600 hover:bg-pink-700 text-white"
                  disabled={!valorBase}
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Calcular Taxas
                </Button>

                {taxasCalculadas.length > 0 && (
                  <Button
                    onClick={copiarTaxas}
                    variant="outline"
                    className="border-pink-200 text-pink-700 hover:bg-pink-50"
                  >
                    {copiado ? (
                      <Check className="h-4 w-4 mr-2 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    {copiado ? 'Copiado!' : 'Copiar Taxas para Cliente'}
                  </Button>
                )}
              </div>

              {taxasCalculadas.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-pink-900 dark:text-pink-100">
                    Opções de Parcelamento
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {taxasCalculadas.map(({ parcela, valor }) => {
                      const taxa = TAXAS_PARCELAMENTO[parcela as keyof typeof TAXAS_PARCELAMENTO]
                      const valorTotal = parseFloat(valorBase) * (1 + taxa / 100)
                      
                      return (
                        <Card key={parcela} className="bg-pink-50 dark:bg-pink-800 border-pink-200 dark:border-pink-700">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-pink-900 dark:text-pink-100">
                                💳 {parcela}x
                              </span>
                              <span className="text-xs text-pink-600 dark:text-pink-400">
                                Taxa: {taxa}%
                              </span>
                            </div>
                            <div className="space-y-1">
                              {parcela === 1 ? (
                                <p className="text-lg font-bold text-pink-900 dark:text-pink-100">
                                  {formatCurrency(valorTotal)}
                                </p>
                              ) : (
                                <>
                                  <p className="text-lg font-bold text-pink-900 dark:text-pink-100">
                                    {formatCurrency(valor)}
                                  </p>
                                  <p className="text-xs text-pink-600 dark:text-pink-400">
                                    Total: {formatCurrency(valorTotal)}
                                  </p>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>

                  <div className="mt-6 p-4 bg-pink-100 dark:bg-pink-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-pink-900 dark:text-pink-100">
                        Preview do texto para o cliente:
                      </h4>
                      <Button
                        onClick={copiarTaxas}
                        size="sm"
                        variant="outline"
                        className="border-pink-200 text-pink-700 hover:bg-pink-50"
                      >
                        {copiado ? (
                          <Check className="h-4 w-4 mr-2 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 mr-2" />
                        )}
                        {copiado ? 'Copiado!' : 'Copiar'}
                      </Button>
                    </div>
                    <pre className="text-sm text-pink-700 dark:text-pink-300 whitespace-pre-wrap font-mono">
                      {gerarTextoTaxas(parseFloat(valorBase), taxasCalculadas)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button 
                onClick={() => setIsCalculadoraOpen(false)}
                className="bg-pink-600 hover:bg-pink-700 text-white"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}