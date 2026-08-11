Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: c5a79993d69ca2b2a2df4e8b634be0218454ff8d
Implemented:
- Uma empresa agora configura e publica o Canal de Integridade, recebe relatos anônimos ou identificados, acompanha por protocolo + segredo e trata o caso até decisão, encerramento e reabertura pela interface.
- Canal público reconstruído com linguagem de confiança, wizard em seis etapas, revisão, comprovante copiável/baixável e miniportal de acompanhamento responsivo.
- Bug de envio antecipado ao avançar para a revisão corrigido: continuar e enviar são ações distintas.
- Caixa de casos ganhou visões Novos, Sem responsável e SLA crítico, mantendo filtros avançados, paginação no servidor e cards mobile.
- Decisão formal com classificação, conclusão, medidas, fundamentação privada, mensagem opcional ao denunciante e checklist de encerramento.
- Evidências com seleção/drag-and-drop, descrição, sinalização de visibilidade e cadeia de custódia sem expor caminho de Storage.
- Timeline não exibe chaves técnicas desconhecidas; usa mensagem operacional segura.
- Cabeçalho público usa o nome da organização e evita título duplicado.
Database:
- Nenhuma migration ou DDL necessária neste pacote.
- RLS, Storage privado, signed URLs, rate limit persistente e aggregate-only preservados e exercitados no E2E.
Tests:
- Secret scan PASS: 344 arquivos rastreados.
- Migration validation PASS: 33 migrations ordenadas.
- Lint/typecheck/build client-server-Vercel PASS.
- Suite completa: 196 testes, 195 PASS, 0 FAIL, 1 live comercial SKIP explícito.
- Live Integridade E2E Preview PASS: run integrity_e2e_1786488725315_f74537ae.
Preview:
- READY — dpl_AXDr9723Bp83k6JGoTh6Kfh4q9e9
- https://ordum-gi9nv51rr-ordum.vercel.app
- Alias: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
QA:
- Fluxo clicado no browser: publicar canal configurado → enviar relato anônimo pelo wizard → receber protocolo/segredo → acompanhar mobile → complementar informações → compliance abrir caso → triagem → investigação → tarefa → mensagem externa com confirmação → nota privada → evidência → decisão → encerramento → reabertura.
- Papéis validados: tenant_admin, compliance, investigador atribuído mobile, investigador não atribuído, usuário sem permissão, tenant cruzado e Admin Global aggregate-only.
- Fronteiras comprovadas: nota interna ausente do portal público; identidade protegida; Admin Global sem dossiê/conteúdo; Storage cross-tenant bloqueado; rate limit no intento 21.
- Desktop 1440x1000 e mobile 390x844 sem overflow no canal, acompanhamento, caixa e detalhe.
- Screenshots: tmp/product-recovery/public-report-receipt-mobile.png, public-tracking-mobile.png, investigator_assigned_mobile-case-detail.png, integrity-complete-ui-flow.png, tenant_admin_desktop-settings.png e admin-company-products.png.
- Cleanup PASS: residualTenants 0; residualAuth 0; Storage descartável removido.
- Vercel: 0 runtime errors e 0 logs 5xx no deployment final.
- Supabase Advisors: 13 WARN de segurança e 31 WARN de performance já conhecidos; tabelas server-only sem policy aparecem como INFO e policies permissivas sobrepostas permanecem como dívida de performance, sem ampliação de acesso neste pacote. Referência: https://supabase.com/docs/guides/database/database-linter
Blockers:
- Scheduler idempotente não foi executado no QA local/Preview por ausência da credencial de cron no ambiente do runner; o restante do fluxo não depende dele.
- Asaas permanece Sandbox-only/fail-closed até credenciais futuras; não foi alterado neste pacote.
Suggested next package:
- Revisão comercial do produto no Preview com conteúdo e identidade visual de uma empresa piloto.
- Configurar a credencial do cron no runner de homologação e incluir o scheduler no live E2E.
- Planejar consolidação das policies permissivas somente com equivalência de autorização e plano de query comprovados.
