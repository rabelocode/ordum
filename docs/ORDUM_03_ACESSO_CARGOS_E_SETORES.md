# Acesso, Cargos e Setores

O controle de acesso é baseado no princípio de menor privilégio. A regra de ouro na plataforma é:
`permissão efetiva = solução contratada + papel + escopo organizacional + política específica`

Ter um cargo alto (ex: CEO, Diretor, Sócio) **NÃO** concede acesso sensível automaticamente (especialmente a denúncias do Ordum Integridade).

## Papéis da própria Ordum (Administração Interna)
- `ORDUM_SUPER_ADMIN`
- `ORDUM_SALES`
- `ORDUM_SUPPORT`
- `ORDUM_AUDITOR`

## Papéis Base do Tenant
- `TENANT_OWNER`, `TENANT_ADMIN`
- `EXECUTIVE` (CEOs, Diretores)
- `AREA_MANAGER` (Gestores)
- `EMPLOYEE`, `APPRENTICE`, `INTERN`
- `CUSTOM_ROLE`

## Ordum Pessoas
- **Papéis:** `PEOPLE_EMPLOYEE`, `PEOPLE_MANAGER`, `PEOPLE_HR`, `PEOPLE_PAYROLL`, `PEOPLE_ADMIN`
- **Permissões Mínimas:** `people.payslip.view_own`, `people.payslip.manage`, `people.communication.view`, `people.communication.manage`, `people.document.view_own`, `people.document.manage`, `people.request.create`, `people.request.view_own`, `people.request.manage_team`, `people.request.manage`, `people.hr_meeting.request`, `people.hr_meeting.manage`.

## Ordum Integridade
Acesso estrito aos casos para evitar conflitos de interesse.
- **Papéis:** `INTEGRITY_TRIAGE`, `INTEGRITY_INVESTIGATOR`, `INTEGRITY_COMMITTEE`, `INTEGRITY_AUDITOR`, `INTEGRITY_ADMIN`
- **Permissões Mínimas:** `integrity.report.submit_public`, `integrity.report.follow_public`, `integrity.case.triage`, `integrity.case.view_assigned`, `integrity.case.investigate`, `integrity.case.assign`, `integrity.case.close`, `integrity.indicator.view`, `integrity.audit.view`.

## Ordum Talentos
Candidatos não são `memberships` do workspace, usam rotas públicas.
- **Papéis:** `TALENT_RECRUITER`, `TALENT_HIRING_MANAGER`, `TALENT_INTERVIEWER`, `TALENT_ADMIN`
- **Permissões Mínimas:** `talent.job.create`, `talent.job.publish`, `talent.application.view`, `talent.application.move_stage`, `talent.assessment.manage`, `talent.interview.manage`, `talent.feedback.submit`, `talent.pool.manage`.

## Destino Pós-Login
Não existe uma tela de transição genérica com os 3 cards. O `LandingResolver` decide o destino nesta ordem:
1. Convite ou tarefa pendente autorizada.
2. Preferência válida e configurada do usuário.
3. Destino padrão do papel principal:
   - Aprendiz/Colaborador -> Ordum Pessoas (Portal do Colaborador).
   - Gestor -> Ordum Pessoas (Visão de equipe/Pendências).
   - RH/DP -> Ordum Pessoas (Operação).
   - Recrutador -> Ordum Talentos.
   - Compliance/Comitê -> Ordum Integridade.
   - CEO/Diretor -> Dashboard executivo apenas com indicadores autorizados.
   - Candidato -> Portal público de carreiras (não acessa workspace).
   - Denunciante -> Rota pública de protocolo (não faz login).
4. Em caso de múltiplos papéis equivalentes (ex: Diretor de RH e Recrutador), apresenta-se uma HOME customizada para navegação.
