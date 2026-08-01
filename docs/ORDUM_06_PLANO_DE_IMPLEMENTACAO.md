# ORDUM 06 — Estado da implementação

## Concluído nesta entrega

- auditoria do repositório, build, Auth, API, deploy e banco real;
- inicialização do diretório Supabase e dez migrations aplicadas/versionadas;
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

O alerta de listagem ampla do bucket público foi removido. Os avisos restantes dos advisors são registrados no relatório final: as RPCs públicas de denúncia/candidatura e os helpers de autorização são `SECURITY DEFINER` intencionais, com `search_path` fixo, `PUBLIC` revogado e grants mínimos. A proteção contra senhas vazadas depende de habilitação no painel do Supabase.

Após a décima migration, o advisor de segurança registra 20 itens informativos de tabelas server-only sem policy, 20 alertas conhecidos das RPCs privilegiadas intencionais e um alerta de configuração do Auth. O advisor de performance permanece com 176 recomendações sobre o esquema legado; não foram criados índices indiscriminadamente porque 75 índices já aparecem como não utilizados.
# Incremento 09

Concluída a fundação transacional e as telas de consulta do control plane. Permanecem como próximos incrementos os formulários completos, o drill-down filtrado por todos os indicadores e a homologação Asaas Sandbox.
