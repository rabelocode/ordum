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
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_path: string | null
          status: string | null
          created_at: string
          updated_at: string
        }
      }
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          status: string
          settings: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
      }
      memberships: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          department_id: string | null
          position_id: string | null
          manager_membership_id: string | null
          employee_code: string | null
          employment_level: string | null
          status: string
          joined_at: string | null
          created_at: string
          updated_at: string
        }
      }
      departments: {
        Row: {
          id: string
          tenant_id: string
          name: string
          slug: string
          parent_id: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
      }
      positions: {
        Row: {
          id: string
          tenant_id: string
          department_id: string | null
          name: string
          level_key: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
      }
      tenant_domains: {
        Row: {
          id: string
          tenant_id: string
          hostname: string
          is_primary: boolean
          verified_at: string | null
          created_at: string
        }
      }
      solutions: {
        Row: {
          id: string
          key: string
          name: string
          created_at: string
        }
      }
      tenant_solutions: {
        Row: {
          tenant_id: string
          solution_id: string
          status: string
          config: Json | null
          created_at: string
          updated_at: string
        }
      }
      roles: {
        Row: {
          id: string
          tenant_id: string | null
          key: string
          name: string
          description: string | null
          is_system: boolean
          created_at: string
          updated_at: string
        }
      }
      membership_roles: {
        Row: {
          membership_id: string
          role_id: string
          created_at: string
        }
      }
      permissions: {
        Row: {
          id: string
          key: string
          solution_key: string | null
          description: string | null
          created_at: string
        }
      }
      role_permissions: {
        Row: {
          role_id: string
          permission_id: string
          created_at: string
        }
      }
      marketing_leads: {
        Row: {
          id: string
          name: string
          email: string
          company: string
          role_title: string | null
          phone: string | null
          interests: string[] | null
          message: string | null
          consent: boolean
          consent_at: string | null
          source: string | null
          utm: Json | null
          status: string
          created_at: string
          updated_at: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_integrity_form: {
        Args: { p_channel_slug: string }
        Returns: any[]
      }
      submit_integrity_report: {
        Args: { p_channel_slug: string, p_category_slug: string, p_description: string, p_occurred_at: string | null }
        Returns: any
      }
      submit_marketing_lead: {
        Args: {
          p_name: string
          p_email: string
          p_company: string
          p_role_title: string | null
          p_phone: string | null
          p_interests: string[] | null
          p_message: string | null
          p_consent: boolean
          p_source: string | null
          p_utm: Json | null
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
