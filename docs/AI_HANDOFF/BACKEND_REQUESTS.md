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
