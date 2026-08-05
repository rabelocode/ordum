# ORDUM — RECOVERY MASTER SPEC

**Arquivo normativo:** `docs/ORDUM_RECOVERY_MASTER_SPEC.md`  
**Projeto:** Ordum  
**Repositório:** `rabelocode/ordum`  
**Supabase oficial:** `ordum-production`  
**Project ref:** `plnciaxcujnvaermxmby`  
**Finalidade:** recuperação técnica, conclusão funcional e hardening do projeto existente.

> Este documento é uma especificação permanente. Ele não deve ser executado inteiro em uma única tarefa, sessão ou pull request.

---

## 1. Como usar esta especificação

A execução deve ocorrer nesta ordem:

1. auditoria e baseline;
2. core, autenticação, multi-tenancy e autorização;
3. Administração Ordum;
4. Integridade pública;
5. gestão interna dos casos;
6. ambiente demo isolado;
7. Ordum Pessoas e Talentos;
8. hardening, documentação, preview e produção.

Nenhuma fase posterior deve começar antes de a fase anterior possuir:

- alterações revisáveis;
- testes executados;
- riscos conhecidos documentados;
- migrations identificadas e testadas;
- ausência de regressões críticas conhecidas;
- aprovação humana quando houver impacto em produção.

Durante a auditoria é proibido:

- aplicar migrations;
- executar SQL de escrita no Supabase remoto;
- alterar configurações da Vercel;
- realizar deploy;
- modificar dados de produção;
- usar a chave privilegiada para mutations.

Durante a implementação:

- usar branch e worktree próprios;
- não trabalhar diretamente em `main`;
- testar migrations fora de produção;
- usar deploy de preview;
- exigir aprovação manual antes de escrita em produção;
- registrar o commit exato implantado.

---

## 2. Objetivo

Continuar o desenvolvimento da Ordum a partir do estado real do projeto.

Esta tarefa não é uma reconstrução, uma prova de conceito, um redesenho visual, uma migração de framework ou a criação de outro banco.

O objetivo é:

- preservar o que já funciona;
- corrigir integrações incompletas;
- remover mocks e simulações indevidas;
- conectar frontend, backend e Supabase;
- tornar o Admin Ordum operacional;
- transformar a Ordum Integridade em uma solução completa de gestão de casos;
- fortalecer multi-tenancy, autorização, auditoria e segurança;
- criar ambiente demo isolado;
- testar os fluxos críticos;
- manter documentação fiel ao sistema real.

Quando a fase for de implementação, execute alterações reais. Não responda apenas com recomendações ou exemplos.

---

## 3. Contexto oficial

### 3.1 Repositório

- GitHub: `rabelocode/ordum`
- Branch principal: `main`
- Registrar o HEAD antes de alterar arquivos.
- Criar branch específica.
- Preservar histórico e migrations aplicadas.
- Não reescrever o projeto do zero.

### 3.2 Arquitetura e deploy

Preservar:

- React 19;
- TypeScript;
- Vite;
- Tailwind CSS 4;
- Express;
- `server.ts`;
- handler da Vercel;
- rotas `/api`;
- navegação hash existente;
- Supabase Auth, PostgreSQL e Storage;
- Zod;
- Playwright;
- Sentry;
- PostHog;
- Asaas Sandbox;
- Vercel Functions.

Não migrar para Next.js ou outro framework.

Corrigir resíduos de scaffold, nomes genéricos e dependências autorreferentes somente quando a alteração for comprovadamente segura.

### 3.3 Supabase

- Projeto: `ordum-production`
- Ref: `plnciaxcujnvaermxmby`
- Região: `sa-east-1`
- PostgreSQL: 17

