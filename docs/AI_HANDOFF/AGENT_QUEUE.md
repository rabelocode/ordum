Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: 3bb0d172e3e4ff9184c052137057cef590ab4bef
Implemented:
- Convite do responsável do cliente integrado à página da empresa e à implantação, sem ativação antecipada: novo usuário permanece convidado até definir senha; usuário já verificado recebe acesso ativo.
- Aceite do convite agora conclui a ativação do membership somente após a senha ser definida.
- Suporte ganhou detalhe operacional com solicitação, conversa, notas internas, mensagens ao cliente e transições contextuais auditadas.
- Catálogo de planos foi reconstruído com editor estruturado para produtos, preços, ciclo, trial, carência e limites; nenhuma regra comercial real foi inventada ou alterada.
- Asaas permanece desativado, sandbox-only e fail-closed, pronto para receber as credenciais futuramente.
Database:
- Migration `20260811170241_tenant_owner_invitation.sql` aplicada oficialmente no Supabase.
- RPC `admin_prepare_tenant_owner_invitation` é atômica, service-role-only, SECURITY DEFINER com search_path fixo e sem EXECUTE para PUBLIC/anon/authenticated.
- Prova transacional com rollback validou membership, papel tenant_admin e convite sem deixar resíduo.
Tests:
- Secret scan PASS: 341 arquivos rastreados.
- Migration validation PASS: 32 migrations ordenadas.
- Lint PASS; typecheck PASS; build client/server/Vercel PASS.
- Suite completa: 186 testes, 185 PASS, 0 FAIL, 1 live comercial SKIP explícito.
- Regressões cobertas: convite não ativo antes do aceite, preparação atômica, separação suporte interno/externo e catálogo sem JSON cru.
Preview:
- READY — `dpl_9SChC2ZNufX9CtpzRkKfM4EeAmnM`
- https://ordum-mhje7wvnl-ordum.vercel.app
- Alias: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
QA:
- Browser autenticado validou editor estruturado de planos, sem IDs/JSON expostos e com rótulos comerciais legíveis.
- Browser autenticado validou Suporte: abertura do chamado, nota interna privada, resposta visível ao cliente e mudança Novo → Em triagem com motivo.
- Browser autenticado validou Pessoas e acessos: formulário de convite do responsável com nome/e-mail e CTA de envio, sem diálogo nativo.
- Mobile 390x844 validou página da empresa, painel de acesso e formulário de convite com ações acessíveis.
- Fixture descartável de suporte removida: ticket 0, eventos 0, transições 0 e tenant 0.
- Deployment inspecionado sem respostas 5xx na janela do QA.
- Supabase Advisors: Security 58 (45 INFO, 13 WARN); Performance 218 (187 INFO, 31 WARN). A nova RPC não adicionou exposição pública.
Blockers:
- Valores, nomes e regras do catálogo comercial real dependem de decisão do responsável; a interface está pronta e nenhum valor fictício foi publicado.
- Entrega externa do e-mail de convite depende da configuração SMTP do projeto Supabase; criação, autorização e aceite no produto foram implementados e testados sem envio para destinatário real.
- Billing/Asaas aguarda credenciais futuras por decisão do responsável; nenhuma cobrança foi executada e nenhum segredo foi alterado.
- Assinatura eletrônica continua sem provedor; somente o registro auditável de assinatura externa está disponível.
Suggested next package:
- Revisão visual de produto do catálogo, convite e Suporte usando o Preview publicado.
- Definir e cadastrar planos, preços, trial e limites comerciais reais pelo novo editor.
- Configurar SMTP transacional antes do primeiro convite externo real.
- Quando disponível, cadastrar a API do Asaas Sandbox e executar a homologação E2E já preparada.
