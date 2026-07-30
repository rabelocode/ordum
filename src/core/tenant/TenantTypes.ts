export type TenantLifecycleStatus =
  | "lead"
  | "demo_requested"
  | "demo_approved"
  | "onboarding"
  | "active"
  | "suspended"
  | "expired";

export type SolutionId = "integrity" | "people" | "talent" | "process" | "docs" | "desk" | "perf" | "academy" | "bi";
export type SolutionEntitlementStatus = "available" | "demo" | "contracted" | "blocked";

export type SolutionEntitlement = {
  solutionId: SolutionId;
  status: SolutionEntitlementStatus;
  enabledAt?: string;
};

export type DemoAccessGrant = {
  id: string;
  tenantId: string;
  status: "pending" | "released" | "revoked" | "expired";
  releasedByConsultantId?: string;
  releasedAt?: string;
  expiresAt?: string;
  notes?: string;
};

export type Tenant = {
  id: string;
  slug: string;
  legalName: string;
  displayName: string;
  logoInitials: string;
  primaryColor: string;
  secondaryColor?: string;
  supportEmail?: string;
  lifecycleStatus: TenantLifecycleStatus;
  isFictionalDemo: boolean;
  demoAccess?: DemoAccessGrant;
  solutionEntitlements: SolutionEntitlement[];
  createdAt: string;
};

// --- NEW AUTH AND RBAC TYPES ---

export type AppRole = 
  // Ordum internal
  | "ORDUM_SUPER_ADMIN"
  | "ORDUM_SALES"
  | "ORDUM_SUPPORT"
  | "ORDUM_AUDITOR"
  // Tenant Base
  | "TENANT_ADMIN"
  | "EXECUTIVE"
  | "AREA_MANAGER"
  | "EMPLOYEE"
  | "APPRENTICE"
  | "INTERN"
  | "CUSTOM_ROLE"
  // People
  | "PEOPLE_EMPLOYEE"
  | "PEOPLE_MANAGER"
  | "PEOPLE_HR"
  | "PEOPLE_PAYROLL"
  | "PEOPLE_ADMIN"
  // Integrity
  | "INTEGRITY_TRIAGE"
  | "INTEGRITY_INVESTIGATOR"
  | "INTEGRITY_COMMITTEE"
  | "INTEGRITY_AUDITOR"
  | "INTEGRITY_ADMIN"
  // Talent
  | "TALENT_RECRUITER"
  | "TALENT_HIRING_MANAGER"
  | "TALENT_INTERVIEWER"
  | "TALENT_ADMIN";

export type Permission = 
  | "people.payslip.view_own" | "people.payslip.manage"
  | "people.communication.view" | "people.communication.manage"
  | "people.document.view_own" | "people.document.manage"
  | "people.request.create" | "people.request.view_own" | "people.request.manage_team" | "people.request.manage"
  | "people.hr_meeting.request" | "people.hr_meeting.manage"
  | "integrity.report.submit_public" | "integrity.report.follow_public"
  | "integrity.case.triage" | "integrity.case.view_assigned" | "integrity.case.investigate" 
  | "integrity.case.assign" | "integrity.case.close"
  | "integrity.indicator.view" | "integrity.audit.view"
  | "talent.job.create" | "talent.job.publish"
  | "talent.application.view" | "talent.application.move_stage"
  | "talent.assessment.manage" | "talent.interview.manage"
  | "talent.feedback.submit" | "talent.pool.manage";

export type User = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isOrdumInternal?: boolean;
};

export type Membership = {
  id: string;
  userId: string;
  tenantId: string;
  roles: AppRole[];
  departmentId?: string;
  positionId?: string;
};

export interface AccessContext {
  user: User;
  membership?: Membership;
  tenant?: Tenant;
}

// --- LEGACY ADAPTERS/INTERFACES ---

export interface CreateLeadInput {
  legalName: string;
  displayName: string;
  slug: string;
  supportEmail?: string;
}

export interface ReleaseDemoAccessInput {
  tenantId: string;
  solutionIds: SolutionId[];
  expiresAt: string;
  notes?: string;
  primaryColor?: string;
  logoInitials?: string;
}

export interface TenantAccessAdminAdapter {
  listCompanies(): Promise<Tenant[]>;
  getCompany(tenantId: string): Promise<Tenant | null>;
  createLead(input: CreateLeadInput): Promise<Tenant>;
  releaseDemoAccess(input: ReleaseDemoAccessInput): Promise<Tenant>;
  revokeDemoAccess(tenantId: string): Promise<Tenant>;
  updateSolutionEntitlements(
    tenantId: string,
    entitlements: SolutionEntitlement[]
  ): Promise<Tenant>;
  resetToDefaults(): Promise<void>;
}

export interface TenantAccessResolver {
  resolveBySlug(slug: string): Promise<Tenant | null>;
  canAccessTenant(tenant: Tenant): boolean;
}
