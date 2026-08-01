# ORDUM 06 — Estado da implementação

## Concluído nesta entrega

- auditoria do repositório, build, Auth, API, deploy e banco real;
- inicialização do diretório Supabase e nove migrations aplicadas/versionadas;
- modelo comercial, planos e billing com RLS/grants restritos;
- contrato `BillingProvider` e adapter Asaas Sandbox;
- webhook autenticado, limitado, persistido, idempotente e processado de forma assíncrona após resposta rápida;
- normalização de pagamentos, atraso, carência, revisão e reativação;
- provisionamento transacional depois de pagamento confirmado;
- conciliação diária autenticada por Vercel Cron, com recuperação paginada de cobranças e divergências duráveis;
- telas administrativas de dashboard, leads, demos, clientes, equipes/alçadas, equipe/sessões, contratos, planos, financeiro, auditoria, integrações, desempenho e deploy;
- correções de escopo global/equipe e bloqueio de autoelevação;
- remoção de rota temporária que expunha e-mails;
- testes de autorização, alçada, paginação, configuração, adapter Asaas, fila e máquina de estados, além de verificações SQL de RLS/grants;
- documentação sincronizada.

## Condicionado à configuração externa

A integração permanece `BILLING_ENABLED=false`. Sem `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `CRON_SECRET` na Vercel, nenhuma chamada ou cobrança é feita. Isso é um bloqueio seguro de homologação, não um fallback local.

## Validações executadas

- `npm run lint`;
- `npm test`;
- `npm run build`;
- consultas reais ao Supabase;
- RLS/grants e assinatura das RPCs;
- advisors de segurança e performance antes/depois;
- smoke tests do deploy após push.

Os avisos legados dos advisors são registrados no relatório final; não foram removidos em massa porque incluem RPCs públicas intencionais de denúncia/candidatura e políticas dos produtos, cujo redesenho exige testes próprios.
