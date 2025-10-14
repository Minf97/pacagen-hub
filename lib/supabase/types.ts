/**
 * Database TypeScript Types
 * Generated from Supabase schema
 *
 * To regenerate these types, run:
 * npx supabase gen types typescript --project-id your-project-id > lib/supabase/types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      experiments: {
        Row: {
          id: string
          name: string
          description: string | null
          hypothesis: string | null
          status: 'draft' | 'running' | 'paused' | 'completed' | 'archived'
          traffic_allocation: Json
          targeting_rules: Json
          created_at: string
          updated_at: string
          started_at: string | null
          ended_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          hypothesis?: string | null
          status?: 'draft' | 'running' | 'paused' | 'completed' | 'archived'
          traffic_allocation?: Json
          targeting_rules?: Json
          created_at?: string
          updated_at?: string
          started_at?: string | null
          ended_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          hypothesis?: string | null
          status?: 'draft' | 'running' | 'paused' | 'completed' | 'archived'
          traffic_allocation?: Json
          targeting_rules?: Json
          created_at?: string
          updated_at?: string
          started_at?: string | null
          ended_at?: string | null
          created_by?: string | null
        }
      }
      variants: {
        Row: {
          id: string
          experiment_id: string
          name: string
          display_name: string
          is_control: boolean
          weight: number
          config: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          experiment_id: string
          name: string
          display_name: string
          is_control?: boolean
          weight?: number
          config?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          experiment_id?: string
          name?: string
          display_name?: string
          is_control?: boolean
          weight?: number
          config?: Json
          created_at?: string
          updated_at?: string
        }
      }
      user_assignments: {
        Row: {
          user_id: string
          experiment_id: string
          variant_id: string
          assigned_at: string
          assignment_method: string
          user_agent: string | null
          country: string | null
          device_type: string | null
        }
        Insert: {
          user_id: string
          experiment_id: string
          variant_id: string
          assigned_at?: string
          assignment_method?: string
          user_agent?: string | null
          country?: string | null
          device_type?: string | null
        }
        Update: {
          user_id?: string
          experiment_id?: string
          variant_id?: string
          assigned_at?: string
          assignment_method?: string
          user_agent?: string | null
          country?: string | null
          device_type?: string | null
        }
      }
      events: {
        Row: {
          id: string
          event_type: string
          user_id: string
          experiment_id: string | null
          variant_id: string | null
          event_data: Json
          url: string | null
          referrer: string | null
          user_agent: string | null
          ip_address: string | null
          country: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          user_id: string
          experiment_id?: string | null
          variant_id?: string | null
          event_data?: Json
          url?: string | null
          referrer?: string | null
          user_agent?: string | null
          ip_address?: string | null
          country?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          user_id?: string
          experiment_id?: string | null
          variant_id?: string | null
          event_data?: Json
          url?: string | null
          referrer?: string | null
          user_agent?: string | null
          ip_address?: string | null
          country?: string | null
          created_at?: string
        }
      }
      experiment_stats: {
        Row: {
          experiment_id: string
          variant_id: string
          date: string
          impressions: number
          unique_users: number
          clicks: number
          conversions: number
          revenue: number
          avg_order_value: number
          bounce_rate: number | null
          avg_session_duration: number | null
          conversion_rate: number | null
          confidence_level: number | null
          p_value: number | null
          updated_at: string
        }
        Insert: {
          experiment_id: string
          variant_id: string
          date: string
          impressions?: number
          unique_users?: number
          clicks?: number
          conversions?: number
          revenue?: number
          avg_order_value?: number
          bounce_rate?: number | null
          avg_session_duration?: number | null
          conversion_rate?: number | null
          confidence_level?: number | null
          p_value?: number | null
          updated_at?: string
        }
        Update: {
          experiment_id?: string
          variant_id?: string
          date?: string
          impressions?: number
          unique_users?: number
          clicks?: number
          conversions?: number
          revenue?: number
          avg_order_value?: number
          bounce_rate?: number | null
          avg_session_duration?: number | null
          conversion_rate?: number | null
          confidence_level?: number | null
          p_value?: number | null
          updated_at?: string
        }
      }
    }
    Views: {
      experiment_summary: {
        Row: {
          id: string
          name: string
          status: string
          started_at: string | null
          ended_at: string | null
          total_users: number
          variant_count: number
          total_impressions: number
          total_conversions: number
          total_revenue: number
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Utility types for convenience
export type Experiment = Database['public']['Tables']['experiments']['Row']
export type ExperimentInsert = Database['public']['Tables']['experiments']['Insert']
export type ExperimentUpdate = Database['public']['Tables']['experiments']['Update']

export type Variant = Database['public']['Tables']['variants']['Row']
export type VariantInsert = Database['public']['Tables']['variants']['Insert']
export type VariantUpdate = Database['public']['Tables']['variants']['Update']

export type UserAssignment = Database['public']['Tables']['user_assignments']['Row']
export type Event = Database['public']['Tables']['events']['Row']
export type ExperimentStats = Database['public']['Tables']['experiment_stats']['Row']

export type ExperimentSummary = Database['public']['Views']['experiment_summary']['Row']
