Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: 6549b388586f752d527b47f4715dbe1cc3fe2879
Headline: RC2 — Admin comercial, financeiro e pós-venda implementados; Integridade preservado.

Preview:
- READY — `dpl_4wHW32PAbLGPZN1ArWzNGJijDrKj`
- Imutável: https://ordum-dn9any6qt-ordum.vercel.app
- Alias: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
- Root HTTP 200; rotas administrativas recusam acesso anônimo com 401; runtime errors/HTTP 5xx no smoke: 0.

BR-004:
- RESOLVIDO pelo conector oficial Supabase; migration remota/local `20260814191358_integrity_customer_operations`.
- `integrity_notification_preferences`: RLS ativo, nenhuma policy Data API, `PUBLIC`/`anon`/`authenticated` sem acesso e CRUD somente `service_role` para a API.

Admin Financeiro:
- Visão geral limitada a MRR ativo, receita prevista, recebido e atraso, calculados de assinaturas/cobranças persistidas; ausência de dados usa `—`.
- Assinaturas, Cobranças e Inadimplência possuem navegação, busca, filtros, cards mobile, detalhes humanos, histórico e ações condicionais.
- Contrato, assinatura e pagamento permanecem estados distintos; não existe ação manual de “marcar como pago”.
- Falha/ausência do provider mantém dados locais acessíveis e bloqueia ações externas com mensagem humana.

Planos, Customer 360 e Customer Success:
- Planos apresentam produto, preço, ciclo, trial e limites em linguagem comercial; versionamento permanece interno e contratos antigos preservados.
- Empresa → Financeiro mostra plano, mensalidade, assinatura, próxima cobrança, último pagamento/atraso e CTA contextual.
- Carteira de CS mostra produtos, implantação e situação financeira sem score opaco ou métricas inventadas.

Asaas Sandbox:
- Sandbox-only/fail-closed preservado; produção não foi habilitada.
- Adapter, idempotência, eventos fora de ordem, chargeback, cancelamento e conciliação permanecem cobertos.
- BR-005: `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` indisponíveis; homologação externa real continua pendente sem bloquear o Financeiro local.

Checks:
- Secret scan PASS; 36 migrations válidas; lint/typecheck/build PASS.
- 214 testes: 213 PASS, 0 FAIL, 1 live comercial SKIP explícito.
- Foco financeiro: 19/19 PASS após correção do CTA de cancelamento no detalhe.
- Security Advisor: nenhum risco novo; `integrity_notification_preferences` gera apenas INFO esperado por ser server-only. Warnings legados não foram alterados fora do escopo.

Personas e mobile:
- Contratos de vendedor, financeiro, CS, Admin Global e isolamento do Integridade preservados pela suíte relevante.
- Layout financeiro usa listas/cards a partir do mobile e não depende de tabela horizontal.
- QA visual autenticado das quatro personas NÃO executado nesta sessão: o runtime oficial do navegador não disponibilizou instância. Requer revisão visual no Preview; nenhuma fixture foi criada, portanto nenhum dado/resíduo foi deixado.

Integridade smoke:
- Suítes de protocolo, tracking, RBAC, aggregate-only e fluxo operacional permaneceram verdes.
- Root do Preview e boundaries autenticadas responderam sem 5xx; smoke visual não foi repetido pela indisponibilidade do navegador.

Blockers reais:
- BR-001: SMTP transacional externo.
- BR-002: cron intradiário/runner, não bloqueante.
- BR-005: credenciais Asaas Sandbox para homologação externa.
- Revisão visual autenticada RC2 no Preview.
