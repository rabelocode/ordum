# ORDUM 07 — Administração e operação comercial

## Rotas

- `/#/admin/equipes`: equipes, gerentes, membros e visibilidade.
- `/#/admin/consultores`: usuários internos, vínculo, convite e suspensão.
- `/#/admin/leads`: busca, filtros, prioridade, paginação server-side, funil, atividades, atribuição e autoatribuição.
- `/#/admin/demos`: agenda, resultado, próxima ação, trials reais, expiração e revogação.
- `/#/admin/propostas`: preparação e aprovação por escopo.
- `/#/admin/contratos`: criação, aprovação e início explícito no Sandbox.
- `/#/admin/planos`: catálogo versionado, preço, ciclo, trial, carência e soluções.
- `/#/admin/financeiro`: clientes, assinaturas, pagamentos, inadimplência, cancelamento no fim do período, conciliação, webhooks e reprocessamento.
- `/#/admin/empresas`: tenants/clientes, onboarding, domínios, unidades/departamentos, memberships, contratos, pagamentos, auditoria e entitlements.
- `/#/admin/auditoria` e `/#/admin/sistema`: trilha e saúde.

## Funil seguro

```text
lead → atividade/demo → contrato pendente → aprovação
     → criação de assinatura Sandbox → aguardando pagamento
     → webhook confirmado → tenant + owner + soluções → ativo
```

Um lead não cria tenant ao ser capturado nem ao virar contrato. Trial cria tenant `trial` por operação autorizada e nunca cria pagamento fictício. Contrato aprovado ainda não libera acesso. Apenas pagamento confirmado/recebido, autenticado e reconciliado, chama o provisionamento idempotente.

## Estados de UX

As telas apresentam carregamento, vazio, erro, sucesso e acesso negado herdado do layout. Leads, clientes, auditoria, demonstrações, registros financeiros e webhooks utilizam paginação server-side, com limite máximo de 100 itens por página. Payload bruto financeiro nunca é devolvido ao browser.

Gerentes aprovam propostas e contratos somente nas equipes gerenciadas e até `proposal_approval_limit_cents`/`contract_approval_limit_cents` definidos em `platform_teams.settings`. Ausência de alçada exige admin. Vendedores veem o próprio registro ou a fila liberada pela política da equipe; o vínculo interno/externo não concede privilégio.
