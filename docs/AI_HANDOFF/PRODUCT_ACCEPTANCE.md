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
