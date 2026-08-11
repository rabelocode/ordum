type ErrorPayload = { error?: unknown; code?: unknown; message?: unknown } | null | undefined;

const KNOWN_ERRORS: Array<[RegExp, string]> = [
  [/self_approval_forbidden/i, "A aprovação precisa ser realizada por outra pessoa autorizada."],
  [/lead_assignment_required/i, "Atribua o lead a uma equipe antes de continuar."],
  [/proposal_invalid_transition|proposta.*aprova/i, "Esta proposta precisa ser aprovada antes de registrar o aceite."],
  [/contract.*proposal|proposta.*aceit/i, "Registre o aceite da proposta antes de gerar o contrato."],
  [/product|produto|item/i, "Inclua pelo menos um produto antes de continuar."],
  [/membership|tenant|workspace/i, "Você não possui acesso ao ambiente deste cliente."],
  [/permission|forbidden|not authorized|acesso negado/i, "Seu perfil não permite realizar esta ação."],
  [/conflict/i, "Outra pessoa atualizou este registro. Recarregue a página e tente novamente."],
  [/rate.?limit|too many/i, "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."],
  [/invalid transition|transi[cç][aã]o inv/i, "Esta mudança não está disponível na etapa atual."],
  [/duplicate|already exists|23505/i, "Já existe um registro com estas informações."],
];

const STATUS_MESSAGES: Record<number, string> = {
  400: "Revise os campos informados e tente novamente.",
  401: "Sua sessão expirou. Entre novamente para continuar.",
  403: "Seu perfil não permite realizar esta ação.",
  404: "Este registro não está mais disponível.",
  409: "Esta ação não pode ser concluída na etapa atual.",
  413: "O arquivo excede o tamanho permitido.",
  422: "Revise as informações obrigatórias antes de continuar.",
  429: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
};

export function userFacingApiError(payload: ErrorPayload, status: number, fallback = "Não foi possível concluir esta ação.") {
  const raw = [payload?.error, payload?.code, payload?.message].filter((value): value is string => typeof value === "string").join(" ");
  const known = KNOWN_ERRORS.find(([pattern]) => pattern.test(raw));
  if (known) return known[1];
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  return fallback;
}

export function userFacingException(error: unknown, fallback = "Não foi possível concluir esta ação.") {
  if (error instanceof Error) {
    const known = KNOWN_ERRORS.find(([pattern]) => pattern.test(error.message));
    if (known) return known[1];
    if (/^Não foi possível|^Revise|^Sua sessão|^Seu perfil|^Esta |^Já existe|^Muitas tentativas/i.test(error.message)) return error.message;
  }
  return fallback;
}
