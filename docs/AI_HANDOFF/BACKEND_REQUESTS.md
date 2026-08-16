# Backend Requests

## BR-001

Tela: Admin → Membros → Adicionar pessoa
Problema: o Supabase Auth responde `email rate limit exceeded`; a UI agora informa o bloqueio, mas o e-mail real não pode ser homologado.
Contrato necessário: configurar SMTP transacional próprio no Supabase Auth e validar o redirect `/auth/invite-callback` nos ambientes Preview e produção.
Permissão: configuração administrativa do projeto Supabase.
Bloqueante: SIM
Frontend pronto: SIM

## BR-002

Tela: Integridade → alertas de SLA e tarefas
Problema: o runner local não possui `CRON_SECRET` e a conta Vercel Hobby aceita apenas cron diário.
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
Problema: a homologação externa do Asaas Sandbox permanece indisponível porque `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` não estão disponíveis no ambiente atual; `BILLING_ENABLED` permanece desligado por segurança.
Contrato necessário: cadastrar as credenciais Sandbox diretamente no ambiente seguro da Vercel, validar o webhook `/api/webhooks/asaas` e executar o roteiro de homologação de `docs/ORDUM_08_BILLING_ASAAS.md`.
Permissão: configuração administrativa Vercel/Asaas Sandbox.
Bloqueante: NÃO para o produto financeiro local; SIM apenas para operações externas e homologação Asaas real.
Frontend pronto: SIM

## BR-006

Tela: Administração → Acessos e permissões → Papéis
Problema: as APIs atuais expõem papéis apenas por pessoas que já os utilizam e não oferecem contrato administrativo para criar ou editar papéis personalizados e seus conjuntos de permissões. A interface não pode administrar com segurança um papel ainda sem pessoas vinculadas.
Necessidade: catálogo completo de papéis ativos e gestão transacional de papéis personalizados, preservando papéis de sistema, proteção do último administrador e auditoria.
Contrato desejado: API server-side para listar todos os papéis com suas permissões e quantidade de pessoas, além de criar/editar papéis personalizados de forma atômica; papéis de sistema devem permanecer protegidos. Não conceder override individual de permissão.
Permissão: autorização administrativa de acessos já existente, com decisão final do backend.
Bloqueante: NÃO para administrar pessoas nos papéis existentes; SIM para papéis personalizados e papéis ainda sem pessoas vinculadas.
Frontend pronto: PARCIAL — tabs, apresentação humana e preview estão prontos; criação/edição permanece sem CTA falso.
