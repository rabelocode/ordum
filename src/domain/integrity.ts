export const INTEGRITY_TRANSITIONS: Record<string, readonly string[]> = {
  received: ["triage", "archived"],
  triage: ["investigation", "waiting_information", "archived"],
  investigation: ["waiting_information", "decision", "archived"],
  waiting_information: ["investigation", "decision", "archived"],
  decision: ["closed", "investigation"],
  closed: ["reopened"],
  reopened: ["triage"],
  archived: [],
};

export function canTransitionIntegrityCase(from: string, to: string) {
  return (INTEGRITY_TRANSITIONS[from] || []).includes(to);
}

export function integrityTransitionNeedsReason(to: string) {
  return ["closed", "reopened", "archived"].includes(to);
}

export function canAssignIntegrityCase(input: {
  membershipActive: boolean;
  sameTenant: boolean;
  activeConflict: boolean;
}) {
  return input.membershipActive && input.sameTenant && !input.activeConflict;
}

export function integritySlaDueAt(createdAt: Date, hours: number) {
  if (!Number.isInteger(hours) || hours < 1 || hours > 8760)
    throw new Error("invalid_sla_hours");
  return new Date(createdAt.getTime() + hours * 3_600_000);
}

export function publicIntegrityMessages<
  T extends { visible_to_reporter: boolean },
>(messages: T[]) {
  return messages.filter((message) => message.visible_to_reporter);
}

export function integrityDashboard(
  cases: Array<{
    id?: string;
    status: string;
    severity: string;
    sla_due_at?: string | null;
    first_response_due_at?: string | null;
    treatment_due_at?: string | null;
    created_at: string;
    first_action_at?: string | null;
    closed_at?: string | null;
    owner_membership_id?: string | null;
    category_id?: string | null;
    unit_id?: string | null;
    integrity_categories?: { name?: string | null } | null;
    integrity_units?: { name?: string | null } | null;
  }>,
  now = new Date(),
) {
  const open = (item: { status: string }) =>
    !["closed", "archived"].includes(item.status);
  const averageHours = (values: number[]) =>
    values.length
      ? Math.round(
          values.reduce((sum, value) => sum + value, 0) /
            values.length /
            3_600_000,
        )
      : null;
  const distribution = (
    key: "severity" | "category" | "unit",
  ) => {
    const counts = new Map<string, number>();
    for (const item of cases) {
      const value =
        key === "severity"
          ? item.severity
          : key === "category"
            ? item.integrity_categories?.name || "Sem categoria"
            : item.integrity_units?.name || "Sem unidade";
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  };
  const evolution = new Map<string, number>();
  for (const item of cases) {
    const day = item.created_at.slice(0, 10);
    evolution.set(day, (evolution.get(day) || 0) + 1);
  }
  return {
    total: cases.length,
    open: cases.filter(open).length,
    received: cases.filter((item) => item.status === "received").length,
    triage: cases.filter((item) => item.status === "triage").length,
    investigation: cases.filter((item) => item.status === "investigation")
      .length,
    waiting_information: cases.filter(
      (item) => item.status === "waiting_information",
    ).length,
    critical: cases.filter((item) => item.severity === "critical" && open(item))
      .length,
    sla_overdue: cases.filter(
      (item) =>
        item.sla_due_at && new Date(item.sla_due_at) < now && open(item),
    ).length,
    sla_due_soon: cases.filter(
      (item) =>
        item.sla_due_at &&
        new Date(item.sla_due_at) >= now &&
        new Date(item.sla_due_at).getTime() <= now.getTime() + 86_400_000 &&
        open(item),
    ).length,
    first_response_overdue: cases.filter(
      (item) =>
        !item.first_action_at &&
        item.first_response_due_at &&
        new Date(item.first_response_due_at) < now &&
        open(item),
    ).length,
    treatment_overdue: cases.filter(
      (item) =>
        item.treatment_due_at &&
        new Date(item.treatment_due_at) < now &&
        open(item),
    ).length,
    closed: cases.filter((item) => item.status === "closed").length,
    unassigned: cases.filter((item) => open(item) && !item.owner_membership_id)
      .length,
    by_category: distribution("category"),
    by_unit: distribution("unit"),
    by_severity: distribution("severity"),
    evolution: [...evolution.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    average_first_action_hours: averageHours(
      cases
        .filter((item) => item.first_action_at)
        .map(
          (item) =>
            new Date(item.first_action_at!).getTime() -
            new Date(item.created_at).getTime(),
        ),
    ),
    average_resolution_hours: averageHours(
      cases
        .filter((item) => item.closed_at)
        .map(
          (item) =>
            new Date(item.closed_at!).getTime() -
            new Date(item.created_at).getTime(),
        ),
    ),
  };
}
