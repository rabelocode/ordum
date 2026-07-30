export type PlatformRelationshipType = "partner" | "employee" | "contractor" | "representative" | "agency" | "other";

export interface PlatformMember {
  id: string;
  user_id: string;
  relationship_type: PlatformRelationshipType;
  status: string;
  created_at: string;
}

export interface PlatformRole {
  id: string;
  key: "admin" | "manager" | "sales";
  name: string;
}

export interface PlatformPermission {
  id: string;
  key: string;
  description: string;
}

export type PlatformTeamType = "sales" | "customer_success" | "implementation" | "support" | "operations" | "marketing" | "engineering" | "other";
export type PlatformTeamChannel = "internal" | "external" | "mixed";

export interface PlatformTeam {
  id: string;
  name: string;
  slug: string;
  description: string;
  team_type: PlatformTeamType;
  channel: PlatformTeamChannel;
  status: string;
  member_lead_visibility: "own" | "team" | "all";
  member_client_visibility: "own" | "team" | "all";
  allow_self_claim: boolean;
  settings: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PlatformTeamMember {
  team_id: string;
  platform_member_id: string;
  team_role: "manager" | "member";
  status: string;
  joined_at: string;
}
