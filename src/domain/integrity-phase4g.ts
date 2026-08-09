export const PUBLIC_INTEGRITY_STATUS: Record<string, string> = {
  received: "Recebido",
  triage: "Em análise",
  investigation: "Em análise",
  waiting_information: "Aguardando suas informações",
  decision: "Em análise final",
  closed: "Concluído",
  reopened: "Reaberto para análise",
  archived: "Concluído",
};

export type IntegrityCustomField = {
  id: string;
  field_key: string;
  label: string;
  field_type: "short_text" | "long_text" | "single_select" | "multi_select" | "date" | "boolean";
  required: boolean;
  options?: unknown;
};

export function publicIntegrityStatus(status: string) {
  return PUBLIC_INTEGRITY_STATUS[status] || "Em análise";
}

export function validateIntegrityCustomValues(
  fields: IntegrityCustomField[],
  input: Record<string, unknown> | undefined,
) {
  const values = input || {};
  const allowed = new Set(fields.map((field) => field.field_key));
  if (Object.keys(values).some((key) => !allowed.has(key)))
    return { valid: false as const, error: "O formulário contém um campo não permitido." };
  const rows: Array<Record<string, unknown>> = [];
  for (const field of fields) {
    const value = values[field.field_key];
    const missing = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    if (field.required && missing)
      return { valid: false as const, error: `Preencha o campo ${field.label}.` };
    if (missing) continue;
    const options = Array.isArray(field.options) ? field.options.filter((item): item is string => typeof item === "string") : [];
    const row: Record<string, unknown> = { field_id: field.id };
    if (field.field_type === "short_text" || field.field_type === "long_text") {
      if (typeof value !== "string" || value.length > (field.field_type === "short_text" ? 300 : 5000))
        return { valid: false as const, error: `Revise o campo ${field.label}.` };
      row.text_value = value.trim();
    } else if (field.field_type === "single_select") {
      if (typeof value !== "string" || !options.includes(value))
        return { valid: false as const, error: `Selecione uma opção válida em ${field.label}.` };
      row.text_value = value;
    } else if (field.field_type === "multi_select") {
      if (!Array.isArray(value) || value.length > 20 || value.some((item) => typeof item !== "string" || !options.includes(item)))
        return { valid: false as const, error: `Selecione opções válidas em ${field.label}.` };
      row.text_array_value = [...new Set(value)];
    } else if (field.field_type === "date") {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
        return { valid: false as const, error: `Informe uma data válida em ${field.label}.` };
      row.date_value = value;
    } else {
      if (typeof value !== "boolean") return { valid: false as const, error: `Revise o campo ${field.label}.` };
      row.boolean_value = value;
    }
    rows.push(row);
  }
  return { valid: true as const, rows };
}

export function integrityDeploymentState(checks: Array<{ key: string; complete: boolean }>) {
  const done = new Set(checks.filter((item) => item.complete).map((item) => item.key));
  if (done.has("published")) return "published";
  if (done.has("channel_test") && checks.every((item) => item.key === "published" || item.complete)) return "ready_for_publish";
  if (["channel", "categories", "committee", "routing", "sla"].every((key) => done.has(key))) return "ready_for_test";
  return done.size ? "incomplete" : "not_started";
}

export function routingExplanation(rule: Record<string, unknown>, labels: Record<string, string> = {}) {
  const conditions = [
    rule.category_id && `categoria ${labels[String(rule.category_id)] || "selecionada"}`,
    rule.unit_id && `unidade ${labels[String(rule.unit_id)] || "selecionada"}`,
    rule.department_id && `setor ${labels[String(rule.department_id)] || "selecionado"}`,
    rule.severity && `severidade ${rule.severity}`,
    rule.reporter_mode && `relato ${rule.reporter_mode === "anonymous" ? "anônimo" : "identificado"}`,
    typeof rule.requires_conflict === "boolean" && `${rule.requires_conflict ? "com" : "sem"} conflito`,
  ].filter(Boolean);
  const actions = [
    rule.committee_id && "atribuir comitê",
    rule.assignee_membership_id && "atribuir responsável",
    rule.target_priority && `prioridade ${rule.target_priority}`,
    rule.target_sla_hours && `SLA de ${rule.target_sla_hours}h`,
    (rule.escalation_committee_id || rule.escalation_membership_id) && "escalar",
  ].filter(Boolean);
  return `${conditions.length ? `Quando ${conditions.join(", ")}` : "Regra de fallback"}, ${actions.join(", ") || "manter roteamento padrão"}.`;
}
