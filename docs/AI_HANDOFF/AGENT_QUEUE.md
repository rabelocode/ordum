Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: bd20d78cf84fdd71a8de9b0eb4a9848d480a3a3b
Implemented:
- Fluxo comercial completo operável pela interface: lead, contato, etapa, demonstração, resultado, proposta, aprovação segregada, envio, aceite, contrato, assinatura externa auditável, ativação em trial, cliente, implantação e acesso ao Integridade.
- Demonstrações reconstruídas com visões Próximas/Hoje/Realizadas/Canceladas, agendamento, reagendamento, resultado e ações contextuais sem diálogos nativos.
- Propostas reconstruídas com wizard Cliente → Produtos → Plano e preço → Condições → Revisão, totais visuais, validade padrão, progresso e ações válidas por estado.
- Contratos reconstruídos com progresso real, assinatura externa explícita e ativação de cliente em trial sem chamar Billing/Asaas.
- Leads receberam criação, registro de contato, mudança de etapa, agendamento de demo, observações e ações desktop/mobile.
- Implantação virou fila operacional com progresso, responsável, prazo, próxima ação e encaminhamento para a configuração do produto, sem duplicar o wizard do Integridade.
- Customer Success virou carteira por saúde; Suporte recebeu visões operacionais e separação entre mensagem externa e nota interna; Auditoria passou a usar frases humanas e detalhes técnicos recolhidos.
- Erros técnicos conhecidos são traduzidos em orientação de negócio; autoaprovação informa a segregação de responsabilidade sem expor código/status HTTP.
- Catálogo contratado em português agora resolve corretamente as rotas do workspace (`integridade`, `pessoas`, `talentos`).
- Layouts mobile em cards validados para leads, demonstrações, propostas, contratos, implantação e empresa.
Database:
- Migration `20260811155637_commercial_product_recovery_flow.sql` aplicada oficialmente no Supabase: metadados de envio da proposta e assinatura externa do contrato, de forma aditiva.
- Fixture comercial descartável removida integralmente; nenhum dado real foi alterado.
Tests:
- Secret scan PASS: 338 arquivos rastreados.
- Migration validation PASS: 31 migrations ordenadas.
- Lint PASS; typecheck PASS; build client/server/Vercel PASS.
- Suite completa: 183 testes, 182 PASS, 0 FAIL, 1 live comercial SKIP explícito.
- Produto comercial: 5 testes direcionados PASS, incluindo ausência de diálogos nativos, ativação trial-only, catálogo do workspace, validade e erro humano de autoaprovação.
Preview:
- READY — `dpl_GKFfVUeTphk4CYSDhShbxPQ7LWft`
- https://ordum-pfj82c5cx-ordum.vercel.app
- Alias: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
QA:
- Browser desktop comprovou: login Admin → criar lead → registrar contato → alterar etapa → agendar demo → registrar resultado → criar proposta com Integridade → aprovação por segundo admin → envio → aceite → contrato → aprovação → assinatura externa → ativação trial → empresa → implantação → workspace Integridade.
- Segregação comprovada: o criador não aprovou a própria proposta; um segundo ator descartável aprovou, e o primeiro aprovou o contrato.
- Evidência de dados antes do cleanup: leads 1; demos 1; propostas aceitas 1; contratos assinados 1; tenants em implantação 1; soluções ativas 1; onboarding_runs 1.
- Cleanup comprovado: Auth E2E 0; platform_members E2E 0; leads 0; demos 0; propostas 0; tenants 0; planos QA 0; equipes QA 0.
- Mobile 390x844 comprovado em leads, demos, propostas, contratos, implantação e empresa; leads usaram cards sem tabela horizontal.
- Screenshots versionados em `artifacts/qa/product-recovery-2/01-lead-created.png` até `12-mobile-company.png`.
- Preview final autenticado carregou a área de Leads sem erro técnico visível; deployment final registrou 0 respostas 5xx na janela inspecionada.
- Supabase Advisors executados: Security 58 avisos (45 INFO, 13 WARN) e Performance 219 (188 INFO, 31 WARN); nenhuma alteração de RLS foi introduzida por este pacote.
Blockers:
- O catálogo real possui somente um plano ativo de teste, com nome e configuração comercial inadequados e sem dias de trial; o QA usou plano descartável e não alterou preços/regras reais. É necessária configuração comercial do catálogo pelo responsável.
- Billing/Asaas permanece bloqueado por credenciais externas e não foi usado; ativação testada foi exclusivamente trial.
- Assinatura eletrônica não possui provedor real; o produto registra apenas assinatura externa de forma auditável.
- Entrada do cliente no workspace ainda depende de convite/membership; o Admin não faz impersonation silenciosa. O próximo pacote deve tornar o convite do owner uma etapa operacional da implantação.
- Suporte possui fila e linguagem recuperadas, mas o detalhe conversacional completo ainda é um gargalo de produto.
Suggested next package:
- Revisão de produto do fluxo comercial e ajustes finos de densidade/nomenclatura usando as evidências versionadas.
- Configurar catálogo comercial real (planos, produtos, trial e métodos) sem hardcode e com decisão explícita de valores.
- Completar convite do owner/equipe diretamente pela implantação e conduzir o primeiro acesso ao wizard do Integridade.
- Completar detalhe conversacional de Suporte com mensagens, notas, responsável e timeline.
- Revalidar Billing/Asaas Sandbox quando as credenciais externas estiverem disponíveis.
