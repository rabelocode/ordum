# ORDUM 07 — Administração e operação comercial

## Rotas

- `/#/admin/equipes`: equipes, gerentes, membros e visibilidade.
- `/#/admin/consultores`: usuários internos, vínculo, convite e suspensão.
- `/#/admin/leads`: fila escopada, atribuição e autoatribuição.
- `/#/admin/demos`: trials reais e expiração.
- `/#/admin/propostas`: preparação e aprovação por escopo.
- `/#/admin/contratos`: criação, aprovação e início explícito no Sandbox.
- `/#/admin/planos`: catálogo versionado, preço, ciclo, trial, carência e soluções.
- `/#/admin/financeiro`: integridade do Asaas, inadimplência, webhooks e reprocessamento.
- `/#/admin/empresas`: tenants/clientes e entitlements.
- `/#/admin/auditoria` e `/#/admin/sistema`: trilha e saúde.

## Funil seguro

```text
lead → atividade/demo → contrato pendente → aprovação
     → criação de assinatura Sandbox → aguardando pagamento
     → webhook confirmado → tenant + owner + soluções → ativo
```

Um lead não cria tenant ao ser capturado nem ao virar contrato. Trial cria tenant `trial` por operação autorizada e nunca cria pagamento fictício. Contrato aprovado ainda não libera acesso. Apenas pagamento confirmado/recebido, autenticado e reconciliado, chama o provisionamento idempotente.

## Estados de UX

As novas telas apresentam carregamento, vazio, erro, sucesso e acesso negado herdado do layout. Contratos têm busca e filtro; webhooks mostram falhas reprocessáveis sem revelar payload bruto. A paginação server-side deve ser adicionada antes de volumes superiores ao limite operacional atual de 100 eventos por tela.