Variáveis esperadas:

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_URL`;
- `SUPABASE_SECRET_KEY`.

Regras:

- `SUPABASE_SECRET_KEY` é exclusivamente server-side;
- nunca importar o cliente privilegiado em código do browser;
- nunca criar secret em variável `VITE_*` ou `NEXT_PUBLIC_*`;
- nunca imprimir secrets, tokens ou segredos de denúncias;
- nunca guardar secrets em `localStorage` ou `sessionStorage`;
- nunca versionar secrets;
- não rotacionar chaves automaticamente nesta tarefa;
- se houver evidência de exposição, registrar o risco sem imprimir valores.

---

## 4. Regras inegociáveis

Não:

- criar outro Supabase, Firebase ou SQLite;
- criar arquitetura paralela;
- substituir o banco por armazenamento local;
- duplicar tabelas porque o frontend não está alinhado;
- apagar dados ou migrations;
- desabilitar RLS para “fazer funcionar”;
- usar `service_role` no navegador;
- conceder poderes globais a `tenant_admin`;
- confiar em menu, rota, URL, localStorage ou estado React como autorização;
- liberar policies amplas como correção rápida;
- expor operações administrativas no browser;
- transformar todo o sistema em CRUD direto;
- criar dados fictícios fora do ambiente demo;
- mostrar KPIs inventados;
- manter botão decorativo;
- declarar funcionalidade concluída somente porque a tela abre;
- refazer identidade visual ou navegação;
- aplicar migration destrutiva diretamente em produção;
- documentar uma intenção como funcionalidade pronta.

Faça alterações aditivas e compatíveis com a arquitetura atual.

---

## 5. Definição de funcionalidade concluída

Uma funcionalidade só está concluída quando:

1. a interface existe;
2. a ação chama uma operação real;
3. os dados persistem;
4. backend ou RLS validam a autorização;
5. erros reais são tratados;
6. loading, empty state e retry existem;
7. há auditoria quando aplicável;
8. o resultado sobrevive ao refresh;
9. funciona em ambiente equivalente à produção;
10. há teste automatizado ou procedimento reproduzível;
11. a documentação reflete o comportamento real.

Não são conclusões válidas:

- estado alterado apenas no React;
- tabela sem fluxo operacional;
- tela com dados hardcoded;
- menu escondido sem proteção do backend;
- build verde sem teste funcional.

---

## 6. Arquitetura obrigatória

### 6.1 Fronteiras

- `site`: conteúdo público e captação;
- `core`: auth, tenant, memberships, RBAC, arquivos, auditoria e serviços compartilhados;
- `solutions/integridade`;
- `solutions/pessoas`;
- `solutions/talentos`;
- `ordum-admin`: administração global da Ordum.

### 6.2 Multi-tenancy

auth.users
→ profiles
→ memberships
→ tenants

RBAC dos clientes:

memberships
→ membership_roles
→ roles
→ role_permissions
→ permissions


Soluções contratadas:

tenants
→ tenant_solutions
→ solutions

Administração global:

- `platform_members`;
- `platform_roles`;
- `platform_permissions`;
- `platform_role_permissions`;
- `platform_teams`;
- `platform_team_members`;
- demais estruturas `platform_*`.

Não misturar:

- membro da plataforma;
- administrador do tenant;
- membro do tenant;
- denunciante anônimo.

`ADMIN_EMAILS` pode servir somente como bootstrap controlado, nunca como autoridade permanente.

---

## 7. Auditoria inicial obrigatória

Antes de implementar:

1. registrar o HEAD;
2. rodar os testes atuais sem corrigir previamente;
3. mapear rotas públicas e protegidas;
4. mapear telas do Admin e workspaces;
5. mapear botões e ações;
6. localizar mocks, fixtures, dados hardcoded e mutations locais;
7. mapear chamadas Supabase em componentes;
8. mapear endpoints Express;
9. mapear RPCs, migrations, policies, grants, triggers e buckets;
10. rodar advisors de segurança e performance;
11. revisar logs de browser, API, Vercel e Supabase.

Produzir matriz:

| Área | Tela | Ação | Backend | Persiste | Autorizada | Auditada | Testada | Estado |
|---|---|---|---|---|---|---|---|---|

Classificar achados como:

- comprovado;
- provável;
- não confirmado;
- falso positivo;
- comportamento intencional.

Na fase de auditoria, não realizar alterações funcionais.

---

## 8. Serviços e fronteira server-side

Não espalhar consultas Supabase pelos componentes.

Organizar ou aproveitar serviços por domínio:

- `services/auth`;
- `services/platform`;
- `services/tenants`;
- `services/permissions`;
- `services/integrity`;
- `services/people`;
- `services/talents`;
- `services/commercial`;
- `services/billing`;
- `services/files`;
- `services/audit`;
- `services/demo`.

Utilizar:

- tipos gerados do schema real;
- `createClient<Database>()`;
- Zod;
- tratamento consistente de erros;
- request ID;
- idempotência;
- transações;
- concorrência otimista quando necessária;
- índices compatíveis com consultas reais.

O backend Express/Vercel deve proteger:

- administração global;
- provisionamento;
- gestão de usuários;
- contratos e billing;
- Asaas;
- operações privilegiadas;
- Integridade sensível;
- upload, download e exportação;
- break-glass;
- reset do ambiente demo.

Cada endpoint protegido deve:

1. validar JWT;
2. obter o usuário real;
3. validar membership ou platform membership;
4. validar status;
5. validar permissão;
6. validar escopo;
7. validar tenant;
8. executar a operação;
9. registrar auditoria;
10. retornar somente os campos necessários.

---

## 9. RLS e policies

Não corrigir alertas com policies genéricas.

Classificar cada tabela:

### A. Browser tenant-scoped

Usar policies com:

- membership ativa;
- tenant real;
- solução contratada;
- permissão;
- escopo;
- assignment ou ownership;
- `USING`;
- `WITH CHECK`.

### B. Administração global

Manter inacessível ao browser comum. Usar backend após validação de `platform_members`, role, permission, equipe e escopo.

### C. Server-only

Sem grants para `anon` e `authenticated`. Inclui segredos, webhooks, rate limits, billing interno, filas e reconciliação.

### D. Públicos deliberados

Sem acesso direto às tabelas. Usar endpoint ou RPC mínima.

Testar com dois tenants, usuário suspenso, usuário sem solução, usuário sem permissão, alteração manual de IDs, URL direta, Storage, exportação e download.

Não validar somente menus.

---

## 10. Administração Ordum

Revisar toda a área `/#/admin` e torná-la funcional de ponta a ponta.

