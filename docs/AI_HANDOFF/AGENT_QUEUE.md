Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: b8fda0eaedf07529aa3f81208c95660216b2b018
Implemented:
- Integridade reorganizado em cinco áreas de negócio: Visão geral, Casos, Investigações, Relatórios e Configurações; implantação e regras técnicas ficaram dentro do contexto correto.
- Home refeita para começar por atenção necessária, casos do usuário e somente os indicadores essenciais.
- Caixa de casos refeita com visões rápidas, busca, filtros em drawer, paginação no servidor, responsável/atividade legíveis e cards mobile.
- Detalhe do caso refeita com cabeçalho operacional, ações contextuais, visão geral, investigação, conversa, evidências e histórico; comunicação externa exige confirmação explícita e notas privadas permanecem separadas.
- Configurações e primeiros passos simplificados com CTAs específicos, textos humanos e canal pronto/publicado; chaves internas e termos de banco não aparecem nos formulários.
- Admin reorganizado por Comercial, Clientes, Financeiro, Operação e Administração; itens de engenharia/deploy foram retirados da navegação comum.
- Dashboard Admin refeito para ações pendentes, funil comercial simples, receita e saúde de clientes, sem parede de métricas.
- Página da empresa refeita em Resumo, Produtos, Comercial, Financeiro, Pessoas e acessos e Histórico; dados agregados do Integridade preservam a fronteira de confidencialidade.
- Leads ganhou fluxo comercial legível, ações rápidas desktop/mobile e transições com mensagens humanas; propostas e contratos usam a camada centralizada de erros amigáveis.
- API da caixa de casos passou a suportar Todos, Não atribuídos, Meus casos, Aguardando resposta e Encerrados, incluindo última atividade e mensagem pendente.
- Fallbacks de nomes e checklist operacional foram traduzidos para linguagem de equipe, encaminhamento e prazos.
Database:
- Nenhuma migration nova; infraestrutura, RLS e Storage existentes foram preservados.
Tests:
- Secret scan PASS: 323 arquivos.
- Migration validation PASS: 30 migrations ordenadas.
- Lint PASS; typecheck PASS; build client/server/Vercel PASS.
- Suite: 178 testes, 177 PASS, 0 FAIL, 1 live comercial SKIP explícito.
- Live Integridade E2E PASS: run `integrity_e2e_1786460180307_c32b81e5`; health 200; report 201; browser QA e Admin Product QA PASS; rate limit na tentativa 21; cleanup PASS; tenants residuais 0; Auth residual 0.
Preview:
- READY — `dpl_DQe4JZhmy2RJkjpQPYnuqDwoHbny`
- https://ordum-nnbcil55u-ordum.vercel.app
- Alias: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
QA:
- Admin desktop: dashboard por ação e empresa/produtos percorridos; navegação comercial validada; nenhum termo técnico proibido visível na empresa.
- Integridade desktop: tenant_admin e compliance percorreram caixa, exportação, detalhe, tabs e configuração/primeiros passos.
- Integridade mobile 390x844: investigador atribuído percorreu cards e detalhe; investigador não atribuído permaneceu bloqueado.
- Canal público mobile, anonimato/identificação, RLS assigned/unassigned/cross-tenant/identity, mensagens, evidências, PDF, relatórios e aggregate-only validados.
- Screenshots QA: `tmp/product-recovery/*` no ambiente da execução; inspeção visual aprovada sem overflow bloqueante.
- Preview final respondeu HTTP 200; Vercel registrou 0 logs 5xx no deployment final.
Blockers:
- `CRON_SECRET` é devolvido redigido pelo pull da Vercel; scheduler não foi reexecutado nesta rodada. O teste unitário de proteção/idempotência passou e a validação live anterior permanece registrada no handoff precedente.
- Billing/Asaas continua como dependência externa controlada e não foi alterado.
- Demonstrações, Billing e telas administrativas secundárias ainda usam diálogos legados; ficaram fora do P0 entregue e não devem ser considerados recuperados visualmente.
- Fluxo comercial completo lead → demo → proposta → contrato não foi mutado em browser contra dados reais; regras/transições passaram na suíte, mas o QA visual descartável completo permanece pendente.
- Assinatura eletrônica continua indisponível por ausência de provedor real; nenhum estado fictício foi adicionado.
Suggested next package:
- Product review do P0 entregue com decisão sobre ajustes de densidade e nomenclatura.
- Recuperar visualmente Demonstrações, Propostas e Contratos, removendo diálogos nativos restantes.
- Criar fixture comercial descartável independente de Billing para QA browser lead → contrato.
- Refinar Administração/Auditoria e esconder detalhes técnicos em drawer autorizado.
- Revalidar o scheduler live somente com acesso seguro ao segredo do Preview.
