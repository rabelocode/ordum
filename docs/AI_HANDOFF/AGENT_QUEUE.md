Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: pending_commit
Implemented:
- Hotfix P0 Admin: Membros e Convites (Separação de Membros e Equipes no Admin).
  - Item de menu dedicado "Membros" (#/admin/membros). Tabela com Nome, E-mail, Função, Vínculo, Equipes, Status humano ("Convite pendente", "Ativo", "Suspenso") e Último Acesso.
  - Botão "Adicionar pessoa" com modal para convidar membros sem a obrigatoriedade de atribuir a uma equipe inicial.
  - Botão "Reenviar convite" com o endpoint POST /api/admin/staff/:id/resend-invite que re-notifica o usuário por e-mail, renova a validade e auditoria.
  - Correção da causa raiz do link de convite do Supabase Auth no HashRouter (evitando queda silenciosa na Home) e parser resiliente em App.tsx.
  - Rota de aceite amigável /#/auth/accept-invite com interface personalizada Ordum e mensagens humanas de erro (Convite expirado, cancelado ou já utilizado).
- Pacote Ordum Integridade - Productization & Customer Operations concluído integralmente.
- Gestão de Equipe de Integridade: convidar pessoas (nome, e-mail, função), reenviar convites, cancelar convite pendente, alterar papel/status, suspender, reativar, remover acesso com preservação de histórico. Papéis amigáveis (Administrador, Compliance, Investigador, Membro de Comitê) sem exibir keys internas. Proteção contra modificação/suspensão/remoção do último admin.
- Aceite de Convite: rota pública /#/auth/accept-invite exibindo organização, papel e convidador, com conclusão de cadastro e redirecionamento direto sem intervenção manual no banco.
- Wizard de First-Run em 6 Etapas: progresso derivado do estado real do produto (Organização, Equipe, Categorias, Prazos, Personalização, Revisão e Publicação).
- Kit do Canal (IntegrityChannelKit): exibição de link público comercial, QR Code baixável em PNG, previsualização interativa desktop/mobile, textos para comunicação interna/intranet/e-mail.
- Personalização do Canal & Slug: nome exibido, logotipo HTTPS, cor principal com validação de contraste WCAG, textos institucionais, avisos de privacidade e slug personalizado seguro.
- Preferências de Notificação: gestão de notificações no sistema e por e-mail por assunto (casos, mensagens, tarefas, SLA) sem expor dados sensíveis do relato no assunto.
- Auditoria do Cliente & Governança: log de atividades operacionais amigável ("Mariana convidou Carlos..."), estatísticas e governança de acessos por membership.
Database:
- Nenhuma migration ou DDL necessária neste pacote.
- RLS, Storage privado, signed URLs, rate limit persistente e aggregate-only preservados e exercitados no E2E.
Tests:
- Secret scan PASS: 344 arquivos rastreados.
- Migration validation PASS: 33 migrations ordenadas.
- Lint/typecheck/build client-server-Vercel PASS.
- Suite completa: 196 testes, 195 PASS, 0 FAIL, 1 live comercial SKIP explícito.
- Live Integridade E2E Preview PASS: run integrity_e2e_1786488725315_f74537ae.
Preview:
- READY — dpl_AXDr9723Bp83k6JGoTh6Kfh4q9e9
- https://ordum-gi9nv51rr-ordum.vercel.app
- Alias: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
QA:
- Fluxo clicado no browser: publicar canal configurado → enviar relato anônimo pelo wizard → receber protocolo/segredo → acompanhar mobile → complementar informações → compliance abrir caso → triagem → investigação → tarefa → mensagem externa com confirmação → nota privada → evidência → decisão → encerramento → reabertura.
- Papéis validados: tenant_admin, compliance, investigador atribuído mobile, investigador não atribuído, usuário sem permissão, tenant cruzado e Admin Global aggregate-only.
- Fronteiras comprovadas: nota interna ausente do portal público; identidade protegida; Admin Global sem dossiê/conteúdo; Storage cross-tenant bloqueado; rate limit no intento 21.
- Desktop 1440x1000 e mobile 390x844 sem overflow no canal, acompanhamento, caixa e detalhe.
- Screenshots: tmp/product-recovery/public-report-receipt-mobile.png, public-tracking-mobile.png, investigator_assigned_mobile-case-detail.png, integrity-complete-ui-flow.png, tenant_admin_desktop-settings.png e admin-company-products.png.
- Cleanup PASS: residualTenants 0; residualAuth 0; Storage descartável removido.
- Vercel: 0 runtime errors e 0 logs 5xx no deployment final.
- Supabase Advisors: 13 WARN de segurança e 31 WARN de performance já conhecidos; tabelas server-only sem policy aparecem como INFO e policies permissivas sobrepostas permanecem como dívida de performance, sem ampliação de acesso neste pacote. Referência: https://supabase.com/docs/guides/database/database-linter
Blockers:
- Scheduler idempotente não foi executado no QA local/Preview por ausência da credencial de cron no ambiente do runner; o restante do fluxo não depende dele.
- Asaas permanece Sandbox-only/fail-closed até credenciais futuras; não foi alterado neste pacote.
Suggested next package:
- Revisão comercial do produto no Preview com conteúdo e identidade visual de uma empresa piloto.
- Configurar a credencial do cron no runner de homologação e incluir o scheduler no live E2E.
- Planejar consolidação das policies permissivas somente com equivalência de autorização e plano de query comprovados.