### 10.1 Usuários internos

- listar;
- convidar;
- ativar;
- suspender;
- desativar;
- alterar role;
- alterar vínculo;
- incluir e remover de equipes;
- histórico;
- impedir autoelevação;
- preservar ao menos um administrador válido.

### 10.2 Equipes

- criar;
- editar;
- arquivar;
- definir gestor;
- gerir membros;
- definir escopo;
- limitar leads e clientes visíveis;
- definir alçadas;
- auditar.

### 10.3 Roles e permissões

- listagem e matriz;
- criação controlada;
- edição;
- alçadas;
- distinção platform/tenant;
- proteção contra escalada de privilégio.

### 10.4 Leads

- listar, filtrar e pesquisar;
- detalhe e edição;
- classificação e score;
- equipe e owner;
- contatos e atividades;
- próxima ação;
- status, reabertura, ganho e perda;
- motivo;
- iniciar demo e proposta;
- histórico.

### 10.5 Demos comerciais

`commercial_demos` continua sendo o processo comercial:

- solicitação;
- agendamento;
- aprovação;
- ativação;
- expiração;
- revogação;
- cancelamento;
- reagendamento;
- no-show;
- resultado;
- próxima ação.

Não confundir com o ambiente demo isolado.

### 10.6 Propostas e contratos

Implementar versionamento, soluções, planos, preços, descontos, validade, aprovação, envio, aceite, rejeição, expiração, histórico, criação de contrato, vigência, billing, renovação, suspensão e cancelamento.

### 10.7 Clientes, planos, onboarding, CS e suporte

Tornar funcionais:

- ciclo de vida do tenant;
- soluções contratadas;
- billing;
- usuários;
- risco;
- customer success;
- onboarding;
- tickets;
- SLA;
- health score;
- renovação;
- expansão;
- churn;
- auditoria.

### 10.8 Asaas

Preservar a integração existente e garantir:

- chamadas somente no backend;
- idempotência;
- validação de webhook;
- logs sanitizados;
- reconciliação;
- retry;
- histórico;
- nenhuma operação real para tenant demo.

---

## 11. Ordum Integridade — definição oficial

A Ordum Integridade é exclusivamente anônima.

Não existe modalidade identificada.

O denunciante:

- não cria conta;
- não faz login;
- não informa identidade obrigatoriamente;
- recebe protocolo;
- recebe segredo;
- acompanha o relato;
- envia e recebe mensagens;
- envia anexos quando habilitado.

Não vincular denúncia a `auth.users`, `profiles`, `memberships`, e-mail, telefone ou usuário autenticado.

---

## 12. Canais e formulários

O tenant deve configurar:

- nome e slug;
- status;
- textos e instruções;
- privacidade e emergência;
- categorias e subcategorias;
- perguntas e condicionais;
- campos obrigatórios;
- anexos e limites;
- idiomas;
- confirmação;
- prazos;
- mensagens;
- roteamento;
- SLA;
- responsáveis;
- comitês;
- escopos.

Criar onboarding para o primeiro canal.

Não hardcode categorias. Defaults devem ser persistidos e editáveis.

## 13. Envio público seguro

Revisar:

- `get_integrity_form`;
- `submit_integrity_report`;
- `read_integrity_report`;
- `post_integrity_reporter_message`.

Preferir entrada pública pelo backend Express com Zod, rate limiting e bot protection.

Caso uma RPC permaneça pública:

- fixar `search_path`;
- revogar `EXECUTE` de `PUBLIC`;
- conceder somente ao role necessário;
- retornar dados mínimos;
- não retornar hash ou IDs internos desnecessários;
- impedir acesso entre casos.

### Protocolo e segredo

- protocolo aleatório e não sequencial;
- alta entropia;
- segredo exibido uma única vez;
- armazenar somente hash;
- comparação resistente a timing;
- segredo fora de logs, URL, analytics e storage local;
- limitar tentativas;
- aplicar atraso progressivo;
- bloquear brute force.

### Rate limiting

