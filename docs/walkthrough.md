# Walkthrough: Pacote Final Admin Comercial & Billing Sandbox

## 📋 Resumo da Implementação

Implementamos na branch `fix/admin-functional-recovery` o pacote completo de Billing Sandbox no ambiente Preview, validações fiscais de CPF/CNPJ, tratamento de erros resiliente, diagnósticos seguros e backfill idempotente de itens comerciais.

---

## 🛠️ Alterações Realizadas

### 1. Billing Sandbox & Isolação de Ambiente
- **[config.ts](file:///c:/Users/Vivobook/Desktop/ordum/src/server/billing/config.ts)**:
  - Adicionada a propriedade `sandboxMockAvailable` na saúde pública do Billing (`publicBillingHealth`).
  - Restrição para garantir que o Sandbox Mock só esteja disponível quando `ASAAS_ENV=sandbox` e em ambientes `development` ou Vercel `preview`.
- **[router.ts](file:///c:/Users/Vivobook/Desktop/ordum/src/server/billing/router.ts)**:
  - **`validateSandboxEnv`**: Atualizado para ler explicitamente `VERCEL_ENV` e bloquear categoricamente a produção (`VERCEL_ENV=production` ou `NODE_ENV=production`).
  - **Endpoint Diagnóstico (`GET /api/admin/billing/diagnostics`)**: Criado endpoint protegido com permissão `platform.billing.manage` que retorna apenas atributos não-sensíveis (`enabled`, `configured`, `environment`, `webhookUrlConfigured`, `sandboxMockAvailable`).

### 2. Tratamento Resiliente do `start-billing` (`POST /api/admin/commercial/contracts/:id/start-billing`)
- **Status HTTP Específicos**:
  - `404`: Contrato inexistente.
  - `409`: Contrato em status inválido (exige `approved`).
  - `422`: CPF/CNPJ ausente/inválido ou contrato sem itens comerciais.
  - `503`: Credenciais Asaas ausentes ou indisponibilidade de rede local (`BILLING_ENABLED=false` ou chave ausente).
  - `502`: Rejeição do provedor Asaas (erros da API remota).
  - `500`: Falha de consistência interna ou erro no `admin_transition_control_plane`.
- **Idempotência**:
  - Verifica a existência prévia de assinatura local em `billing_subscriptions` e remota no Asaas por `external_reference`. Se a assinatura já existir, reexecuta a transição auditada se necessário e retorna HTTP 200 sem duplicar a cobrança.

### 3. Validação e Gestão de Dados Fiscais (CPF / CNPJ)
- **[cpf-cnpj.ts](file:///c:/Users/Vivobook/Desktop/ordum/src/domain/cpf-cnpj.ts)**:
  - Criado módulo independente com validação por módulo 11 de dígitos verificadores para CPF (11 dígitos) e CNPJ (14 dígitos).
  - Rejeição de sequências numéricas repetidas (ex.: `111.111.111-11`).
  - Funções de normalização de dígitos e mascaramento para auditoria (`maskTaxId`), garantindo privacidade (nunca exibe CPF/CNPJ completo nos logs de auditoria).
- **Endpoint Fiscal (`PATCH /api/admin/commercial/contracts/:id/fiscal`)**:
  - Permite edição dos dados fiscais do contrato nos status `pending_approval` ou `approved`.
  - Bloqueia alteração se o contrato já possui integração financeira iniciada (`409`).
  - Registra log em `platform_audit_logs` com dados mascarados.

### 4. Interface Admin (`ContractsPage.tsx`)
- **[ContractsPage.tsx](file:///c:/Users/Vivobook/Desktop/ordum/src/pages/admin/ContractsPage.tsx)**:
  - Adicionado **Modal de Edição de Dados Fiscais** diretamente na listagem.
  - Exibição de alerta visual (`AlertTriangle`) e CPF/CNPJ mascarado (`maskTaxId`).
  - Bloqueio dos botões "Aprovar" e "Iniciar Sandbox" quando o contrato estiver sem CPF/CNPJ válido.
  - O botão "Simular pagamento Sandbox" é exibido somente se `sandboxMockAvailable=true` e o usuário possuir a permissão `platform.billing.webhooks.manage`.

### 5. Migration Idempotente de Backfill de Itens
- **[20260806230000_backfill_commercial_items.sql](file:///c:/Users/Vivobook/Desktop/ordum/supabase/migrations/20260806230000_backfill_commercial_items.sql)**:
  - Migration SQL idempotente utilizando `WHERE NOT EXISTS` e `ON CONFLICT DO NOTHING`.
  - Copia soluções do plano para propostas sem itens com `unit_amount_cents = 0` (preservando o valor total em `amount_cents`).
  - Copia itens da proposta para contratos sem itens.

---

## 🧪 Resultados de Verificação e Testes

### 1. Testes Unitários e de Integração Locais
- **104 testes executados com SUCESSO ZERO FALHAS** (incluindo validações do `validateSandboxEnv`, módulo `cpf-cnpj`, middlewares de platform/tenant e ciclo comercial).

### 2. Deploy no Vercel Preview
- **Branch**: `fix/admin-functional-recovery`
- **Preview Deployment**: [https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app](https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app)
- **Status**: **● Ready**
