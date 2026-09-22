// Tipos manuais no formato gerado por `supabase gen types typescript`.
// Quando o CLI do Supabase estiver disponível, rode:
//   npx supabase gen types typescript --project-id <id> > lib/types/database.types.ts
// para substituir este arquivo por um gerado automaticamente a partir do
// schema real — a forma (Database.public.Tables.<tabela>.Row/Insert/Update)
// é a mesma, então nenhum outro arquivo precisa mudar.
//
// `Relationships` (mesmo vazio) é exigido pelo tipo `GenericTable` do
// @supabase/postgrest-js para a inferência de `.insert()`/`.update()` funcionar.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      pedidos: {
        Row: {
          id: string
          numero: number
          data_venda: string
          data_evento: string | null
          hora_evento: string | null
          cliente: string
          valor_total: number
          valor_pago: number
          falta_pagar: number
          entidade: string
          emissao_nota: boolean
          forma_pagamento: string | null
          banco: string | null
          data_pagamento: string | null
          status: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          numero?: number
          data_venda: string
          data_evento?: string | null
          hora_evento?: string | null
          cliente: string
          valor_total: number
          valor_pago?: number
          entidade: string
          emissao_nota?: boolean
          forma_pagamento?: string | null
          banco?: string | null
          data_pagamento?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['pedidos']['Insert']>
        Relationships: []
      }
      historico_alteracoes: {
        Row: {
          id: string
          tabela: string
          registro_id: string | null
          operacao: string
          dados_antigos: Json | null
          dados_novos: Json | null
          usuario_id: string | null
          usuario_email: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          tabela: string
          registro_id?: string | null
          operacao: string
          dados_antigos?: Json | null
          dados_novos?: Json | null
          usuario_id?: string | null
          usuario_email?: string | null
          criado_em?: string
        }
        Update: Partial<Database['public']['Tables']['historico_alteracoes']['Insert']>
        Relationships: []
      }
      produtos: {
        Row: {
          id: string
          nome: string
          tipo: string
          categoria: string | null
          peso_kg_padrao: number | null
          valor_unit_padrao: number
          ativo: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          tipo?: string
          categoria?: string | null
          peso_kg_padrao?: number | null
          valor_unit_padrao: number
          ativo?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['produtos']['Insert']>
        Relationships: []
      }
      orcamentos: {
        Row: {
          id: string
          numero: number
          data_orcamento: string
          cliente: string
          entidade: string
          data_evento: string | null
          hora_evento: string | null
          descricao: string | null
          valor_total: number
          validade: string | null
          status: string
          pedido_id: string | null
          numero_pessoas: number | null
          percentual_extras: number
          itens: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          numero?: number
          data_orcamento?: string
          cliente: string
          entidade: string
          data_evento?: string | null
          hora_evento?: string | null
          descricao?: string | null
          valor_total: number
          validade?: string | null
          status?: string
          pedido_id?: string | null
          numero_pessoas?: number | null
          percentual_extras?: number
          itens?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['orcamentos']['Insert']>
        Relationships: []
      }
      despesas: {
        Row: {
          id: string
          data: string
          categoria: string
          descricao: string
          valor: number
          forma_pagamento: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          data: string
          categoria: string
          descricao: string
          valor: number
          forma_pagamento?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['despesas']['Insert']>
        Relationships: []
      }
      estoque_itens: {
        Row: {
          id: string
          nome: string
          categoria: string
          unidade_medida: string
          quantidade_atual: number
          quantidade_minima: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          categoria: string
          unidade_medida: string
          quantidade_atual?: number
          quantidade_minima?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['estoque_itens']['Insert']>
        Relationships: []
      }
      estoque_movimentos: {
        Row: {
          id: string
          item_id: string
          tipo: string
          quantidade: number
          data: string
          motivo: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          tipo: string
          quantidade: number
          data?: string
          motivo?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['estoque_movimentos']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'estoque_movimentos_item_id_fkey'
            columns: ['item_id']
            referencedRelation: 'estoque_itens'
            referencedColumns: ['id']
          },
        ]
      }
      notas_fiscais: {
        Row: {
          id: string
          pedido_id: string
          numero_nota: string | null
          valor: number
          valor_pago: number
          falta_pagar: number
          data_emissao: string | null
          previsao_pagamento: string | null
          pago: boolean
          cancelada: boolean
          forma_pagamento: string | null
          banco: string | null
          data_pagamento: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pedido_id: string
          numero_nota?: string | null
          valor: number
          valor_pago?: number
          data_emissao?: string | null
          pago?: boolean
          cancelada?: boolean
          forma_pagamento?: string | null
          banco?: string | null
          data_pagamento?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['notas_fiscais']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'notas_fiscais_pedido_id_fkey'
            columns: ['pedido_id']
            referencedRelation: 'pedidos'
            referencedColumns: ['id']
          },
        ]
      }
      usuarios: {
        Row: {
          id: string
          email: string
          aprovado: boolean
          tipo: string
          paginas: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          aprovado?: boolean
          tipo?: string
          paginas?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['usuarios']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
