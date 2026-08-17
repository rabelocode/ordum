# Walkthrough: Pacote Final Admin Comercial & Billing Sandbox

## Fase 4 — Ordum Integridade Core (2026-08-09)

- Banco remoto atualizado pelas migrations oficiais `20260809132523_integrity_core_phase4` e `20260809133226_integrity_atomic_case_transition`.
- O relato original permanece separado do caso operacional; identidade identificada fica em tabela protegida e o segredo de acompanhamento é armazenado somente como hash bcrypt.
- O canal `/#/canal/:slug` aceita envio sem login e acompanhamento por protocolo + segredo, retornando apenas mensagens públicas.
- O workspace possui cockpit real, caixa paginada, filtros, detalhe, timeline, notas internas, mensagens ao denunciante, atribuição com bloqueio de conflito e transições auditadas com optimistic locking.
- O Admin da Ordum recebe apenas métricas agregadas e estado da solução; o endpoint não entrega descrição, mensagens, identidade ou evidências.
- Validação transacional remota com rollback comprovou criação de Report + Case, segredo não plaintext, rejeição de credenciais inválidas e exclusão de nota interna da projeção pública.
- Verificação: secret scan, migrations, lint, typecheck, 119 testes (118 aprovados e 1 E2E comercial live ignorado por configuração), build e live queries aprovados.
- Preview da branch validado em desktop/mobile: conteúdo renderizado, sem tela branca, overlay, erro de console, overflow horizontal ou log 5xx; rotas protegidas rejeitam acesso sem token com HTTP 401.
- Ainda não concluídos: Storage privado/anexos, rate limiting persistente, configuração avançada de comitê/roteamento, tarefas/decisão completas e E2E visual autenticado.

## 📋 Resumo da Implementação

Implementamos na branch `fix/admin-functional-recovery` o pacote completo de Billing Sandbox no ambiente Preview, validações fiscais de CPF/CNPJ, tratamento de erros resiliente, diagnósticos seguros e backfill idempotente de itens comerciais.

---

## 🛠️ Alterações Realizadas

### 1. Billing Sandbox & Isolação de Ambiente
- **src/server/billing/config.ts**:
  - Adicionada a propriedade `sandboxMockAvailable` na saúde pública do Billing (`publicBillingHealth`).
  - Restrição para garantir que o Sandbox Mock só esteja disponível quando `ASAAS_ENV=sandbox` e em ambientes `development` ou Vercel `preview`.
- **src/server/billing/router.ts**:
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
- **src/domain/cpf-cnpj.ts**:
  - Criado módulo independente com validação por módulo 11 de dígitos verificadores para CPF (11 dígitos) e CNPJ (14 dígitos).
  - Rejeição de sequências numéricas repetidas (ex.: `111.111.111-11`).
  - Funções de normalização de dígitos e mascaramento para auditoria (`maskTaxId`), garantindo privacidade (nunca exibe CPF/CNPJ completo nos logs de auditoria).
- **Endpoint Fiscal (`PATCH /api/admin/commercial/contracts/:id/fiscal`)**:
  - Permite edição dos dados fiscais do contrato nos status `pending_approval` ou `approved`.
  - Bloqueia alteração se o contrato já possui integração financeira iniciada (`409`).
  - Registra log em `platform_audit_logs` com dados mascarados.

### 4. Interface Admin (`ContractsPage.tsx`)
- **src/pages/admin/ContractsPage.tsx**:
  - Adicionado **Modal de Edição de Dados Fiscais** diretamente na listagem.
  - Exibição de alerta visual (`AlertTriangle`) e CPF/CNPJ mascarado (`maskTaxId`).
  - Bloqueio dos botões "Aprovar" e "Iniciar Sandbox" quando o contrato estiver sem CPF/CNPJ válido.
  - O botão "Simular pagamento Sandbox" é exibido somente se `sandboxMockAvailable=true` e o usuário possuir a permissão `platform.billing.webhooks.manage`.

### 5. Migration Idempotente de Backfill de Itens
- **supabase/migrations/20260806230000_backfill_commercial_items.sql**:
  - Migration SQL idempotente utilizando `WHERE NOT EXISTS` e `ON CONFLICT DO NOTHING`.
  - Copia soluções do plano para propostas sem itens com `unit_amount_cents = 0` (preservando o valor total em `amount_cents`).
  - Copia itens da proposta para contratos sem itens.

---

## 🧪 Resultados de Verificação e Testes

### 1. Testes Unitários e de Integração Locais
- **104 testes executados com SUCESSO ZERO FALHAS** (`npm run typecheck && npm run test`).

### 2. Deploy no Vercel Preview
- **Branch**: `fix/admin-functional-recovery`
- **Preview Deployment validado**: `dpl_HnEGSnZgVFLSneVhCxj7ijrfnqVC` — https://ordum-rm1hztbhp-ordum.vercel.app
- **Status**: **● Ready**

### 3. Fechamento E2E em 2026-08-09
- O preflight autenticado ocorre antes de qualquer fixture e falha de forma explícita quando uma variável obrigatória não existe.
- O cleanup valida erros do Supabase, respeita integridade referencial, confirma remoção no Asaas e verifica resíduos por IDs e `runId`.
- Scripts de expurgo não removem mais `platform_members` suspensos globalmente; somente fixtures com domínio, padrão e metadata E2E concordantes são elegíveis.
- Resíduos comprovados: Auth E2E `0`; platform_members E2E `0`; platform_members E2E ativos `0`.
- Preview: raiz HTTP `200`, diagnóstico sem autenticação HTTP `401`, logs `5xx` do deployment `0`.
- O ciclo live não foi registrado como concluído: faltam `E2E_OPERATOR_EMAIL`, `E2E_OPERATOR_PASSWORD` e `ASAAS_API_KEY` Sandbox no ambiente controlado.
- Em 17/08/2026, a migration `20260806230000` foi reconciliada no histórico remoto pelo `supabase migration repair` oficial após a consulta idempotente retornar zero pendências; nenhum DDL ou insert manual no histórico foi executado.
