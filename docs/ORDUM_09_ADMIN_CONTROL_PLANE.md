# ORDUM 09 — Admin Control Plane

> Atualização do piloto: CI e observabilidade estão descritos em `ORDUM_10_PILOTO_OBSERVABILIDADE.md`. O admin não mostra Sentry, PostHog ou Linear como integrados sem evidência externa real.

## Escopo entregue

O `/#/admin` usa PostgreSQL/Supabase como fonte operacional e o Express server-side como boundary de autorização. Esta entrega ampliou o admin existente sem recriar leads, equipes, contratos, billing ou autenticação.

Rotas novas:

- `/#/admin`: central de comando com período, equipe, responsável e plano, comparação com o período anterior, links de drill-down, alertas, horário da base e exportação autorizada;
- `/#/admin/onboarding`;
- `/#/admin/customer-success`;
- `/#/admin/suporte`;
- `/#/admin/privacidade`;
- `/#/admin/metas`;
- `/#/admin/operacoes`;
- `/#/admin/acessos`;
- `/#/admin/empresas/:id`, aba Entitlements.

As listas novas são paginadas no servidor. Estados vazios dizem que não há registros; métricas sem base aparecem como `—`, sem estimativas ou mocks.

## Arquitetura e autorização

```text
React /#/admin
  → Bearer JWT
  → Express requirePlatformAuth
  → papel + permissões + equipes + owner/tenant permitido
  → RPCs e tabelas server-only via service_role
  → auditoria sanitizada
```

- `admin` tem escopo global.
- `manager` opera somente equipes atribuídas e respeita alçadas.
- `sales` vê registros próprios ou filas liberadas pela política da equipe.
- `relationship_type` (`partner`, `employee`, `contractor`, `representative`, `agency`, `other`) é informativo e não concede privilégio.
- `TENANT_ADMIN` não é papel global.
- autoelevação continua bloqueada; o último admin ativo continua protegido pelas funções existentes.
- aprovação própria de proposta ou contrato é recusada no banco.

O simulador de acesso é somente leitura e exibe papel, vínculo, equipe, permissão, decisão e origem. Ele não altera grants.

## Central de comando e métricas

`admin_control_plane_metrics` agrega no banco, sem carregar tabelas inteiras no Node. Retorna funil, conversão, tempo médio, onboarding, tenants, trials, MRR/ARR, valores recebidos/pendentes/vencidos, inadimplência, churn observado, renovações, expansão, falhas, divergências, tarefas vencidas e risco. O servidor calcula o período anterior com a mesma duração.

MRR normaliza ciclos semanal, quinzenal, mensal, trimestral, semestral e anual. Valores permanecem em centavos/BRL. Métricas financeiras são indisponíveis quando não existe base financeira. Filtros são intersectados com o escopo do ator.

Exportação CSV é limitada a 1.000 linhas, auditada, protege contra CSV injection e não inclui dados da Ordum Integridade.

## Comercial

- deduplicação: hashes normalizados de empresa, domínio, CNPJ/CPF, e-mail e telefone em `commercial_lead_identity_keys`;
- scoring: regras configuráveis e explicações persistidas no lead;
- SLA: `first_contact_due_at` e `first_contact_at`;
- atribuição automática: RPC idempotente/concorrente com advisory lock, política da equipe e histórico;
- atribuição manual: motivo obrigatório e auditoria antes/depois;
- propostas: raiz, versão, predecessora, itens, vigência, limites e RPC transacional para nova versão;
- propostas aprovadas não são editadas silenciosamente: alterações criam versão em rascunho;
- estados administrativos passam por `admin_transition_control_plane`, com motivo, ator, escopo, idempotency/correlation ID disponível e auditoria.

PDF e assinatura digital não foram simulados. A geração de PDF e o aceite eletrônico exigem implementação/provedor real.

## Cliente, onboarding e Customer Success

O tenant recebeu lifecycle, razão/nome comercial, documento normalizado, contatos, stakeholders, trial, gerente de sucesso, risco e optimistic locking. A página 360 reaproveita domínios, unidades/departamentos, memberships, contratos, pagamentos e auditoria já existentes.

Onboarding possui templates versionados por plano/solução, passos, dependências, responsável, prazo, observação, evidência e histórico. `admin_start_onboarding` é idempotente por tenant e copia o snapshot do template. `admin_refresh_onboarding_progress` calcula progresso real.

