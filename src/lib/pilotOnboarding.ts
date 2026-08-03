export interface PilotChecklistItem {
  key: string;
  label: string;
  complete: boolean;
  detail: string;
}

export function derivePilotChecklist(input: {
  activeModuleCount: number;
  companyConfigured: boolean;
  firstActionCount: number;
  memberCount: number | null;
  roleCount: number;
}): PilotChecklistItem[] {
  return [
    { key: 'company', label: 'Configuração básica da empresa', complete: input.companyConfigured, detail: input.companyConfigured ? 'Empresa identificada no tenant.' : 'Complete a identificação da empresa.' },
    { key: 'team', label: 'Convite da equipe', complete: (input.memberCount ?? 0) > 1, detail: input.memberCount === null ? 'Visível apenas para quem administra usuários.' : `${input.memberCount} membro(s) ativo(s).` },
    { key: 'roles', label: 'Funções e permissões', complete: input.roleCount > 0, detail: input.roleCount > 0 ? 'Seu acesso possui função vinculada.' : 'Vincule ao menos uma função.' },
    { key: 'modules', label: 'Módulos contratados ativos', complete: input.activeModuleCount > 0, detail: `${input.activeModuleCount} módulo(s) disponível(is).` },
    { key: 'first_action', label: 'Primeira ação relevante', complete: input.firstActionCount > 0, detail: input.firstActionCount > 0 ? 'O tenant já possui atividade operacional.' : 'Use a primeira ação recomendada de um módulo.' },
  ];
}