Aplicar em:

- envio;
- leitura;
- tentativa de segredo;
- mensagens;
- upload.

Não persistir IP bruto. Quando necessário para abuso, usar HMAC rotativo, retenção curta e tabela server-only, sem vínculo direto com o caso.

---

## 14. Anonimato e telemetria

Nas rotas públicas da Integridade:

- desabilitar PostHog e replay;
- não registrar formulário, relato, protocolo, segredo ou mensagens;
- não enviar conteúdo ao Sentry;
- não criar sessão Supabase;
- não vincular a usuário;
- não enviar dados sensíveis a analytics.

No Sentry:

- sanitizar body, headers, breadcrumbs e query strings.

No backend:

- não logar body;
- não incluir relato em exceptions;
- usar request ID independente;
- registrar apenas métricas agregadas.

Documentar os limites técnicos da expressão “100% anônimo”.

---

## 15. Anexos e evidências

Implementar:

- bucket privado;
- nenhuma listagem pública;
- nomes aleatórios;
- paths isolados;
- URLs assinadas curtas;
- tamanho e tipo validados;
- MIME real;
- bloqueio de executáveis e macros;
- sanitização de nome;
- remoção de EXIF;
- remoção de metadados quando possível;
- quarentena;
- hash SHA-256;
- auditoria de upload, visualização, download e exclusão;
- cadeia de custódia.

Criar interface para scanner de malware.

Sem scanner:

- não marcar arquivo como verificado;
- restringir tipos;
- permitir desabilitar anexos;
- registrar bloqueador para produção plena.

Admin global não recebe acesso automático.

---

## 16. Gestão completa dos casos

A Integridade não é apenas uma caixa de entrada.

Aproveitar as estruturas existentes e criar migrations aditivas para o que faltar.

Implementar ou completar:

- comitês e membros;
- escopos;
- roteamento;
- participantes e responsáveis;
- conflitos e impedimentos;
- tarefas, prazos e SLA;
- notas internas;
- entrevistas e diligências;
- evidências e achados;
- pareceres;
- decisões e deliberações;
- medidas corretivas;
- planos de ação;
- reabertura e encerramento;
- trilha de acesso;
- exportações e downloads.

### Workflow mínimo

- recebido;
- triagem;
- aguardando classificação;
- em análise;
- investigação;
- aguardando informações;
- aguardando denunciante;
- aguardando deliberação;
- plano de ação;
- monitoramento;
- resolvido;
- encerrado;
- arquivado;
- reaberto.

Transições devem validar status atual, destino, permission, campos obrigatórios, motivo, responsável, pendências, versão e auditoria.

### Classificação e investigação

Permitir risco, urgência, impacto, probabilidade, criticidade, pessoas ou áreas, unidade, departamento, recorrência, preservação de evidências, ação imediata, tarefas, entrevistas, diligências, achados, parecer e decisão.

---

## 17. Comitês, escopo e conflito de interesse

O cliente pode atribuir casos a:

- comitê de ética;
- compliance;
- RH;
- jurídico;
- auditoria;
- diretoria;
- gerência;
- área específica;
- prestador externo.

Configuração por tenant, canal, categoria, unidade, departamento, risco, criticidade, pessoa citada e nível hierárquico.

Acesso depende de solução ativa, membership ativa, permissão, escopo, assignment e ausência de conflito.

`tenant_admin` não lê automaticamente todos os casos.

Implementar:

- declaração de conflito;
- impedimento;
- remoção imediata de acesso;
- reatribuição;
- motivo;
- substituto;
- bloqueio de pessoa citada;
- auditoria de tentativa negada.

Aplicar no backend e no banco.

---

## 18. Permissões da Integridade

Criar ou revisar permissões equivalentes a:

- `integrity.channel.configure`;
- `integrity.category.configure`;
- `integrity.routing.configure`;
- `integrity.case.list`;
- `integrity.case.view_metadata`;
- `integrity.case.view_content`;
- `integrity.case.assign`;
- `integrity.case.triage`;
- `integrity.case.investigate`;
- `integrity.case.message_reporter`;
- `integrity.case.manage_tasks`;
- `integrity.case.manage_evidence`;
- `integrity.case.register_findings`;
- `integrity.case.deliberate`;
- `integrity.case.decide`;
- `integrity.case.manage_actions`;
- `integrity.case.close`;
- `integrity.case.reopen`;
- `integrity.case.export`;
- `integrity.case.audit`;
- `integrity.case.break_glass`.

Evitar uma permissão ampla única.

---

## 19. Break-glass e auditoria

A Ordum não visualiza automaticamente o conteúdo dos clientes.

Acesso excepcional exige permission específica, motivo, duração, aprovação quando configurada, auditoria crítica, notificação quando apropriada, revogação automática e escopo de um caso.

