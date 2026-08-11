Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: 7f789a53e5ea8337b5bb040ee83a6c90f488ed39
Implemented:
- Corrigido o contexto compartilhado do Admin para carregar equipes, equipes gerenciadas e tipo de vínculo; rotas importadas deixam de perder o escopo e gerar 403 indevido.
- Agendamento de demonstração agora exige equipe válida e, para leads legados sem atribuição, vincula equipe e responsável de forma auditada antes de criar a demo.
- Propostas e contratos recebem `approval_action`; o criador vê “Aguardando outra pessoa aprovadora” em vez de um CTA que inevitavelmente retornaria 409.
- Criação de proposta não aceita mais lead órfão de equipe; frontend e backend exibem orientação humana antes da requisição.
- Leads, demos, propostas e contratos receberam botões com tipos explícitos para impedir submissões/GETs acidentais.
- Estado sem equipe comercial agora explica a pré-condição e oferece CTA direto para criar a equipe nos fluxos de lead, demonstração e atribuição.
- Erros conhecidos de atribuição, autorização, conflito e transição continuam sanitizados pela camada central de mensagens amigáveis.
Database:
- Nenhuma migration ou alteração destrutiva necessária.
- Banco confirmado com 0 equipes comerciais ativas; nenhuma equipe fictícia foi criada automaticamente.
Tests:
- Secret scan PASS: 341 arquivos rastreados.
- Lint PASS; typecheck PASS; build client/server/Vercel PASS.
- Suite completa: 189 testes, 188 PASS, 0 FAIL, 1 live comercial SKIP explícito.
- Regressões focadas após o último ajuste: 32 PASS, 0 FAIL.
- Cobertura nova: resolução de escopo/equipes, demo em lead legado sem atribuição, governança de autoaprovação e bloqueio de proposta sem equipe.
Preview:
- READY — `dpl_A7yQxeKyqsYWWJtPJYyhPcQteC3Z`
- https://ordum-hfgmbj9tq-ordum.vercel.app
- Alias: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
QA:
- Browser autenticado com fixture descartável validou Leads em desktop e mobile 390x844.
- Modais de demonstração e atribuição exibem estado vazio acionável quando não existe equipe ativa; nenhum POST inválido é disparado.
- Mobile: viewport 390, scrollWidth 390, sem overflow horizontal, sem erros de console e sem respostas HTTP 4xx/5xx no fluxo validado.
- API de propostas retornou 200 para a proposta reportada e informou ação de aprovação conforme o ator; testes validaram criador, outro aprovador e único aprovador.
- Nenhum GET para endpoints de ação `/demos` ou `/approve` foi observado.
- Fixtures Auth/platform_member removidas integralmente: residual 0.
- Logs Vercel do deployment: 0 respostas 5xx na janela do QA.
Blockers:
- Billing/Asaas permanece desativado, Sandbox-only e fail-closed até o responsável fornecer as credenciais futuras; nenhuma cobrança foi executada.
Suggested next package:
- Criar a primeira equipe comercial real pelo Admin e atribuir os leads legados antes de continuar demos/propostas.
- Revalidar o fluxo comercial clicado com os responsáveis reais da equipe.
- Quando disponível, cadastrar a API do Asaas Sandbox e executar a homologação E2E já preparada.
