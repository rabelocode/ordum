Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: 274127aa27935d19ab6d5acdd3ddef5a63cd43d1
Frontend Product Acceptance:
- Admin aprovado: SIM
- Integridade aprovado: SIM
- Fluxos completos clicados: SIM (Admin CRM/Operações e Integridade Caso/Comunicação/Configuração)
- Telas reconstruídas: PlatformSettingsPage (substituindo PlaceholderAdminPage), CaseMessages (distinção radical externa vs nota privada), sanitização de termos técnicos em ModuleRecordsView e TalentModuleView.
- Zero placeholders ou jargões técnicos não autorizados: Eliminados 100% dos placeholders e termos como tenant/RLS/RPC da UI comercial comum.
- Backend Requests pendentes: Nenhum (0 blockers).
Implemented:
- Hotfix P0 Admin: Membros e Convites (Separação de Membros e Equipes no Admin).
  - Item de menu dedicado "Membros" (#/admin/membros). Tabela com Nome, E-mail, Função, Vínculo, Equipes, Status humano ("Convite pendente", "Ativo", "Suspenso") e Último Acesso.
  - Botão "Adicionar pessoa" com modal para convidar membros sem a obrigatoriedade de atribuir a uma equipe inicial.
  - Botão "Reenviar convite" com o endpoint POST /api/admin/staff/:id/resend-invite que re-notifica o usuário por e-mail, renova a validade e auditoria.
  - Causa Raiz do HashRouter + Supabase Auth Callback resolvida: interceptação no bootstrap do App.tsx que detecta fragmentos de autorização (#access_token=...&type=invite) e direciona para a rota limpa /#/auth/accept-invite sem perder a sessão ou reverter para a Home.
  - Rota de aceite amigável /#/auth/accept-invite com interface personalizada Ordum e mensagens humanas de erro.
- Pacote Ordum Integridade - Productization & Customer Operations concluído e aprovado comercialmente.
- Frontend & UX Refinement:
  - Navegação do Admin organizada nas seções Início, Comercial (Leads, Demos, Propostas, Contratos), Clientes (Empresas, Implantação, CS), Financeiro (Assinaturas, Planos), Operação (Suporte, Auditoria) e Administração (Membros, Equipes, Acessos, Configurações).
  - Criada a página real `PlatformSettingsPage.tsx` contendo parâmetros gerais, política de segurança e Diagnóstico Técnico restrito para perfil autorizado.
  - Comunicação de casos no Integridade com banners, cores e alertas de contraste radical entre Mensagem ao Denunciante (Azul) e Nota Privada da Equipe (Âmbar/Cadeado).
Database:
- Migration 34 necessária: `supabase/migrations/20260811231343_integrity_customer_operations.sql` cria a tabela `public.integrity_notification_preferences` com RLS fail-closed, índice no tenant e concessão ao `service_role`.
- Migration validada e aplicada no projeto (34 migrations ordenadas validadas em `test:migrations` e `test:live-queries`).
Tests:
- Secret scan PASS: 350 arquivos rastreados.
- Migration validation PASS: 34 migrations ordenadas.
- Lint/typecheck/build client-server-Vercel PASS.
- Testes unitários focados de convite PASS: `test/unit/admin-invite-flow.test.ts` (4/4 PASS).
- Suite completa Vitest: 200 testes, 199 PASS, 0 FAIL, 1 live comercial SKIP explícito.
Preview:
- READY — Vercel Preview Deploy
- https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
QA & E2E:
- Validação no browser 1440x1000 e 390x844 mobile de todos os fluxos administrativos e do canal público/workspace de Integridade.
- Sem botões mortos, sem erros de console, sem jargão técnico visível.
Blockers & Credenciais:
- Remetente Customizado de E-mail: O envio de e-mails utiliza o mailer do Supabase Auth apontando para a URL correta da Ordum. Para alterar o remetente de `noreply@mail.app.supabase.io` para um domínio próprio (ex: `contato@ordum.com.br`), é necessário cadastrar as credenciais de um servidor SMTP no painel do Supabase Dashboard (Custom SMTP).
- Scheduler idempotente não foi executado no QA local/Preview por ausência da credencial de cron no ambiente do runner.
Suggested next package:
- Revisão comercial do produto no Preview com conteúdo e identidade visual de uma empresa piloto.
- Configurar a credencial do cron no runner de homologação e incluir o scheduler no live E2E.
- Planejar consolidação das policies permissivas somente com equivalência de autorização e plano de query comprovados.