Auditar de forma append-only:

- criação;
- visualização de metadados e conteúdo;
- download e exportação;
- status e classificação;
- assignment;
- conflito;
- break-glass;
- mensagens;
- notas;
- tarefas;
- evidências;
- parecer;
- decisão;
- plano;
- encerramento;
- reabertura;
- acesso negado.

Não gravar o relato integral na auditoria.

---

## 20. Painel da Integridade

Preservar identidade visual.

### Dashboard

Usar dados reais para novos casos, status, risco, criticidade, categorias, unidades, canais, SLA, atrasos, tempo de triagem, tempo de resolução, recorrência, planos e reaberturas.

### Fila

Implementar busca, filtros, ordenação, views salvas, paginação, owner, equipe, comitê, status, risco, SLA, categoria, escopo, casos sem responsável e conflitos.

### Detalhe do caso

Organizar em:

- resumo;
- relato;
- classificação;
- comunicação anônima;
- responsáveis;
- tarefas;
- investigação;
- entrevistas;
- evidências;
- achados;
- parecer;
- deliberação;
- plano de ação;
- histórico;
- auditoria;
- acesso.

Implementar skeleton, empty state, erro, retry, sucesso, confirmação, conflito, SLA e concorrência.

---

## 21. Ambiente demo isolado

Separado de `commercial_demos`.

Requisitos:

- tenant demo identificado;
- dados exclusivamente fictícios;
- nenhuma conexão com tenants reais;
- nenhuma cobrança ou Asaas;
- nenhum webhook financeiro;
- nenhum e-mail real;
- Storage isolado;
- usuários e roles demo;
- Integridade, Pessoas e Talentos;
- níveis de acesso;
- dashboards marcados como demo.

### Reset

Implementar dataset versionado, reset idempotente, limpeza apenas do tenant demo, recriação, preservação do schema, execução periódica, endpoint protegido, reset manual autorizado, auditoria e teste de que tenants reais não foram alterados.

Usar Vercel Cron ou mecanismo compatível. Não criar outro banco.

---

## 22. Pessoas e Talentos

### Pessoas

Validar de ponta a ponta:

- perfil;
- comunicados;
- leitura;
- documentos;
- atribuição e aceite;
- holerites;
- solicitações e eventos;
- reuniões com RH;
- permissions;
- Storage;
- isolamento.

### Talentos

Validar:

- site de carreiras;
- publicação;
- vagas e etapas;
- candidatos e candidaturas;
- testes;
- entrevistas;
- feedback;
- banco de talentos;
- consentimento;
- anexos;
- isolamento.

Fluxos públicos devem ser protegidos contra abuso.

---

## 23. Auth, Vercel e observabilidade

Testar Google OAuth, callback, sessão, refresh, logout, expiração, usuário suspenso, profiles, zero/uma/múltiplas memberships, membership inativa, active tenant, troca de tenant e rotas protegidas.

Revisar headers, CSP, CORS, cookies, cache, body limits, timeouts, métodos, source maps, stack traces e cron.

Rotas da Integridade devem usar:

```http
Cache-Control: no-store
```

Preservar Sentry e PostHog para áreas não sensíveis, com sanitização central.

Nunca enviar relato, mensagem, segredo, hash, evidência, holerite, payload bruto do Asaas, token, authorization ou cookie.

---

## 24. Migrations

Para cada alteração:

1. criar migration oficial e descritiva;
2. não editar migration já aplicada;
3. evitar destruição;
4. revisar índices, `search_path`, grants e policies;
5. testar fora de produção;
6. regenerar tipos;
7. rodar advisors;
8. documentar resultado.

Antes de produção:

- lint;
- typecheck;
- testes;
- validação das migrations;
- revisão do diff;
- confirmação de ausência de perda de dados.

---

## 25. Testes obrigatórios

