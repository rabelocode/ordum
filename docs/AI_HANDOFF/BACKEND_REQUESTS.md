# Backend Requests

## BR-001

Tela: Admin → Membros → Adicionar pessoa
Status: WAITING FOR SMTP CREDENTIALS.
Problema: o Supabase Auth padrão responde `email rate limit exceeded`; a UI informa o bloqueio, mas a entrega real não pode ser homologada.
Contrato necessário: configurar SMTP transacional próprio no Supabase Auth e validar o redirect `/auth/invite-callback` nos ambientes Preview e produção.
Permissão: configuração administrativa do projeto Supabase.
Bloqueante: SIM
Frontend pronto: SIM

## BR-002

Tela: Integridade → alertas de SLA e tarefas
Status: WAITING FOR INFRASTRUCTURE.
Problema: `CRON_SECRET` está cadastrado como Sensitive na Vercel, mas não pode ser recuperado pelo runner atual; a frequência implantada permanece diária e a última execução persistida ocorreu em 11/08/2026.
Contrato necessário: disponibilizar a credencial do runner e definir infraestrutura/plano para alertas intradiários; até lá o job permanece diário e fail-closed.
Permissão: configuração Vercel/ambiente.
Bloqueante: NÃO
Frontend pronto: SIM

## BR-003

Tela: Integridade → Casos e acompanhamento público
Problema: RESOLVIDO em 14/08/2026.
Contrato necessário: migrations `20260814175625_integrity_human_protocol` e `20260814175716_integrity_human_protocol_random_source_fix`; novos protocolos usam `INT-AAAA-000000`, fonte criptográfica não sequencial, retry limitado e ano `America/Sao_Paulo`. Protocolos `ORD-*`, protocolo + código de acesso e bcrypt foram preservados.
Permissão: backend do Ordum Integridade.
Bloqueante: NÃO
Frontend pronto: SIM

Evidência: RC smoke `integrity_e2e_1786732034217_731021a1` validou geração pelo browser, sincronização report/case, tracking novo e legacy, busca, investigação e exportações; cleanup zerou tenants e usuários Auth.

## BR-004

Tela: Integridade → Preferências de notificações
Problema: RESOLVIDO em 14/08/2026.
Contrato necessário: a DDL local ausente foi aplicada pelo conector oficial do Supabase como `20260814191358_integrity_customer_operations`; o arquivo local foi alinhado ao timestamp remoto, sem inserção manual no histórico e sem reaplicar patches anteriores.
Permissão: backend/Supabase da Ordum.
Bloqueante: NÃO
Frontend pronto: SIM

Evidência: `integrity_notification_preferences` existe com RLS habilitado; `PUBLIC`, `anon` e `authenticated` não possuem acesso direto; `service_role` possui o CRUD necessário para a API server-side. O Advisor registra apenas o INFO esperado de tabela server-only sem policy pública.

## BR-005

Tela: Administração → Saúde do sistema → Integração financeira
Status: WAITING FOR ASAAS SANDBOX CREDENTIALS.
Problema: a homologação externa permanece indisponível porque `ASAAS_API_KEY` não está cadastrada; o token existente não é recuperável pelo runner e `BILLING_ENABLED` permanece fail-closed.
Contrato necessário: cadastrar as credenciais Sandbox diretamente no ambiente seguro da Vercel, validar o webhook `/api/webhooks/asaas` e executar o roteiro de homologação de `docs/ORDUM_08_BILLING_ASAAS.md`.
Permissão: configuração administrativa Vercel/Asaas Sandbox.
Bloqueante: NÃO para o produto financeiro local; SIM apenas para operações externas e homologação Asaas real.
Frontend pronto: SIM

## BR-006

Tela: Administração → Acessos e permissões → Papéis
Problema: RESOLVIDO em 16/08/2026.
Necessidade: catálogo completo e gestão atômica de papéis personalizados entregues, sem override individual e com papéis de sistema protegidos.
Contrato desejado: `platform_role_catalog` e `manage_platform_custom_role` consumidos somente pela API server-side autenticada.
Permissão: autorização administrativa de acessos já existente, com decisão final do backend.
Bloqueante: NÃO
Frontend pronto: SIM

Evidência: runner `custom-role-msw4atdk-152e74` validou catálogo completo, papel personalizado com zero pessoas, criação, edição com impacto, atribuição, login e menu reais, deep-link negado, auditoria humana, papéis de sistema protegidos e cleanup zerado.

## BR-007

Tela: Administração → Acessos e permissões → Papéis
Problema: RESOLVIDO em 16/08/2026 pela migration `20260816170658_grant_service_role_app_private_usage`.
Necessidade: grant mínimo do contrato invoker aplicado sem ampliar a superfície do browser.
Contrato desejado: `service_role` executa as duas wrappers e possui `USAGE` em `app_private`; `PUBLIC`, `anon` e `authenticated` permanecem sem `USAGE` e sem `EXECUTE` nas wrappers.
Permissão: backend/Supabase da Ordum.
Bloqueante: NÃO
Frontend pronto: SIM

Evidência: grants remotos confirmados (`service_role=true`; `PUBLIC/anon/authenticated=false`), GET autenticado `/api/admin/access/roles` = 200 e negativos de criação/edição sem `platform.staff.manage` = 403.

## BR-008

Tela: Release Readiness → histórico de migrations
Status: WAITING FOR SUPABASE CLI ACCESS.
Problema: Git e remoto possuem 39 entradas, porém timestamps históricos divergem e `20260806230000_backfill_commercial_items` não consta no histórico remoto oficial.
Contrato necessário: autenticar o Supabase CLI no projeto, comparar os aliases históricos e usar exclusivamente `supabase migration repair` para reconciliar versões equivalentes; não executar DDL duplicado nem inserir manualmente na tabela de migrations.
Permissão: acesso administrativo do Supabase CLI ao projeto `ordum-production`.
Bloqueante: SIM para o checklist de ativação produtiva; NÃO para o produto congelado em Preview.
Frontend pronto: SIM
