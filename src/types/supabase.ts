export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_membership_id: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_membership_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_membership_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_membership_id_fkey"
            columns: ["actor_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_customers: {
        Row: {
          contract_id: string | null
          created_at: string
          email: string | null
          external_reference: string
          id: string
          lead_id: string | null
          metadata: Json
          name: string
          provider: string
          provider_customer_id: string
          provider_status: string | null
          status: string
          tax_id_last4: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          email?: string | null
          external_reference: string
          id?: string
          lead_id?: string | null
          metadata?: Json
          name: string
          provider?: string
          provider_customer_id: string
          provider_status?: string | null
          status?: string
          tax_id_last4?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          email?: string | null
          external_reference?: string
          id?: string
          lead_id?: string | null
          metadata?: Json
          name?: string
          provider?: string
          provider_customer_id?: string
          provider_status?: string | null
          status?: string
          tax_id_last4?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "commercial_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_customers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "marketing_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount_cents: number
          bank_slip_url: string | null
          confirmed_at: string | null
          contract_id: string | null
          created_at: string
          due_date: string | null
          external_reference: string | null
          id: string
          invoice_url: string | null
          metadata: Json
          net_amount_cents: number | null
          paid_period_ends_on: string | null
          paid_period_starts_on: string | null
          pix_qr_code_url: string | null
          provider: string
          provider_payment_id: string
          provider_status: string | null
          received_at: string | null
          status: string
          subscription_id: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          bank_slip_url?: string | null
          confirmed_at?: string | null
          contract_id?: string | null
          created_at?: string
          due_date?: string | null
          external_reference?: string | null
          id?: string
          invoice_url?: string | null
          metadata?: Json
          net_amount_cents?: number | null
          paid_period_ends_on?: string | null
          paid_period_starts_on?: string | null
          pix_qr_code_url?: string | null
          provider?: string
          provider_payment_id: string
          provider_status?: string | null
          received_at?: string | null
          status?: string
          subscription_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          bank_slip_url?: string | null
          confirmed_at?: string | null
          contract_id?: string | null
          created_at?: string
          due_date?: string | null
          external_reference?: string | null
          id?: string
          invoice_url?: string | null
          metadata?: Json
          net_amount_cents?: number | null
          paid_period_ends_on?: string | null
          paid_period_starts_on?: string | null
          pix_qr_code_url?: string | null
          provider?: string
          provider_payment_id?: string
          provider_status?: string | null
          received_at?: string | null
          status?: string
          subscription_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "commercial_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plan_prices: {
        Row: {
          active: boolean
          amount_cents: number
          billing_type: string
          created_at: string
          currency: string
          cycle: string
          id: string
          plan_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          billing_type?: string
          created_at?: string
          currency?: string
          cycle: string
          id?: string
          plan_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          billing_type?: string
          created_at?: string
          currency?: string
          cycle?: string
          id?: string
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_plan_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plan_solutions: {
        Row: {
          created_at: string
          limits: Json
          plan_id: string
          solution_id: string
        }
        Insert: {
          created_at?: string
          limits?: Json
          plan_id: string
          solution_id: string
        }
        Update: {
          created_at?: string
          limits?: Json
          plan_id?: string
          solution_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_plan_solutions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_plan_solutions_solution_id_fkey"
            columns: ["solution_id"]
            isOneToOne: false
            referencedRelation: "solutions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          active: boolean
          archived_at: string | null
          code: string
          created_at: string
          created_by_user_id: string | null
          currency: string
          description: string | null
          grace_days: number
          id: string
          limits: Json
          name: string
          trial_days: number
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          code: string
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          description?: string | null
          grace_days?: number
          id?: string
          limits?: Json
          name: string
          trial_days?: number
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          code?: string
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          description?: string | null
          grace_days?: number
          id?: string
          limits?: Json
          name?: string
          trial_days?: number
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      billing_reconciliation_runs: {
        Row: {
          checked_count: number
          completed_at: string | null
          corrected_count: number
          divergence_count: number
          error_count: number
          id: string
          provider: string
          started_at: string
          status: string
          summary: Json
          triggered_by_user_id: string | null
        }
        Insert: {
          checked_count?: number
          completed_at?: string | null
          corrected_count?: number
          divergence_count?: number
          error_count?: number
          id?: string
          provider?: string
          started_at?: string
          status?: string
          summary?: Json
          triggered_by_user_id?: string | null
        }
        Update: {
          checked_count?: number
          completed_at?: string | null
          corrected_count?: number
          divergence_count?: number
          error_count?: number
          id?: string
          provider?: string
          started_at?: string
          status?: string
          summary?: Json
          triggered_by_user_id?: string | null
        }
        Relationships: []
      }
      billing_status_history: {
        Row: {
          actor_user_id: string | null
          contract_id: string | null
          created_at: string
          from_status: string | null
          id: string
          metadata: Json
          payment_id: string | null
          reason: string
          tenant_id: string | null
          to_status: string
          webhook_event_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          contract_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          payment_id?: string | null
          reason: string
          tenant_id?: string | null
          to_status: string
          webhook_event_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          contract_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          payment_id?: string | null
          reason?: string
          tenant_id?: string | null
          to_status?: string
          webhook_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_status_history_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "commercial_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_status_history_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "billing_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_status_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_status_history_webhook_event_id_fkey"
            columns: ["webhook_event_id"]
            isOneToOne: false
            referencedRelation: "billing_webhook_events"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_subscriptions: {
        Row: {
          amount_cents: number
          billing_type: string
          cancelled_at: string | null
          contract_id: string
          created_at: string
          customer_id: string
          cycle: string
          external_reference: string
          id: string
          metadata: Json
          next_due_date: string | null
          provider: string
          provider_status: string | null
          provider_subscription_id: string
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          billing_type: string
          cancelled_at?: string | null
          contract_id: string
          created_at?: string
          customer_id: string
          cycle: string
          external_reference: string
          id?: string
          metadata?: Json
          next_due_date?: string | null
          provider?: string
          provider_status?: string | null
          provider_subscription_id: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          billing_type?: string
          cancelled_at?: string | null
          contract_id?: string
          created_at?: string
          customer_id?: string
          cycle?: string
          external_reference?: string
          id?: string
          metadata?: Json
          next_due_date?: string | null
          provider?: string
          provider_status?: string | null
          provider_subscription_id?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "commercial_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_webhook_events: {
        Row: {
          attempts: number
          correlation_id: string
          event_type: string
          id: string
          last_error: string | null
          occurred_at: string | null
          payload: Json
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          status: string
        }
        Insert: {
          attempts?: number
          correlation_id?: string
          event_type: string
          id?: string
          last_error?: string | null
          occurred_at?: string | null
          payload: Json
          processed_at?: string | null
          provider?: string
          provider_event_id: string
          received_at?: string
          status?: string
        }
        Update: {
          attempts?: number
          correlation_id?: string
          event_type?: string
          id?: string
          last_error?: string | null
          occurred_at?: string | null
          payload?: Json
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          status?: string
        }
        Relationships: []
      }
      commercial_activities: {
        Row: {
          activity_type: string
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          id: string
          lead_id: string | null
          metadata: Json
          owner_platform_member_id: string | null
          scheduled_at: string | null
          status: string
          subject: string
          team_id: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          activity_type: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          owner_platform_member_id?: string | null
          scheduled_at?: string | null
          status?: string
          subject: string
          team_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          activity_type?: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json
          owner_platform_member_id?: string | null
          scheduled_at?: string | null
          status?: string
          subject?: string
          team_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "marketing_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_activities_owner_platform_member_id_fkey"
            columns: ["owner_platform_member_id"]
            isOneToOne: false
            referencedRelation: "platform_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_activities_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "platform_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_contract_items: {
        Row: {
          contract_id: string
          created_at: string
          description: string | null
          id: string
          limits: Json
          quantity: number
          solution_id: string
          unit_amount_cents: number
        }
        Insert: {
          contract_id: string
          created_at?: string
          description?: string | null
          id?: string
          limits?: Json
          quantity?: number
          solution_id: string
          unit_amount_cents?: number
        }
        Update: {
          contract_id?: string
          created_at?: string
          description?: string | null
          id?: string
          limits?: Json
          quantity?: number
          solution_id?: string
          unit_amount_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_contract_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "commercial_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_contract_items_solution_id_fkey"
            columns: ["solution_id"]
            isOneToOne: false
            referencedRelation: "solutions"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_contracts: {
        Row: {
          amount_cents: number
          approved_at: string | null
          approved_by_user_id: string | null
          billing_type: string
          cancellation_at_period_end: boolean
          cancelled_at: string | null
          contract_number: number
          created_at: string
          created_by_user_id: string | null
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          customer_tax_id: string | null
          cycle: string
          ends_on: string | null
          external_reference: string
          grace_days: number
          id: string
          lead_id: string
          metadata: Json
          owner_email: string
          owner_name: string | null
          owner_platform_member_id: string | null
          plan_id: string | null
          proposal_id: string | null
          starts_on: string | null
          status: string
          team_id: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          approved_at?: string | null
          approved_by_user_id?: string | null
          billing_type?: string
          cancellation_at_period_end?: boolean
          cancelled_at?: string | null
          contract_number?: never
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          customer_tax_id?: string | null
          cycle: string
          ends_on?: string | null
          external_reference?: string
          grace_days?: number
          id?: string
          lead_id: string
          metadata?: Json
          owner_email: string
          owner_name?: string | null
          owner_platform_member_id?: string | null
          plan_id?: string | null
          proposal_id?: string | null
          starts_on?: string | null
          status?: string
          team_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          approved_at?: string | null
          approved_by_user_id?: string | null
          billing_type?: string
          cancellation_at_period_end?: boolean
          cancelled_at?: string | null
          contract_number?: never
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          customer_tax_id?: string | null
          cycle?: string
          ends_on?: string | null
          external_reference?: string
          grace_days?: number
          id?: string
          lead_id?: string
          metadata?: Json
          owner_email?: string
          owner_name?: string | null
          owner_platform_member_id?: string | null
          plan_id?: string | null
          proposal_id?: string | null
          starts_on?: string | null
          status?: string
          team_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_contracts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "marketing_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_contracts_owner_platform_member_id_fkey"
            columns: ["owner_platform_member_id"]
            isOneToOne: false
            referencedRelation: "platform_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_contracts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "commercial_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_contracts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "platform_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_demos: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          lead_id: string
          notes: string | null
          owner_platform_member_id: string | null
          starts_at: string | null
          status: string
          team_id: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          owner_platform_member_id?: string | null
          starts_at?: string | null
          status?: string
          team_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          owner_platform_member_id?: string | null
          starts_at?: string | null
          status?: string
          team_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_demos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "marketing_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_demos_owner_platform_member_id_fkey"
            columns: ["owner_platform_member_id"]
            isOneToOne: false
            referencedRelation: "platform_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_demos_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "platform_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_demos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_proposals: {
        Row: {
          amount_cents: number
          approval_notes: string | null
          approved_at: string | null
          approved_by_user_id: string | null
          billing_type: string | null
          created_at: string
          created_by_user_id: string | null
          currency: string
          cycle: string | null
          discount_cents: number
          id: string
          lead_id: string
          notes: string | null
          owner_platform_member_id: string | null
          plan_id: string | null
          proposal_number: number
          status: string
          team_id: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          amount_cents?: number
          approval_notes?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          billing_type?: string | null
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          cycle?: string | null
          discount_cents?: number
          id?: string
          lead_id: string
          notes?: string | null
          owner_platform_member_id?: string | null
          plan_id?: string | null
          proposal_number?: never
          status?: string
          team_id?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          amount_cents?: number
          approval_notes?: string | null
          approved_at?: string | null
          approved_by_user_id?: string | null
          billing_type?: string | null
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          cycle?: string | null
          discount_cents?: number
          id?: string
          lead_id?: string
          notes?: string | null
          owner_platform_member_id?: string | null
          plan_id?: string | null
          proposal_number?: never
          status?: string
          team_id?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "marketing_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_proposals_owner_platform_member_id_fkey"
            columns: ["owner_platform_member_id"]
            isOneToOne: false
            referencedRelation: "platform_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_proposals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commercial_proposals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "platform_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          parent_id: string | null
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      file_access: {
        Row: {
          can_read: boolean
          can_write: boolean
          created_at: string
          file_id: string
          membership_id: string
        }
        Insert: {
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          file_id: string
          membership_id: string
        }
        Update: {
          can_read?: boolean
          can_write?: boolean
          created_at?: string
          file_id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_access_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_access_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          bucket: string
          created_at: string
          id: string
          mime_type: string | null
          object_path: string
          original_name: string
          sensitivity: string
          size_bytes: number | null
          tenant_id: string
          uploaded_by_membership_id: string | null
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: string
          mime_type?: string | null
          object_path: string
          original_name: string
          sensitivity?: string
          size_bytes?: number | null
          tenant_id: string
          uploaded_by_membership_id?: string | null
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          object_path?: string
          original_name?: string
          sensitivity?: string
          size_bytes?: number | null
          tenant_id?: string
          uploaded_by_membership_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_uploaded_by_membership_id_fkey"
            columns: ["uploaded_by_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      integrity_attachments: {
        Row: {
          created_at: string
          file_id: string
          id: string
          report_id: string
          uploaded_by_type: string
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          report_id: string
          uploaded_by_type: string
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          report_id?: string
          uploaded_by_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrity_attachments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrity_attachments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "integrity_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      integrity_case_assignments: {
        Row: {
          assigned_by_membership_id: string | null
          created_at: string
          membership_id: string
          report_id: string
        }
        Insert: {
          assigned_by_membership_id?: string | null
          created_at?: string
          membership_id: string
          report_id: string
        }
        Update: {
          assigned_by_membership_id?: string | null
          created_at?: string
          membership_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrity_case_assignments_assigned_by_membership_id_fkey"
            columns: ["assigned_by_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrity_case_assignments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrity_case_assignments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "integrity_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      integrity_case_events: {
        Row: {
          actor_membership_id: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: number
          metadata: Json
          note: string | null
          report_id: string
          to_status: string | null
        }
        Insert: {
          actor_membership_id?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: never
          metadata?: Json
          note?: string | null
          report_id: string
          to_status?: string | null
        }
        Update: {
          actor_membership_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: never
          metadata?: Json
          note?: string | null
          report_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrity_case_events_actor_membership_id_fkey"
            columns: ["actor_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrity_case_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "integrity_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      integrity_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          slug: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          slug: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          slug?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrity_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integrity_channels: {
        Row: {
          active: boolean
          allows_anonymous: boolean
          created_at: string
          id: string
          name: string
          public_slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          allows_anonymous?: boolean
          created_at?: string
          id?: string
          name: string
          public_slug: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          allows_anonymous?: boolean
          created_at?: string
          id?: string
          name?: string
          public_slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrity_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integrity_report_messages: {
        Row: {
          author_membership_id: string | null
          author_type: string
          body: string
          created_at: string
          id: string
          report_id: string
          visible_to_reporter: boolean
        }
        Insert: {
          author_membership_id?: string | null
          author_type: string
          body: string
          created_at?: string
          id?: string
          report_id: string
          visible_to_reporter?: boolean
        }
        Update: {
          author_membership_id?: string | null
          author_type?: string
          body?: string
          created_at?: string
          id?: string
          report_id?: string
          visible_to_reporter?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "integrity_report_messages_author_membership_id_fkey"
            columns: ["author_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrity_report_messages_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "integrity_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      integrity_report_secrets: {
        Row: {
          created_at: string
          report_id: string
          secret_hash: string
        }
        Insert: {
          created_at?: string
          report_id: string
          secret_hash: string
        }
        Update: {
          created_at?: string
          report_id?: string
          secret_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrity_report_secrets_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "integrity_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      integrity_reports: {
        Row: {
          category_id: string | null
          channel_id: string
          created_at: string
          description: string
          id: string
          occurred_at: string | null
          protocol: string
          reporter_mode: string
          risk_level: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          channel_id: string
          created_at?: string
          description: string
          id?: string
          occurred_at?: string | null
          protocol: string
          reporter_mode?: string
          risk_level?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          channel_id?: string
          created_at?: string
          description?: string
          id?: string
          occurred_at?: string | null
          protocol?: string
          reporter_mode?: string
          risk_level?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrity_reports_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "integrity_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrity_reports_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "integrity_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrity_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string | null
          id: string
          invited_by_membership_id: string | null
          role_keys: string[]
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string | null
          id?: string
          invited_by_membership_id?: string | null
          role_keys?: string[]
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string | null
          id?: string
          invited_by_membership_id?: string | null
          role_keys?: string[]
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_membership_id_fkey"
            columns: ["invited_by_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_lead_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          lead_id: string
          metadata: Json
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: never
          lead_id: string
          metadata?: Json
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: never
          lead_id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "marketing_lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "marketing_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_leads: {
        Row: {
          company: string
          consent: boolean
          consent_at: string | null
          created_at: string
          email: string
          id: string
          interests: string[]
          message: string | null
          name: string
          phone: string | null
          role_title: string | null
          source: string
          status: string
          updated_at: string
          utm: Json
        }
        Insert: {
          company: string
          consent?: boolean
          consent_at?: string | null
          created_at?: string
          email: string
          id?: string
          interests?: string[]
          message?: string | null
          name: string
          phone?: string | null
          role_title?: string | null
          source?: string
          status?: string
          updated_at?: string
          utm?: Json
        }
        Update: {
          company?: string
          consent?: boolean
          consent_at?: string | null
          created_at?: string
          email?: string
          id?: string
          interests?: string[]
          message?: string | null
          name?: string
          phone?: string | null
          role_title?: string | null
          source?: string
          status?: string
          updated_at?: string
          utm?: Json
        }
        Relationships: []
      }
      membership_roles: {
        Row: {
          created_at: string
          membership_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          membership_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          membership_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_roles_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          department_id: string | null
          employee_code: string | null
          employment_level: string
          id: string
          joined_at: string
          manager_membership_id: string | null
          position_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          employee_code?: string | null
          employment_level?: string
          id?: string
          joined_at?: string
          manager_membership_id?: string | null
          position_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          employee_code?: string | null
          employment_level?: string
          id?: string
          joined_at?: string
          manager_membership_id?: string | null
          position_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_manager_membership_id_fkey"
            columns: ["manager_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          membership_id: string
          read_at: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          membership_id: string
          read_at?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          membership_id?: string
          read_at?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      people_communication_reads: {
        Row: {
          communication_id: string
          membership_id: string
          read_at: string
        }
        Insert: {
          communication_id: string
          membership_id: string
          read_at?: string
        }
        Update: {
          communication_id?: string
          membership_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_communication_reads_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "people_communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_communication_reads_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      people_communications: {
        Row: {
          audience: Json
          body: string
          created_at: string
          expires_at: string | null
          id: string
          published_at: string | null
          published_by_membership_id: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Json
          body: string
          created_at?: string
          expires_at?: string | null
          id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Json
          body?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_communications_published_by_membership_id_fkey"
            columns: ["published_by_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_communications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      people_document_acknowledgements: {
        Row: {
          acknowledged_at: string
          document_id: string
          membership_id: string
        }
        Insert: {
          acknowledged_at?: string
          document_id: string
          membership_id: string
        }
        Update: {
          acknowledged_at?: string
          document_id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_document_acknowledgements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "people_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_document_acknowledgements_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      people_document_assignments: {
        Row: {
          assigned_at: string
          document_id: string
          membership_id: string
        }
        Insert: {
          assigned_at?: string
          document_id: string
          membership_id: string
        }
        Update: {
          assigned_at?: string
          document_id?: string
          membership_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_document_assignments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "people_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_document_assignments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      people_documents: {
        Row: {
          created_at: string
          description: string | null
          file_id: string
          id: string
          published_at: string | null
          published_by_membership_id: string | null
          requires_ack: boolean
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_id: string
          id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          requires_ack?: boolean
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_id?: string
          id?: string
          published_at?: string | null
          published_by_membership_id?: string | null
          requires_ack?: boolean
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_documents_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_documents_published_by_membership_id_fkey"
            columns: ["published_by_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      people_employee_profiles: {
        Row: {
          cost_center: string | null
          created_at: string
          hire_date: string | null
          membership_id: string
          metadata: Json
          tenant_id: string
          updated_at: string
          work_location: string | null
        }
        Insert: {
          cost_center?: string | null
          created_at?: string
          hire_date?: string | null
          membership_id: string
          metadata?: Json
          tenant_id: string
          updated_at?: string
          work_location?: string | null
        }
        Update: {
          cost_center?: string | null
          created_at?: string
          hire_date?: string | null
          membership_id?: string
          metadata?: Json
          tenant_id?: string
          updated_at?: string
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_employee_profiles_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: true
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_employee_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      people_hr_meetings: {
        Row: {
          created_at: string
          ends_at: string | null
          hr_owner_membership_id: string | null
          id: string
          notes: string | null
          requester_membership_id: string
          starts_at: string | null
          status: string
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          hr_owner_membership_id?: string | null
          id?: string
          notes?: string | null
          requester_membership_id: string
          starts_at?: string | null
          status?: string
          subject: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          hr_owner_membership_id?: string | null
          id?: string
          notes?: string | null
          requester_membership_id?: string
          starts_at?: string | null
          status?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_hr_meetings_hr_owner_membership_id_fkey"
            columns: ["hr_owner_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_hr_meetings_requester_membership_id_fkey"
            columns: ["requester_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_hr_meetings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      people_payslips: {
        Row: {
          created_at: string
          file_id: string
          id: string
          membership_id: string
          published_at: string | null
          reference_month: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          membership_id: string
          published_at?: string | null
          reference_month: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          membership_id?: string
          published_at?: string | null
          reference_month?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_payslips_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_payslips_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_payslips_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      people_request_events: {
        Row: {
          actor_membership_id: string | null
          body: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: number
          request_id: string
          to_status: string | null
        }
        Insert: {
          actor_membership_id?: string | null
          body?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: never
          request_id: string
          to_status?: string | null
        }
        Update: {
          actor_membership_id?: string | null
          body?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: never
          request_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_request_events_actor_membership_id_fkey"
            columns: ["actor_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "people_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      people_request_types: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_request_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      people_requests: {
        Row: {
          assigned_to_membership_id: string | null
          created_at: string
          description: string | null
          id: string
          request_type_id: string
          requester_membership_id: string
          resolved_at: string | null
          status: string
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to_membership_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          request_type_id: string
          requester_membership_id: string
          resolved_at?: string | null
          status?: string
          subject: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to_membership_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          request_type_id?: string
          requester_membership_id?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "people_requests_assigned_to_membership_id_fkey"
            columns: ["assigned_to_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_requests_request_type_id_fkey"
            columns: ["request_type_id"]
            isOneToOne: false
            referencedRelation: "people_request_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_requests_requester_membership_id_fkey"
            columns: ["requester_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string
          id: string
          key: string
          solution_key: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          key: string
          solution_key?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          key?: string
          solution_key?: string | null
        }
        Relationships: []
      }
      platform_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip_address: unknown
          metadata: Json
          request_id: string | null
          severity: string
          team_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          ip_address?: unknown
          metadata?: Json
          request_id?: string | null
          severity?: string
          team_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          ip_address?: unknown
          metadata?: Json
          request_id?: string | null
          severity?: string
          team_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_audit_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "platform_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_client_assignments: {
        Row: {
          assigned_by_user_id: string | null
          assignment_type: string
          created_at: string
          id: string
          owner_platform_member_id: string | null
          status: string
          team_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_by_user_id?: string | null
          assignment_type?: string
          created_at?: string
          id?: string
          owner_platform_member_id?: string | null
          status?: string
          team_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_by_user_id?: string | null
          assignment_type?: string
          created_at?: string
          id?: string
          owner_platform_member_id?: string | null
          status?: string
          team_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_client_assignments_owner_platform_member_id_fkey"
            columns: ["owner_platform_member_id"]
            isOneToOne: false
            referencedRelation: "platform_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_client_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "platform_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_client_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_lead_assignments: {
        Row: {
          assigned_at: string
          assigned_by_user_id: string | null
          lead_id: string
          owner_platform_member_id: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          lead_id: string
          owner_platform_member_id?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by_user_id?: string | null
          lead_id?: string
          owner_platform_member_id?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "marketing_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_lead_assignments_owner_platform_member_id_fkey"
            columns: ["owner_platform_member_id"]
            isOneToOne: false
            referencedRelation: "platform_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_lead_assignments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "platform_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          relationship_type: string
          role_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          relationship_type?: string
          role_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          relationship_type?: string
          role_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "platform_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_permissions: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          key: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          key: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          key?: string
        }
        Relationships: []
      }
      platform_role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "platform_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "platform_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_roles: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          rank: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
          rank?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
          rank?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_team_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          joined_at: string
          platform_member_id: string
          status: string
          team_id: string
          team_role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string
          platform_member_id: string
          status?: string
          team_id: string
          team_role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string
          platform_member_id?: string
          status?: string
          team_id?: string
          team_role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_team_members_platform_member_id_fkey"
            columns: ["platform_member_id"]
            isOneToOne: false
            referencedRelation: "platform_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "platform_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_teams: {
        Row: {
          allow_self_claim: boolean
          channel: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          member_client_visibility: string
          member_lead_visibility: string
          name: string
          settings: Json
          slug: string
          status: string
          team_type: string
          updated_at: string
        }
        Insert: {
          allow_self_claim?: boolean
          channel?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          member_client_visibility?: string
          member_lead_visibility?: string
          name: string
          settings?: Json
          slug: string
          status?: string
          team_type?: string
          updated_at?: string
        }
        Update: {
          allow_self_claim?: boolean
          channel?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          member_client_visibility?: string
          member_lead_visibility?: string
          name?: string
          settings?: Json
          slug?: string
          status?: string
          team_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          active: boolean
          created_at: string
          department_id: string | null
          id: string
          level_key: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          department_id?: string | null
          id?: string
          level_key: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          department_id?: string | null
          id?: string
          level_key?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "positions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          full_name: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      solutions: {
        Row: {
          created_at: string
          id: string
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      talent_application_stage_history: {
        Row: {
          application_id: string
          changed_by_membership_id: string | null
          created_at: string
          from_stage_id: string | null
          id: number
          note: string | null
          to_stage_id: string | null
        }
        Insert: {
          application_id: string
          changed_by_membership_id?: string | null
          created_at?: string
          from_stage_id?: string | null
          id?: never
          note?: string | null
          to_stage_id?: string | null
        }
        Update: {
          application_id?: string
          changed_by_membership_id?: string | null
          created_at?: string
          from_stage_id?: string | null
          id?: never
          note?: string | null
          to_stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_application_stage_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "talent_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_application_stage_history_changed_by_membership_id_fkey"
            columns: ["changed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_application_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "talent_job_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_application_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "talent_job_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_applications: {
        Row: {
          applied_at: string
          candidate_id: string
          cover_letter: string | null
          current_stage_id: string | null
          id: string
          job_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          applied_at?: string
          candidate_id: string
          cover_letter?: string | null
          current_stage_id?: string | null
          id?: string
          job_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          applied_at?: string
          candidate_id?: string
          cover_letter?: string | null
          current_stage_id?: string | null
          id?: string
          job_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "talent_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_applications_current_stage_id_fkey"
            columns: ["current_stage_id"]
            isOneToOne: false
            referencedRelation: "talent_job_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "talent_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_assessment_templates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          instructions: string | null
          name: string
          questions: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          name: string
          questions?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          instructions?: string | null
          name?: string
          questions?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_assessment_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_assessments: {
        Row: {
          application_id: string
          id: string
          invited_at: string
          responses: Json
          reviewed_by_membership_id: string | null
          score: number | null
          status: string
          submitted_at: string | null
          template_id: string
          tenant_id: string
        }
        Insert: {
          application_id: string
          id?: string
          invited_at?: string
          responses?: Json
          reviewed_by_membership_id?: string | null
          score?: number | null
          status?: string
          submitted_at?: string | null
          template_id: string
          tenant_id: string
        }
        Update: {
          application_id?: string
          id?: string
          invited_at?: string
          responses?: Json
          reviewed_by_membership_id?: string | null
          score?: number | null
          status?: string
          submitted_at?: string | null
          template_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_assessments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "talent_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_assessments_reviewed_by_membership_id_fkey"
            columns: ["reviewed_by_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_assessments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "talent_assessment_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_assessments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_candidates: {
        Row: {
          consent_at: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          linkedin_url: string | null
          phone: string | null
          resume_file_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          consent_at?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          linkedin_url?: string | null
          phone?: string | null
          resume_file_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          consent_at?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          linkedin_url?: string | null
          phone?: string | null
          resume_file_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_candidates_resume_file_id_fkey"
            columns: ["resume_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_career_sites: {
        Row: {
          created_at: string
          description: string | null
          id: string
          published: boolean
          settings: Json
          slug: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          published?: boolean
          settings?: Json
          slug: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          published?: boolean
          settings?: Json
          slug?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_career_sites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_feedback: {
        Row: {
          application_id: string
          author_membership_id: string
          created_at: string
          id: string
          notes: string | null
          rating: number | null
          recommendation: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          application_id: string
          author_membership_id: string
          created_at?: string
          id?: string
          notes?: string | null
          rating?: number | null
          recommendation?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          author_membership_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          rating?: number | null
          recommendation?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_feedback_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "talent_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_feedback_author_membership_id_fkey"
            columns: ["author_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_interviews: {
        Row: {
          application_id: string
          created_at: string
          ends_at: string | null
          id: string
          interviewer_membership_id: string | null
          location_or_url: string | null
          notes: string | null
          starts_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          ends_at?: string | null
          id?: string
          interviewer_membership_id?: string | null
          location_or_url?: string | null
          notes?: string | null
          starts_at: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          interviewer_membership_id?: string | null
          location_or_url?: string | null
          notes?: string | null
          starts_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "talent_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_interviews_interviewer_membership_id_fkey"
            columns: ["interviewer_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_interviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_job_stages: {
        Row: {
          created_at: string
          id: string
          job_id: string
          name: string
          position: number
          stage_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          name: string
          position: number
          stage_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          name?: string
          position?: number
          stage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_job_stages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "talent_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_jobs: {
        Row: {
          career_site_id: string | null
          closes_at: string | null
          created_at: string
          created_by_membership_id: string | null
          department_id: string | null
          description: string
          employment_type: string | null
          id: string
          location: string | null
          published_at: string | null
          requirements: string | null
          slug: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
          work_model: string | null
        }
        Insert: {
          career_site_id?: string | null
          closes_at?: string | null
          created_at?: string
          created_by_membership_id?: string | null
          department_id?: string | null
          description: string
          employment_type?: string | null
          id?: string
          location?: string | null
          published_at?: string | null
          requirements?: string | null
          slug: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          work_model?: string | null
        }
        Update: {
          career_site_id?: string | null
          closes_at?: string | null
          created_at?: string
          created_by_membership_id?: string | null
          department_id?: string | null
          description?: string
          employment_type?: string | null
          id?: string
          location?: string | null
          published_at?: string | null
          requirements?: string | null
          slug?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          work_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_jobs_career_site_id_fkey"
            columns: ["career_site_id"]
            isOneToOne: false
            referencedRelation: "talent_career_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_jobs_created_by_membership_id_fkey"
            columns: ["created_by_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_jobs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_pool_members: {
        Row: {
          added_by_membership_id: string | null
          candidate_id: string
          created_at: string
          pool_id: string
        }
        Insert: {
          added_by_membership_id?: string | null
          candidate_id: string
          created_at?: string
          pool_id: string
        }
        Update: {
          added_by_membership_id?: string | null
          candidate_id?: string
          created_at?: string
          pool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_pool_members_added_by_membership_id_fkey"
            columns: ["added_by_membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_pool_members_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "talent_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_pool_members_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "talent_pools"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_pools: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_pools_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_billing_state: {
        Row: {
          access_status: string
          contract_id: string | null
          created_at: string
          grace_ends_at: string | null
          last_payment_id: string | null
          paid_through: string | null
          subscription_id: string | null
          suspended_at: string | null
          suspension_reason: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          access_status?: string
          contract_id?: string | null
          created_at?: string
          grace_ends_at?: string | null
          last_payment_id?: string | null
          paid_through?: string | null
          subscription_id?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          access_status?: string
          contract_id?: string | null
          created_at?: string
          grace_ends_at?: string | null
          last_payment_id?: string | null
          paid_through?: string | null
          subscription_id?: string | null
          suspended_at?: string | null
          suspension_reason?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_billing_state_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "commercial_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_billing_state_last_payment_id_fkey"
            columns: ["last_payment_id"]
            isOneToOne: false
            referencedRelation: "billing_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_billing_state_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "billing_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_billing_state_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_domains: {
        Row: {
          created_at: string
          hostname: string
          id: string
          is_primary: boolean
          tenant_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          hostname: string
          id?: string
          is_primary?: boolean
          tenant_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          hostname?: string
          id?: string
          is_primary?: boolean
          tenant_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_solutions: {
        Row: {
          config: Json
          created_at: string
          solution_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          solution_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          solution_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_solutions_solution_id_fkey"
            columns: ["solution_id"]
            isOneToOne: false
            referencedRelation: "solutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_solutions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          settings: Json
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          settings?: Json
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          settings?: Json
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_add_membership: {
        Args: {
          p_department_slug: string
          p_employment_level: string
          p_role_keys: string[]
          p_tenant_id: string
          p_user_id: string
        }
        Returns: string
      }
      can_read_file: { Args: { p_file_id: string }; Returns: boolean }
      can_read_membership: {
        Args: { p_membership_id: string }
        Returns: boolean
      }
      can_read_profile: { Args: { p_user_id: string }; Returns: boolean }
      can_read_storage_path: {
        Args: { p_bucket: string; p_object_path: string }
        Returns: boolean
      }
      current_membership_id: { Args: { p_tenant_id: string }; Returns: string }
      get_integrity_form: {
        Args: { p_channel_slug: string }
        Returns: {
          category_name: string
          category_slug: string
          channel_name: string
        }[]
      }
      has_permission: {
        Args: { p_permission_key: string; p_tenant_id: string }
        Returns: boolean
      }
      is_own_membership: { Args: { p_membership_id: string }; Returns: boolean }
      is_tenant_member: { Args: { p_tenant_id: string }; Returns: boolean }
      platform_authorize_client: {
        Args: {
          p_actor_user_id: string
          p_permission_key: string
          p_tenant_id: string
          p_write?: boolean
        }
        Returns: boolean
      }
      platform_authorize_lead: {
        Args: {
          p_actor_user_id: string
          p_lead_id: string
          p_permission_key: string
          p_write?: boolean
        }
        Returns: boolean
      }
      platform_authorize_team: {
        Args: {
          p_actor_user_id: string
          p_permission_key: string
          p_require_manager?: boolean
          p_team_id: string
        }
        Returns: boolean
      }
      platform_can_claim_lead: {
        Args: { p_actor_user_id: string; p_lead_id: string }
        Returns: boolean
      }
      post_integrity_reporter_message: {
        Args: { p_access_secret: string; p_body: string; p_protocol: string }
        Returns: string
      }
      provision_paid_contract: {
        Args: {
          p_actor_user_id?: string
          p_contract_id: string
          p_owner_user_id: string
          p_payment_id: string
        }
        Returns: string
      }
      provision_tenant: {
        Args: { p_name: string; p_owner_user_id: string; p_slug: string }
        Returns: string
      }
      read_integrity_report: {
        Args: { p_access_secret: string; p_protocol: string }
        Returns: {
          message_author_type: string
          message_body: string
          message_created_at: string
          message_id: string
          report_created_at: string
          report_id: string
          report_status: string
        }[]
      }
      safe_uuid: { Args: { p_value: string }; Returns: string }
      submit_integrity_report: {
        Args: {
          p_category_slug: string
          p_channel_slug: string
          p_description: string
          p_occurred_at?: string
        }
        Returns: {
          access_secret: string
          protocol: string
        }[]
      }
      submit_marketing_lead: {
        Args: {
          p_company: string
          p_consent?: boolean
          p_email: string
          p_interests?: string[]
          p_message?: string
          p_name: string
          p_phone?: string
          p_role_title?: string
          p_source?: string
          p_utm?: Json
        }
        Returns: string
      }
      submit_talent_application: {
        Args: {
          p_consent?: boolean
          p_cover_letter?: string
          p_email: string
          p_full_name: string
          p_job_id: string
          p_linkedin_url?: string
          p_phone?: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