Executar os scripts existentes e criar novos apenas quando necessário:

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run test:e2e
npm run test:migrations
npm run check:secrets
npm run test:live-queries
```

Cobrir:

- Admin e platform permissions;
- leads, equipes, demos, propostas, contratos, clientes, billing, onboarding e suporte;
- canal público, protocolo, segredo, brute force, mensagens, payloads e telemetria;
- roteamento, conflito, workflow, tarefas, evidências, decisão, plano, encerramento e auditoria;
- dois tenants e tentativas de acesso cruzado;
- Storage e signed URLs;
- reset do ambiente demo sem tocar em tenants reais.

Não usar screenshot como única evidência.

---

## 26. Documentação

Ler todos os MDs existentes antes de alterar.

Atualizar `ORDUM_00` a `ORDUM_08` quando aplicável.

Criar ou atualizar:

- `docs/ORDUM_SECURITY_READINESS.md`;
- `docs/ORDUM_INTEGRIDADE_CASE_MANAGEMENT.md`;
- `docs/ORDUM_DEMO_ENVIRONMENT.md`;
- `docs/ORDUM_THREAT_MODEL.md`;
- `docs/ORDUM_RUNBOOK.md`.

Documentar arquitetura, rotas, auth, multi-tenancy, RBAC, platform admin, tenant admin, server boundary, env vars sem valores, Supabase, RLS, Storage, Asaas, Integridade, conflitos, auditoria, anonimato, telemetria, anexos, demo, testes, deploy, incident response, backup, restauração, riscos e pendências.

Nunca incluir secrets.

---

## 27. Ordem de execução

### Fase 1 — Auditoria e baseline

Sem alterações funcionais e sem escrita em produção.

### Fase 2 — Core

Auth, profiles, memberships, active tenant, RBAC, entitlements, guards, platform authorization, services e types.

### Fase 3 — Administração

Endpoints, serviços, telas, mutations, auditoria e testes.

### Fase 4 — Integridade pública

Canal, formulário, envio, protocolo, segredo, acompanhamento, mensagens, rate limiting, telemetria e anexos.

### Fase 5 — Gestão dos casos

Workflow, assignments, comitês, conflitos, tarefas, investigação, evidências, parecer, decisão, planos, auditoria e painel.

### Fase 6 — Demo

Tenant, dataset, users, roles, bloqueios, reset, cron e testes.

### Fase 7 — Pessoas e Talentos

Remover mocks, completar fluxos e testar isolamento.

### Fase 8 — Hardening

Advisors, RLS, Storage, telemetria, backup, restauração, build, E2E, docs, preview, smoke test e produção.

---

## 28. Divisão recomendada em PRs

1. Core e autorização;
2. usuários, equipes e permissions;
3. Admin comercial;
4. clientes, planos e billing;
5. Integridade pública;
6. gestão dos casos;
7. anexos, auditoria e break-glass;
8. ambiente demo;
9. Pessoas e Talentos;
10. hardening e release.

Não implementar este arquivo inteiro em um único PR.

---

## 29. Critérios para “pronto”

Não usar “100% concluído”, “seguro”, “pronto para produção”, “pronto para denúncias reais” ou “tudo funcionando” sem evidências.

Para armazenar denúncias reais sensíveis, exigir:

- isolamento multi-tenant testado;
- permissions e conflitos testados;
- RPCs públicas endurecidas;
- rate limiting e proteção contra brute force;
- telemetria sanitizada;
- Storage privado;
- anexos controlados;
- auditoria de visualização e exportação;
- backup e restauração testados;
- runbook;
- scanner de malware ou anexos desabilitados;
- smoke test;
- revisão de segurança documentada.

Pentest e validação jurídica são validações externas. Testes internos não as substituem.

---

## 30. Relatório final obrigatório

Entregar:

- baseline e commit inicial;
- branch;
- problemas reproduzidos;
- funcionalidades realmente implementadas;
- arquivos alterados;
- migrations, policies, grants, functions e índices;
- resultados por módulo do Admin;
- resultados da Integridade;
- ambiente demo;
- segurança;
- testes;
- preview e produção;
- MDs atualizados;
- pendências classificadas em bloqueador, alta, média, baixa e validação externa;
- veredito honesto: protótipo, demo, piloto fictício, piloto controlado, apto a dados reais ou produção comercial.

---

## 31. Regra final

Não criar uma nova Ordum.

Fazer a Ordum atual funcionar corretamente.

Preservar o que está bom, eliminar simulação indevida, conectar interface, API e banco, fazer o Admin executar operações reais e transformar a Integridade em uma solução completa de gestão de casos.

Anonimato, permissions, conflito de interesse, anexos, auditoria, demo, multi-tenancy e segurança server-side são requisitos arquiteturais.

Build verde não encerra o trabalho.

A fase contratada só termina quando funciona ponta a ponta, está testada, documentada, sem regressões críticas conhecidas e com riscos residuais explicitados.

# 37. PROTOCOLO OBRIGATÓRIO DE CONTINUIDADE ENTRE AGENTES

Este projeto poderá ser trabalhado por diferentes agentes, incluindo Gemini Antigravity e OpenAI Codex.

Por isso, toda solicitação executada por qualquer agente deve gerar documentação de handoff suficiente para que outro agente retome o trabalho sem depender do histórico da conversa, da memória do agente anterior ou de suposições.

Este protocolo é obrigatório em todas as tarefas, inclusive correções pequenas.

## 37.1 Diretório oficial de handoff

Manter no repositório:

```text
docs/AI_HANDOFF/
├── INDEX.md
├── CURRENT_STATE.md
├── DECISIONS.md
├── KNOWN_ISSUES.md
├── ENVIRONMENT_NOTES.md
└── TASKS/
```

Não criar diretórios paralelos com a mesma finalidade.

## 37.2 Leitura obrigatória antes de qualquer tarefa

Antes de alterar código, banco, configuração ou documentação, o agente deve ler:

1. `docs/ORDUM_RECOVERY_MASTER_SPEC.md`;
2. `docs/AI_HANDOFF/INDEX.md`;
3. `docs/AI_HANDOFF/CURRENT_STATE.md`;
4. `docs/AI_HANDOFF/DECISIONS.md`;
5. `docs/AI_HANDOFF/KNOWN_ISSUES.md`;
6. `docs/AI_HANDOFF/ENVIRONMENT_NOTES.md`;
7. os três registros mais recentes de `docs/AI_HANDOFF/TASKS/`;
8. os arquivos `ORDUM_*.md` diretamente relacionados ao escopo.

O agente deve comparar essa documentação com o estado real do repositório.

Se houver divergência entre documentação e código:

- o código e o banco reais devem ser inspecionados;
- a divergência deve ser registrada;
- a documentação deve ser corrigida ao final;
- não criar arquitetura paralela para contornar a inconsistência.

## 37.3 Registro obrigatório para cada solicitação

Cada solicitação deve gerar um arquivo próprio em:

```text
docs/AI_HANDOFF/TASKS/
```

Formato obrigatório do nome:

```text
YYYY-MM-DD_HHMM_<agente>_<slug-da-tarefa>.md
```

Exemplos:

```text
2026-08-04_1910_antigravity_admin-users-audit.md
2026-08-08_0930_codex_integrity-rate-limit.md
```

Usar data e hora local do projeto quando disponível.

Não sobrescrever arquivos de tarefas anteriores.

## 37.4 Conteúdo obrigatório do registro da tarefa

Cada arquivo de tarefa deve conter:

```md
# Identificação

