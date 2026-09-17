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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
