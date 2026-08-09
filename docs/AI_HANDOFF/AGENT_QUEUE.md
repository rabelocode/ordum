Owner: chatgpt_backend
Status: ready_for_review
Branch: fix/admin-functional-recovery
Head: a2ba60f387f7bb5d2b9a82b038a22cbfb655161c
Implemented:
- Storage privado `ordum-integrity`, upload autenticado e público controlado, validação de MIME/assinatura/tamanho, URLs assinadas por 120 segundos e exclusão auditada.
- Rate limiting persistente serverless para envio, acompanhamento, mensagens e upload público, com chave HMAC sem IP/protocolo em claro.
- Tarefas de investigação, conclusão interna separada do resultado comunicável, reabertura motivada, comitês, roteamento automático, conflitos e timeline.
- SLA de primeira ação e tratamento, filtros/indicadores operacionais, cockpit e detalhe responsivo com skeletons, estados vazios, feedback e confirmação sem `window.prompt`.
- Control plane agregado no Admin Ordum com saúde, armazenamento, SLA e fronteira explícita sem conteúdo confidencial.
- Mensagem pública de anonimato corrigida para não prometer anonimato absoluto.
Database:
- `20260809141338_integrity_operational_phase4b`: applied.
- `20260809141818_integrity_operational_sla_defaults`: applied.
- `20260809142426_integrity_operational_fk_indexes`: applied.
- Bucket remoto: privado, 10 MB, allowlist MIME; nenhuma policy direta permite enumerar `ordum-integrity`.
- Advisors revisados: rate-limit/secrets sem policy é fail-closed intencional; índices novos aplicados; RPCs públicos legados permanecem como blocker de cutover.
Tests:
- Secret scan PASS: 282 arquivos rastreados.
- Migration validation PASS: 20 migrations ordenadas.
- Lint/typecheck PASS.
- Testes PASS: 136 aprovados, 0 falhas, 1 live E2E comercial explicitamente ignorado (137 total).
- Build cliente, servidor e Vercel PASS; live queries PASS.
- QA SQL remoto do rate limit: 3 permitidas, 2 bloqueadas, resíduos 0.
Preview:
- READY — dpl_22xxuQSSNgJqXWGNT5yps2CC1bec
- https://ordum-9hgooclwj-ordum.vercel.app
QA:
- Raiz com conteúdo, sem overlay, erros ou warnings de console; mensagem de anonimato revisada presente.
- Canal inexistente exibe estado acionável; viewport 390x844 sem overflow ou tela branca.
- GET canal inexistente: HTTP 404; POST acompanhamento inválido: HTTP 404; logs 5xx do deployment: 0.
- Supabase remoto: bucket privado confirmado e rate limit persistente executado com cleanup confirmado.
Blockers:
- Revogar os RPCs públicos legados de submissão/acompanhamento somente após merge/deploy do novo frontend; revogação antecipada quebraria a produção atual e permitiria bypass do rate limit até o cutover.
- Fluxo completo autenticado com evidência real não foi executado por ausência de fixture/conta de homologação descartável autorizada; nenhum dado real foi poluído.
Suggested next package:
- Cutover coordenado dos endpoints públicos com revogação dos RPCs legados e E2E autenticado em tenant de homologação descartável.