- Data e hora:
- Agente:
- Modelo, quando conhecido:
- Solicitante:
- Repositório:
- Branch:
- Worktree:
- Commit inicial:
- Commit final:
- Pull request:
- Ambiente utilizado:

# Solicitação recebida

Copiar ou resumir fielmente a solicitação do usuário.

# Escopo autorizado

Listar exatamente o que poderia ser alterado.

# Fora do escopo

Listar o que não poderia ser alterado.

# Estado encontrado

Descrever o comportamento real antes da mudança.

# Diagnóstico

Registrar causas comprovadas, hipóteses descartadas e riscos.

# Decisões técnicas

Registrar decisões tomadas e sua justificativa.

# Implementação

Descrever o que foi realmente implementado.

# Arquivos alterados

Listar todos os caminhos.

# Banco de dados

Registrar:

- migrations criadas;
- migrations aplicadas;
- tabelas afetadas;
- funções;
- triggers;
- policies;
- grants;
- índices;
- dados alterados;
- ambiente em que a alteração ocorreu.

# APIs e integrações

Registrar endpoints, RPCs, webhooks, serviços externos e contratos modificados.

# Variáveis de ambiente

Registrar somente os nomes das variáveis:

- adicionadas;
- removidas;
- renomeadas;
- necessárias;
- pendentes de configuração.

Nunca registrar valores ou segredos.

# Segurança

Registrar:

- mudanças de autorização;
- RLS;
- permissões;
- grants;
- secrets;
- logs;
- telemetria;
- riscos residuais.

# Testes executados

Para cada teste:

- comando;
- ambiente;
- resultado;
- quantidade;
- falhas;
- observações.

# Validação funcional

Registrar fluxos testados ponta a ponta.

# Deploy

Registrar:

- preview;
- URL ou identificador seguro;
- commit implantado;
- produção;
- smoke tests;
- rollback disponível.

# Pendências

Listar somente pendências reais.

# Próximo passo recomendado

Indicar a próxima ação técnica de maior impacto.

# Instruções para o próximo agente

Descrever exatamente:

- onde continuar;
- o que não refazer;
- arquivos prioritários;
- riscos;
- comandos úteis;
- validações ainda necessárias.

# Rollback

Explicar como desfazer a mudança com segurança.

# Evidências

