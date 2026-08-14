Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: a7a3424a443fd37753b71a528ed5ddf4511acaf9
Headline: Admin + Integridade prontos para demonstração piloto.

Preview:
- READY — `dpl_6TWAepzjNQQ7ujuMHS3HF46CXaGW`
- https://ordum-4sdezq3z7-ordum.vercel.app

Telas polidas:
- Admin: home orientada a prioridades, lead/demo/proposta/contrato, Customer 360 e implantação.
- Integridade: home operacional, caixa e detalhe do caso, investigação, relatórios, canal público e comprovante/acompanhamento mobile.
- Hierarquia visual, microcopy, estados vazios, total da proposta, próxima ação e mensagens de erro foram revisados sem criar dados fictícios.

Simulação das 4 personas:
- Vendedor Ordum: equipe → lead → contato → demo → proposta → aprovação por outro usuário → contrato → ativação → cliente → implantação, integralmente pela UI (`ui-mst8hneq`).
- Administrador do cliente: configuração, estrutura Matriz — Goiânia / Unidade — Anápolis, canal e publicação comprovados no fluxo live.
- Denunciante: relato anônimo mobile → protocolo/segredo → acompanhamento e complemento.
- Compliance: triagem → roteamento → investigação → tarefas → comunicação/evidência → decisão → encerramento/reabertura (`integrity_e2e_1786729419844_dd249e0d`).

Evidências:
- Screenshots comerciais desktop/mobile: `tmp/pilot-ready/`.
- Cleanup: `residualTenants=0`, `residualAuth=0`.
- Suite: 203 PASS, 0 FAIL, 1 live comercial SKIP explícito; build, lint, typecheck e secret scan PASS.
- Preview: nenhum log HTTP 5xx encontrado após o QA.

Backend Requests:
- BR-001 continua pendente: Supabase Auth `/invite` retorna 429 até existir SMTP transacional configurado. Callback já validado; nenhum workaround frontend.
- BR-002 continua não bloqueante: runner sem `CRON_SECRET`.
- BR-003 não bloqueante: protocolo humano `INT-AAAA-000000` requer geração backend compatível com o modelo seguro atual.

Problemas encontrados e corrigidos:
- Home do Admin ainda parecia painel de métricas; prioridades foram condensadas numa fila de ação.
- Customer 360 mostrava estado de trial como status principal; agora prioriza a situação operacional do cliente.
- Próxima ação do caso ficava abaixo de dados secundários; foi promovida no detalhe.
- Relatórios começavam com oito KPIs equivalentes; agora destacam quatro indicadores e resumem os demais.
- Confirmação pública e upload exibiam linguagem genérica/inglesa; agora usam copy humana em português.

Blockers:
- Entrega real de convite por e-mail depende exclusivamente do SMTP externo descrito em BR-001; não bloqueia a demonstração com contas já provisionadas.
