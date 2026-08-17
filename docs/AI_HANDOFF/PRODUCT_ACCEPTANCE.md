# Product Acceptance P0

## Admin

- PASS — desktop — admin — Dashboard carregado com ações reais — `tmp/qa-package3/ui-mst51yyl/`.
- PASS — desktop/mobile — admin + segundo aprovador — equipe → lead → contato → demo → proposta → aprovação → contrato → cliente — cleanup concluído.
- PASS — mobile 390x844 — admin — Empresa e Produtos sem termos técnicos — `06-client-activated.png`, `07-client-mobile.png`.
- PASS — mobile 390x844 — admin — Implantação filtrada para o cliente e CTA de próxima ação — `08-onboarding-mobile.png`.
- PASS — mobile 390x844 — admin — Customer Success e aliases antigos redirecionados para áreas coerentes — `09-customer-success-mobile.png`.
- FAIL — mobile 390x844 — novo membro — entrega do e-mail bloqueada por rate limit externo (BR-001); no Preview final, callback controlado confirmou e-mail, ativou acesso, persistiu refresh e permitiu logout/login — `tmp/product-acceptance/invite-mst5ethp/`.

## Integridade

- PASS — desktop/mobile — tenant_admin/compliance/investigador — Home, Casos e Investigação com escopo atribuído e negativos cross-tenant — `tmp/product-recovery/`.
- PASS — desktop — compliance — Comunicação pública e nota privada visualmente separadas e isoladas no portal.
- PASS — desktop — compliance/investigador — evidência privada, URL assinada, tarefas, decisão, encerramento e reabertura.
- PASS — desktop — tenant_admin — Configurações, implantação e publicação do canal.
- PASS — mobile 390x844 — denunciante anônimo/identificado — canal, envio, protocolo, acompanhamento e nova mensagem — `public-report-receipt-mobile.png`, `public-tracking-mobile.png`.
- PASS — desktop — gestor/Admin Ordum — relatórios agregados e fronteira `aggregate-only`; dossiê individual negado ao Admin Global.

E2E real: `integrity_e2e_1786722809183_acc307fc`; cleanup `residualTenants=0`, `residualAuth=0`.

## RC2 Financeiro e pós-venda

- PASS — código/testes — Admin Global/Financeiro — visão geral, assinaturas, cobranças e inadimplência usam dados persistidos, estados humanos e ações condicionais — 19/19 testes financeiros focados.
- PASS — código/testes — Customer Success — carteira combina produto, implantação e situação financeira sem fabricar uso ou score.
- PASS — mobile por implementação responsiva — Financeiro/Empresa — listas em cards, detalhes sem tabela horizontal e ações acessíveis.
- PASS — HTTP — público/anônimo — Preview 200 e APIs administrativas 401 sem sessão; zero runtime errors/5xx no smoke.
- BLOCKED — browser desktop/mobile — quatro personas — runtime oficial sem navegador disponível; revisão visual autenticada deve ser feita no Preview RC2.

## RC2 Visual Acceptance

- PASS — desktop 1440x1000 — Admin Global — Dashboard com prioridades, Comercial e Customer 360; navegação e CTAs reais — `tmp/rc2-visual/01-admin-dashboard.png`, `02-lead.png`, `03-proposal.png`, `04-company.png`.
- PASS — desktop 1440x1000 — Financeiro — visão geral com quatro indicadores, assinaturas ativa/trial/em atraso, cobrança vencida e histórico em linguagem humana — `05-finance-overview.png`, `06-subscriptions.png`, `07-charge.png`.
- PASS — desktop 1440x1000 — Customer Success — carteira saudável/atenção/risco, implantação e situação financeira sem score inventado — `08-customer-success.png`.
- PASS — desktop 1440x1000 — tenant_admin/compliance/investigador — Home, Casos, detalhe e investigação preservados; Admin Global continua sem conteúdo confidencial — `09-integrity-home.png` a `12-integrity-investigation.png`.
- PASS — desktop 1440x1000 — denunciante — canal e acompanhamento com protocolo humano, mensagens sanitizadas e seletor de evidência em português — `13-public-channel.png`, `14-public-tracking.png`.
- PASS — mobile 390x844 — Admin/Financeiro — Dashboard, Empresa, visão financeira e cobrança sem overflow horizontal — `15-admin-dashboard-mobile.png` a `18-charge-mobile.png`.
- PASS — mobile 390x844 — investigador/denunciante — caixa em cards carregados, detalhe, canal e tracking sem overflow ou linguagem técnica — `19-integrity-cases-mobile.png` a `22-public-tracking-mobile.png`.

Problemas encontrados e corrigidos: trial/atraso eram derivados apenas do status bruto da assinatura; a UI agora respeita o estado financeiro efetivo. O upload público usava texto nativo em inglês; foi substituído por controle acessível em português. Capturas transitórias de skeleton foram estabilizadas.

Evidências: Admin QA `rc21-mste6uvp-641b3f`; Integridade E2E `integrity_e2e_1786739456585_4d6dce2d`; ambos com fixtures descartáveis, console/HTTP 5xx inesperados = 0 e cleanup com `residualTenants=0`, `residualAuth=0`.

# FINAL FREEZE GATE — ADMIN + INTEGRIDADE

- PASS — desktop 1440x1000 — Admin Global — Admin navigation, Comercial, Customer 360, Financeiro, Customer Success, Membros, Acessos e custom roles — `tmp/final-freeze/01-dashboard.png` a `10-cs-persona.png`.
- PASS — desktop 1440x1000 — Admin/Comercial/Financeiro/CS — menus reais por RBAC, deep-links negativos, back/forward e papéis de sistema protegidos — runs `admin-nav-mswhilku-a48c52`, `admin-access-mswhkpfl-42801b`, `custom-role-mswhjiw2-0162a5`.
- PASS — mobile 390x844 — Admin — Dashboard e Gestão de Acessos operáveis, sem overflow crítico — `21-admin-mobile.png`, `22-access-mobile.png`.
- PASS — desktop 1440x1000 — tenant_admin/compliance/investigador — Integridade Home, Casos, Investigação, Comunicação, Evidências, Decisão, Relatórios e Configuração — `11-home.png` a `17-settings.png`.
- PASS — mobile 390x844 — investigador/denunciante — caso, canal, comprovante e tracking — `18-public-channel.png` a `24-public-mobile.png`.
- PASS — múltiplos perfis — RBAC/confidencialidade — investigador não atribuído e cross-tenant negados; Admin Global limitado a agregados e sem dossiê individual.
- PASS — público — denunciante anônimo/identificado — protocolo humano, segredo separado, mensagem, anexo privado e acompanhamento sanitizado.

E2E Integridade: `integrity_e2e_1786926372985_2e838e83`; fluxo completo, Storage privado, signed URL, decisão, encerramento/reabertura e Admin aggregate-only. E2E Comercial: `ui-mswhe44h`. Financeiro/CS: `rc21-mswhh98i-45d1ad`. Convite: `invite-mswifehh`; callback, confirmação, ativação, refresh e novo login PASS, entrega real bloqueada pelo rate limit externo BR-001. Cleanup final: Auth QA = 0; platform_members QA = 0; roles QA = 0; tenants QA = 0; reports QA = 0.

Resultado: **FROZEN WITH EXTERNAL BLOCKERS** — nenhum blocker interno; BR-001, BR-002 e BR-005 permanecem externos.
