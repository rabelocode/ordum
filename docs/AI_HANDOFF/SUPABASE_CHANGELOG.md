# Supabase Changelog

## Contexto de Integração
- Template "Onboarding padrão de cliente" criado e processado de forma externa e independente pelo agente ChatGPT via migrations diretas (ref: `seed_default_customer_onboarding_template`).
- Nenhuma nova alteração esquemática de banco de dados ou RPC foi gerada pelo Antigravity nesta iteração de front/backend.

## Tabelas Consumidas
- `commercial_demos`: Para viabilizar testes de vendas baseados nos Leads.
- `commercial_proposals` e `commercial_proposal_items`: Integradas ao price lookup de `billing_plan_prices` e inseridas durante requisição.
- `commercial_contracts` e `commercial_contract_items`: Herdam os limits da proposta aprovada.
- `billing_subscriptions` e `billing_payments`: Acessadas pelo mock Sandbox (`mock-sandbox-payment`).
- `onboarding_templates` e `onboarding_runs`: Consultadas por fetch/início de pipeline.

## RPCs Utilizadas
- `provision_paid_contract`: Consumida pelo Webhook simulado, convertendo um Payment confirmado no acesso ao tenant.
- `admin_start_onboarding`: Disparada de forma autônoma após o Event Processor acusar sucesso no provisioning financeiro.

## Pendências de Schema
Haverá necessidade futura de adequar integrações cruzadas, como:
- Relacionamentos robustos em Painéis Financeiros (fora do escopo da etapa visual).
- Finalização das Roles da Integridade.
