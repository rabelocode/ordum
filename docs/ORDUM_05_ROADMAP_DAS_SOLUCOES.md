# ORDUM 05 — Roadmap das soluções

## Disponível agora

- Auth, descoberta de organização e workspace ligados ao Supabase;
- catálogo Integridade, Pessoas e Talentos no banco;
- RBAC de tenant e RLS;
- admin interno com equipe, leads, clientes, auditoria e saúde;
- telas reais de demos, contratos, planos/preços e financeiro;
- fundação Asaas Sandbox, webhook, estados de acesso e conciliação;
- provisionamento pós-pagamento e trials separados.

## Homologação seguinte

1. Configurar Asaas Sandbox na Vercel.
2. Criar plano e contrato de teste.
3. Validar cliente, assinatura e todos os webhooks usados.
4. Exercitar atraso, carência, suspensão, reativação, estorno e chargeback.
5. Validar e-mail de convite e entitlements do tenant provisionado.
6. Executar teste de isolamento com contas reais de `manager` e `sales`.

## Evolução posterior

- aprovação por alçada monetária configurável;
- editor completo de propostas e aceite eletrônico;
- checkout hospedado e portal financeiro do owner;
- paginação cursor-based para grande volume;
- métricas de funil e metas sem KPIs inventados;
- fila assíncrona dedicada se o volume de webhook superar o processamento serverless;
- segundo provedor por novo adapter do `BillingProvider`;
- produção Asaas somente após aceite formal.

Split, subcontas BaaS, armazenamento de cartão e comissão automática estão explicitamente fora desta fase.