Customer Success armazena gerente, plano de sucesso, health score, fatores, pesos, revisão, renovação e churn. Eventos representam tarefas, reuniões, notas, riscos, incidentes, NPS, expansão e renovação. Sem fatores/pesos suficientes, o score deve permanecer nulo; nenhuma fórmula opaca foi criada.

## Entitlements e catálogo

`admin_effective_entitlements` explica, por solução, tenant, contrato, versão do plano, assinatura, ativação local e override temporário. Suspensão/cancelamento bloqueia sem apagar dados. Overrides exigem motivo e expiração.

Entitlement libera produto, mas nunca substitui RBAC. O frontend apresenta a decisão; não é a autoridade.

O catálogo existente continua versionado, com preço em centavos/BRL. Planos antigos permanecem vinculados a contratos; nenhuma mudança retroativa foi adicionada.

## Billing, dunning e comissões

A integração Asaas existente foi preservada. Continua Sandbox-only e falha fechada em produção. O painel não mostra API key nem token. `billing_dunning_policies` e `billing_dunning_events` modelam avisos/tarefas internas, carência, suspensão e recuperação sem fingir comunicação externa.

`sales_targets` suporta metas por equipe ou responsável. `sales_commissions` separa prevista, elegível, aprovada, estornada e cancelada, com snapshot da regra e vínculo ao pagamento. Nenhuma porcentagem padrão, split ou transferência automática foi criada.

A homologação ponta a ponta do Asaas não foi executada porque as credenciais Sandbox permanecem ausentes/desabilitadas. Consulte `ORDUM_08_BILLING_ASAAS.md`.

## Suporte, operações e LGPD

- suporte interno: tenant, solução, categoria, prioridade, severidade, SLA, responsável/equipe, comentários/eventos privados e satisfação;
- operações: eventos, status, tentativas, correlation ID, próximo retry e erro sanitizado;
- LGPD operacional: tipo, consentimento, retenção, legal hold, responsável, prazo, resultado e eventos; exportações genéricas excluem Integridade.

Não foram inventados logs de Git/Vercel nem botão de redeploy. Operações externas só aparecem quando há integração real.

## Banco e segurança

Migration: `20260801215437_admin_control_plane_foundation.sql`.

Objetos principais: 22 tabelas server-only, 5 RPCs operacionais, trigger de identidade de leads, constraints de lifecycle/status e índices dirigidos pelas consultas. Todas as tabelas novas têm RLS habilitado, grants de `anon`/`authenticated` revogados e acesso explícito de `service_role`. RPCs privilegiados têm `search_path` fixo e `EXECUTE` revogado de `PUBLIC`, `anon` e `authenticated`.

As chaves Supabase não foram alteradas. Nenhum segredo novo foi adicionado ao frontend, logs, commit ou documentação.

## Testes e validação

- `npm run lint`: aprovado;
- `npm test`: 22/22 aprovados;
- consultas reais: leads, clientes, billing, auditoria, onboarding, CS, suporte, privacidade, operações, detalhe do cliente, métricas e entitlements aprovados;
- publishable key: RPC de métricas server-only recusado;
- Storage público: enumeração continua bloqueada;
- migration: compilada em transação/rollback antes de ser aplicada.

Os advisors pós-migration não atribuíram WARN novo às funções desta entrega. Os avisos `RLS enabled no policy` das tabelas server-only são intencionais porque não há grants para browser. Permanecem avisos legados de funções antigas, índices/FKs e proteção de senha vazada no Auth; devem ser tratados em manutenção dedicada para evitar alterações indiscriminadas.

## Limitações reais

- telas novas entregam consulta operacional paginada; formulários completos para criar/editar cada entidade ainda não cobrem todo o modelo;
- filtro de solução no dashboard ainda depende do relacionamento plano/solução e será ampliado no próximo ciclo;
- PDF/assinatura/agenda/comunicação externa não foram simulados;
- health score armazena fatores e pesos, mas a configuração visual completa ainda é pendente;
- dunning gera base operacional; execução automática de todas as políticas ainda é pendente;
- homologação Asaas depende das variáveis Sandbox descritas em ORDUM_08;
- nenhuma cobrança, suspensão de cliente real ou teste destrutivo foi executado.

## Próximas prioridades

1. Completar formulários e timelines de onboarding, CS, suporte e LGPD sobre as APIs e tabelas entregues.
2. Fechar filtro de solução ponta a ponta e drill-down filtrado para todos os indicadores.
3. Homologar o Asaas Sandbox com credenciais próprias e os 16 cenários do checklist, sem liberar produção.
