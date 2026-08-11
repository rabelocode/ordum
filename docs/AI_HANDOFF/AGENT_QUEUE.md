Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: ce2c6fb692a5aa3495089aa4b971868874f1e45c
Implemented:
- First-run do Admin para instalação sem equipe: criar a primeira equipe, adicionar responsáveis, definir gerente e iniciar a operação pela interface.
- Equipes comerciais administráveis com indicadores de carteira, desativação segura com equipe de destino, membros internos completos e linguagem humana.
- Gestão de membros responsiva: desktop em tabela e mobile em cards; papéis e vínculos traduzidos.
- Caixa de leads sem responsável, seleção em lote e distribuição auditada por equipe/responsável.
- Dashboard com ações diretas para operação não configurada, leads sem responsável, demos do dia, aprovações, contratos prontos e implantações atrasadas.
- Lead preserva equipe/responsável ao virar demonstração e proposta; proposta herda o contexto comercial.
- Governança de dupla aprovação comprovada com criador e segunda pessoa aprovadora.
- Visões de propostas corrigidas para rascunho, aprovação, minha aprovação, pronta para envio, enviada, aceita e recusada, com contagens coerentes.
- Feedback de propostas só confirma sucesso após o registro atualizado estar visível.
- Contrato herda proposta aceita, registra formalização externa real e ativa cliente em trial explícito sem simular cobrança.
- Cliente ativado recebe Ordum Integridade, onboarding e CTA operacional para continuar a implantação.
Database:
- Migration 20260811195021_safe_commercial_team_deactivation.sql aplicada oficialmente.
- Função de desativação transfere trabalho ativo e não permite deixar operação órfã.
- Nenhum dado real apagado; billing de produção permaneceu desativado.
Tests:
- Secret scan PASS: 344 arquivos rastreados.
- Migration validation PASS: 33 migrations ordenadas.
- Lint PASS; typecheck PASS; build client/server/Vercel PASS.
- Suite completa: 194 testes, 193 PASS, 0 FAIL, 1 live comercial SKIP explícito.
- Browser E2E descartável PASS no run ui-msp51ny7.
Preview:
- READY — dpl_7yLuwNn3Qiai4kxYeuGXpksyBmGX
- https://ordum-gqfahckmq-ordum.vercel.app
- Alias: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
QA:
- Fluxo clicado pela interface: login Admin sem equipe → criar equipe → adicionar gerente e aprovador → criar plano trial com Integridade → criar e atribuir lead → registrar contato → agendar demo → registrar resultado → criar proposta → segunda pessoa aprovar → registrar envio → registrar aceite → gerar contrato → segunda pessoa aprovar contrato → registrar assinatura externa → ativar cliente → abrir implantação.
- A API/service role foi usada somente para criar os dois usuários descartáveis e executar cleanup.
- Desktop 1440x1000 e mobile 390x844 validados; equipes, cliente e implantação não exigem tabela horizontal.
- Screenshots finais: tmp/qa-package3/ui-msp51ny7/01-first-run.png, 02-team-ready.png, 02b-team-mobile.png, 03-lead-created.png, 04-proposal-awaiting-approval.png, 05-proposal-approved.png, 06-client-activated.png, 07-client-mobile.png e 08-onboarding-mobile.png.
- Vercel: nenhum log de nível error/5xx encontrado no deployment final.
- Cleanup comprovado: Auth E2E 0; platform_members E2E 0; equipes E2E 0; leads E2E 0; planos E2E 0.
- Supabase Advisors revisados: 13 WARN de segurança e 31 WARN de performance já conhecidos; nenhum alerta foi introduzido pelas alterações de UI. Referência: https://supabase.com/docs/guides/database/database-linter
Blockers:
- Asaas permanece Sandbox-only, desabilitado e fail-closed até o responsável fornecer credenciais válidas futuramente. Nenhuma cobrança foi simulada ou executada.
Suggested next package:
- Revisão comercial do fluxo no Preview com nomes/papéis reais da equipe Ordum.
- Cadastrar credenciais Asaas Sandbox quando disponíveis e executar a homologação de billing já preparada.