Referenciar commits, PRs, migrations, testes, screenshots ou artifacts sem incluir dados sensíveis.
```

## 37.5 Registro no início e no final

No início da tarefa, o agente deve criar o arquivo com:

- identificação;
- solicitação;
- escopo;
- fora do escopo;
- commit inicial;
- estado inicial conhecido.

Ao finalizar, deve completar todas as seções restantes.

Não deixar o registro como rascunho incompleto sem indicar claramente que a tarefa foi interrompida.

## 37.6 Atualização dos arquivos consolidados

Ao final de cada solicitação, atualizar:

### `docs/AI_HANDOFF/INDEX.md`

Adicionar uma linha com:

- data;
- agente;
- tarefa;
- branch;
- commit final;
- PR;
- status;
- link relativo para o registro.

### `docs/AI_HANDOFF/CURRENT_STATE.md`

Manter o retrato atual do projeto:

- commit de referência;
- módulos operacionais;
- módulos parciais;
- módulos simulados;
- migrations mais recentes;
- deploy atual;
- testes atuais;
- riscos bloqueadores;
- próximo passo.

Este arquivo representa apenas o estado atual, não o histórico completo.

### `docs/AI_HANDOFF/DECISIONS.md`

Registrar decisões arquiteturais duradouras.

Formato recomendado:

```md
## ADR-XXXX — Título

- Data:
- Status:
- Contexto:
- Decisão:
- Motivo:
- Consequências:
- Alternativas rejeitadas:
- Agente:
- Commit:
```

Não registrar decisões temporárias como arquitetura permanente.

### `docs/AI_HANDOFF/KNOWN_ISSUES.md`

Manter problemas ainda abertos com:

- ID;
- severidade;
- módulo;
- descrição;
- evidência;
- workaround;
- bloqueio;
- responsável;
- status.

### `docs/AI_HANDOFF/ENVIRONMENT_NOTES.md`

Registrar somente informações não secretas sobre:

- ambientes;
- nomes de variáveis;
- comandos;
- serviços conectados;
- limitações;
- configuração manual pendente.

Nunca incluir tokens, senhas ou chaves.

## 37.7 Git e commits

A documentação de handoff faz parte da tarefa.

Antes de considerar a solicitação concluída:

- o arquivo da tarefa deve estar completo;
- os arquivos consolidados devem estar atualizados;
- a documentação deve entrar no mesmo PR;
- o commit final ou um commit específico deve incluir o handoff;
- o relatório final deve mencionar os arquivos de handoff alterados.

Uma tarefa sem handoff não está concluída.

## 37.8 Continuidade entre Gemini e Codex

Quando o Gemini Antigravity executar uma tarefa:

- deve registrar tudo pelo protocolo;
- deve indicar alterações não commitadas;
- deve registrar comandos e testes;
- deve registrar migrations aplicadas ou não aplicadas;
- deve registrar qualquer configuração manual necessária;
- deve deixar instruções específicas para o Codex.

Quando o Codex retomar:

- deve ler o protocolo;
- verificar o branch e o commit;
- comparar documentação e código;
- não repetir trabalho concluído;
- não presumir que documentação antiga ainda é verdadeira;
- atualizar os mesmos arquivos ao final.

Nenhum agente deve depender exclusivamente de:

- histórico de chat;
- memória interna;
- artifacts fora do repositório;
- mensagens não versionadas;
- conhecimento implícito.

## 37.9 Tarefas interrompidas ou parcialmente concluídas

Se uma tarefa for interrompida:

- registrar status `INTERROMPIDA` ou `PARCIAL`;
- listar alterações já feitas;
- listar arquivos não commitados;
- listar testes não executados;
- informar se alguma migration foi aplicada;
- informar se houve deploy;
- indicar o ponto exato de retomada;
- não marcar como concluída.

## 37.10 Proibição de informações sensíveis

Os arquivos de handoff nunca podem conter:

- valores de secrets;
- tokens;
- senhas;
- segredos de denúncia;
- hashes de segredo;
- conteúdo de denúncias;
- dados pessoais reais;
- payloads sensíveis;
- chaves Asaas;
- cookies;
- authorization headers;
- dados de produção usados como exemplo.

Usar identificadores sanitizados ou fictícios.

## 37.11 Critério de aceite do handoff

O handoff só é válido quando um agente que não participou da tarefa consegue responder, apenas lendo o repositório:

- o que foi solicitado;
- o que existia antes;
- o que foi alterado;
- por que foi alterado;
- quais arquivos mudaram;
- quais migrations existem;
- o que foi testado;
- o que foi implantado;
- quais riscos permanecem;
- onde continuar;
- como reverter.

Se qualquer uma dessas respostas depender do histórico da conversa, o handoff está incompleto.

---

# 38. REGRA FINAL DE CONTINUIDADE

Toda solicitação executada por Gemini Antigravity, Codex ou outro agente deve deixar registro versionado no repositório.

O registro deve ser lido obrigatoriamente pelo próximo agente.

Não considerar uma tarefa concluída sem:

- arquivo individual da tarefa;
- atualização do índice;
- atualização do estado atual;
- atualização das decisões, problemas e ambiente quando aplicável;
- commits e testes registrados;
- instrução de retomada;
- ausência de segredos.

O repositório, e não a memória de um agente, é a fonte oficial da continuidade do desenvolvimento.
