export type ModuleId = "integrity" | "people" | "talent";

export type FutureModuleId =
  | "processes"
  | "documents"
  | "tickets"
  | "performance"
  | "academy"
  | "metrics";

export type ModuleIntegrationMode =
  | "internal"
  | "external"
  | "disabled"
  | "coming_soon";

export interface ModuleQuickAction {
  id: string;
  label: string;
  iconName: string;
  actionUrl: string;
}

export interface ModuleManifest {
  id: ModuleId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  icon: string;
  accentColor: string;
  darkColor: string;
  lightColor: string;
  basePath: string;
  integrationMode: ModuleIntegrationMode;
  externalUrl?: string;
  enabled: boolean;
  quickActions: ModuleQuickAction[];
  features: string[];
}

export interface FutureModuleManifest {
  id: FutureModuleId;
  name: string;
  description: string;
  icon: string;
  status: "coming_soon" | "roadmap";
}

export interface TenantBranding {
  companyName: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor?: string;
  welcomeMessage: string;
  supportEmail: string;
  privacyPolicyUrl?: string;
  customDomain?: string;
  subdomain?: string;
}

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  branding: TenantBranding;
  createdAt: string;
}

export interface TenantEntitlements {
  tenantId: string;
  enabledModules: ModuleId[];
  permissions: string[];
  maxUsers?: number;
  planName: string;
}

export interface UserProfile {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: "admin" | "manager" | "employee" | "compliance_officer" | "recruiter";
  permissions: string[];
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  tenant: TenantInfo | null;
  entitlements: TenantEntitlements | null;
}

export interface AuthCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  tenant?: TenantInfo;
  error?: string;
}

// Module Data Models (Mock/DTO Interfaces)
export interface IntegrityReportItem {
  id: string;
  protocol: string;
  category: string;
  status: "new" | "in_review" | "investigating" | "closed";
  date: string;
  isAnonymous: boolean;
  priority: "high" | "medium" | "low";
  summary: string;
}

export interface PeopleEmployeeItem {
  id: string;
  name: string;
  role: string;
  department: string;
  status: "active" | "on_leave" | "onboarding";
  unreadDocsCount: number;
}

export interface TalentJobItem {
  id: string;
  title: string;
  department: string;
  candidatesCount: number;
  status: "open" | "draft" | "filled";
  location: string;
}
