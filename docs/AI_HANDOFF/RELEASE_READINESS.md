# Release Readiness — Admin + Integridade

## Core Product

- Admin — **FROZEN**.
- Ordum Integridade — **FROZEN**.
- Mudanças permitidas após este gate: infraestrutura, observabilidade, segurança, integração externa ou correção de bug comprovado.

## External Infrastructure

### SMTP

Status: **WAITING FOR SMTP CREDENTIALS**.

Required values, cadastrados diretamente em **Supabase → Authentication → SMTP Settings**:

- host SMTP;
- porta;
- usuário;
- senha;
- endereço remetente em domínio validado;
- nome remetente `ORDUM.`.

Validated:

- callback `/auth/invite-callback` → `/#/auth/accept-invite`;
- convite, confirmação, ativação, refresh e novo login;
- erro de limite de envio apresentado em linguagem humana;
- nenhuma credencial SMTP é usada no frontend ou no Git.

Blocker: credenciais de um provedor SMTP transacional e domínio remetente validado. Após a entrega real ser comprovada, definir no ambiente server-side `AUTH_SMTP_CONFIGURED=true` e `AUTH_SMTP_VALIDATED=true`; esses marcadores só alimentam a Saúde do sistema e não contêm credenciais.

Redirects exatos a autorizar no Supabase Auth, sem wildcard amplo:

- Preview estável: `https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app/auth/invite-callback`;
- produção futura: `https://DOMINIO_FINAL/auth/invite-callback` após definição formal do domínio;
- `Site URL`: domínio final exato de produção.

Assunto do template de convite:

```text
Você foi convidado para acessar a Ordum
```

Template base para **Invite user** no Supabase Auth:

```html
<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#202322">
  <p style="font-weight:700;letter-spacing:.08em">ORDUM.</p>
  <h1 style="font-size:24px">Você foi convidado para acessar a Ordum.</h1>
  <p>Use o botão abaixo para configurar seu acesso com segurança.</p>
  <p style="margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#202322;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Acessar minha conta</a>
  </p>
  <p style="font-size:13px;color:#626866">Se você não esperava este convite, ignore esta mensagem.</p>
</div>
```

Referências: [SMTP customizado](https://supabase.com/docs/guides/auth/auth-smtp), [templates de e-mail](https://supabase.com/docs/guides/auth/auth-email-templates) e [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

### Cron

Status: **WAITING FOR INFRASTRUCTURE** para alertas intradiários; execução diária permanece configurada.

Required values:

- `CRON_SECRET` forte, server-side e sensível na Vercel;
- plano/infraestrutura que aceite a frequência operacional escolhida.

Validated:

- `GET /api/internal/integrity/run` sem credencial = `401`;
- credencial incorreta = `401`;
- comparação em tempo constante e nenhuma variável `VITE_*`;
- persistência/idempotência por janela de 15 minutos e `dedupe_key` cobertas por testes;
- `CRON_SECRET` está cadastrado como Sensitive na Vercel, mas o valor não é recuperável pelo runner atual; por isso a execução autenticada real não foi declarada como homologada.

Frequência atual em `vercel.json`:

- conciliação financeira: diária, `06:17 UTC`;
- automação do Integridade: diária, `06:47 UTC`.

Frequência recomendada após infraestrutura compatível: Integridade a cada 15 minutos e conciliação financeira a cada hora. Não alterar os schedules antes da mudança de plano/infraestrutura e da validação autenticada.

Referência: [limites e precisão do Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing).

### Asaas Sandbox

Status: **WAITING FOR ASAAS SANDBOX CREDENTIALS**.

Required values no ambiente server-side da Vercel:

- `ASAAS_API_KEY` de Sandbox (`$aact_hmlg_...`);
- `ASAAS_WEBHOOK_TOKEN` aleatório, com 32–255 caracteres;
- `ASAAS_ENV=sandbox`;
- `ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3`;
- `ASAAS_WEBHOOK_URL=https://.../api/webhooks/asaas`;
- `ASAAS_USER_AGENT=Ordum`;
- `APP_URL` HTTPS;
- `BILLING_ENABLED=false` até o preflight e webhook estarem homologados.

Validated:

- produção é recusada pelo código;
- configuração incompleta permanece fail-closed;
- domínio, webhook duplicado/fora de ordem, assinatura, conciliação e estados financeiros possuem cobertura determinística;
- o setup do webhook aceita somente chave Sandbox, valida token/URL/resposta e confirma a configuração salva;
- Vercel Preview possui o contrato de ambiente, porém `ASAAS_API_KEY` não está cadastrado; nenhuma chamada externa foi simulada como sucesso.

Blocker: chave de API e token de webhook do Asaas Sandbox cadastrados diretamente no ambiente seguro. O roteiro real está em `docs/ORDUM_08_BILLING_ASAAS.md`.

## Environment Classification

Required for core:

- `SUPABASE_URL`;
- `SUPABASE_SECRET_KEY`.

Optional external integration:

- `AUTH_SMTP_CONFIGURED` e `AUTH_SMTP_VALIDATED`;
- `CRON_SECRET`;
- `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_WEBHOOK_URL`.

Production only / activation-controlled:

- `APP_URL` com domínio HTTPS final;
- billing de produção permanece bloqueado por código e depende de autorização explícita.

Ausência de integração opcional não derruba o core. A Saúde do sistema apresenta `Operacional`, `Configuração pendente` ou `Indisponível`, sem retornar valores secretos.

## Migration History

Status: **WAITING FOR SUPABASE CLI ACCESS**.

O remoto e o Git possuem 39 migrations, mas o histórico ainda contém aliases de timestamp e uma migration local sem registro remoto. Em especial, `20260806230000_backfill_commercial_items` permanece fora do histórico oficial, conforme já registrado em `docs/walkthrough.md`. O CLI recusou o link por ausência de `SUPABASE_ACCESS_TOKEN`.

Não foi executado DDL duplicado, `db push --include-all`, inserção manual em `supabase_migrations.schema_migrations` nem `migration repair` sem autenticação. A reconciliação deve usar somente `supabase migration list` e `supabase migration repair` após acesso oficial ao projeto e comparação dos aliases históricos.

## Production Activation

- [ ] SMTP customizado configurado no Supabase.
- [ ] Domínio remetente verificado e entrega real do convite homologada.
- [ ] Template Ordum de convite publicado.
- [ ] `Site URL` e redirects Auth exatos validados para produção.
- [ ] Asaas Sandbox homologado ponta a ponta.
- [ ] `BILLING_ENABLED` de produção continua `false`.
- [ ] `CRON_SECRET` forte disponível ao runner autorizado.
- [ ] Frequência de cron compatível com o plano/infraestrutura.
- [ ] Segredos cadastrados como Sensitive e somente server-side.
- [ ] Histórico de migrations sincronizado pelo mecanismo oficial; pendência detalhada acima.
- [ ] Preview aprovado e smoke sem 5xx.
- [ ] Backup e procedimento de rollback definidos antes do primeiro deploy produtivo.
- [ ] Sentry/PostHog e logs sanitizados ativos conforme consentimento/configuração.
- [ ] Domínio final, `APP_URL`, webhook e URLs públicas revisados.
- [ ] Produção do Asaas ativada somente após autorização explícita e mudança de código revisada.

## Rollback

- Aplicação: promover somente artefato Preview homologado; rollback pela Vercel para o deployment anterior.
- Banco: migrations apenas aditivas; qualquer reversão de dados exige procedimento específico e backup verificado.
- Integrações: manter `BILLING_ENABLED=false` e marcadores SMTP não validados em caso de falha externa.
