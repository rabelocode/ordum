import { supabase } from "../../lib/supabase";
import { Tenant, TenantAccessAdminAdapter, CreateLeadInput, ReleaseDemoAccessInput, SolutionEntitlement } from "./TenantTypes";

class ApiTenantAdapter implements TenantAccessAdminAdapter {
  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Não autenticado");
    const headers = {
      ...options.headers,
      "Authorization": `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Erro na requisição");
    }
    return response.json();
  }

  async listCompanies(): Promise<Tenant[]> {
    return this.fetchWithAuth("/api/admin/tenants");
  }

  async getCompany(tenantId: string): Promise<Tenant | null> {
    const tenants = await this.listCompanies();
    return tenants.find(t => t.id === tenantId) || null;
  }

  async createLead(input: CreateLeadInput): Promise<Tenant> {
    throw new Error("Use marketing form para criar leads");
  }

  async releaseDemoAccess(input: ReleaseDemoAccessInput): Promise<Tenant> {
    const res = await this.fetchWithAuth("/api/admin/tenants/release-demo", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return res.tenant;
  }

  async revokeDemoAccess(tenantId: string): Promise<Tenant> {
    await this.fetchWithAuth("/api/admin/tenants/revoke-demo", { method: "POST", body: JSON.stringify({ tenantId }) });
    const tenant = await this.getCompany(tenantId);
    return tenant!;
  }

  async updateSolutionEntitlements(tenantId: string, entitlements: SolutionEntitlement[]): Promise<Tenant> {
    throw new Error("Não implementado");
  }

  async resetToDefaults(): Promise<void> {
    // No-op for real DB
  }
}

export const tenantAdapter = new ApiTenantAdapter();
