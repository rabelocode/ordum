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
Problema: a migration local `20260811231343_integrity_customer_operations` não consta no histórico remoto e a tabela `integrity_notification_preferences` não existe no banco em 14/08/2026.
Contrato necessário: reconciliar oficialmente essa migration pelo fluxo do Supabase, sem inserção manual no histórico e sem reaplicar os dois patches do protocolo.
Permissão: backend/Supabase da Ordum.
Bloqueante: NÃO
Frontend pronto: SIM
