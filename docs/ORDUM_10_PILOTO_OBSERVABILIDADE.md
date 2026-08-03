# ORDUM 10 — Piloto, observabilidade e métricas

## Estado verificado em 2026-08-03

- Supabase remoto saudável, com migrations existentes e RLS habilitada nas tabelas públicas.
- Vercel em produção no projeto conectado; todas as variáveis encontradas estavam inicialmente restritas a Production.
- GitHub sem workflow de CI, issues ou pull requests abertos no início desta execução.
- PostHog conectado à organização Ordum, projeto `Default project`, sem eventos de produto ingeridos.
- Sentry sem projeto/token acessível nesta sessão; o conector disponível é somente leitura e depende de configuração externa.
- Linear não ficou disponível na sessão após a solicitação de instalação do plugin.

## Bloqueadores e riscos encontrados

1. `dist/server.cjs` e `dist/server.cjs.map` eram publicados como arquivos estáticos. O servidor local agora é gerado em `build/`, fora de `outputDirectory` da Vercel.
2. O workspace mostrava números, atividades e conformidade fictícios. A home agora deriva contagens do Supabase sob RLS e usa estados explicativos quando o dado não existe ou o escopo não permite leitura.
3. O frontend consultava chaves de permissão antigas. As chaves foram alinhadas ao catálogo remoto (`integrity.*`, `people.*`, `talents.*`).
4. `tenant_admin` tinha bypass visual sem as permissões equivalentes no banco. A migration concede somente permissões tenant-scoped e mantém separação total de `platform_members`.
5. Tenants em trial eram excluídos da seleção do workspace. O provider agora aceita `active` e `trial`.
6. A aplicação não tinha CI, sanitização de telemetria ou error boundary global.

## Observabilidade com Sentry

Arquivos centrais: `src/lib/observability.ts`, `src/server/observability.ts`, `src/lib/telemetryPrivacy.ts`.

- inicialização opcional e segura quando não configurada;
- release associada ao SHA do Git/Vercel e ambiente associado ao deploy;
- `sendDefaultPii` e tracing desabilitados;
- request body, cookies, headers, query string e campos sensíveis removidos;
- somente o identificador técnico do usuário pode permanecer;
- telas de erro não exibem stack, payload ou mensagem bruta;
- source maps do cliente são ocultos, enviados e removidos do artefato somente quando token, organização e projeto estão configurados.

Pendência externa: cadastrar `VITE_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` e um `SENTRY_AUTH_TOKEN` de build na Vercel. A criação/seleção de organização ou plano não foi feita silenciosamente.

## Analytics com PostHog

Arquivos centrais: `src/lib/analytics.ts`, `src/server/analytics.ts`, `src/lib/telemetryPrivacy.ts`.

- autocapture, pageview automático e session replay não são utilizados pelo código;
- analytics do navegador exige consentimento explícito e permite recusa;
- somente propriedades da allowlist são enviadas: `environment`, `is_first_action`, `module`, `plan_ref`, `role`, `source`, `status`, `step_key`, `tenant_ref`, `version`;
- textos de denúncias, documentos, currículos, nomes, e-mails, telefones, tokens e identificadores fiscais são descartados;
- eventos do servidor não bloqueiam cobrança e têm timeout curto;
- SDKs do cliente são carregados sob demanda quando a integração está configurada.

| Evento | Momento | Propriedades permitidas |
|---|---|---|
| `account_created` | tenant criado | `tenant_ref`, `plan_ref`, `source` |
| `user_invited` / `user_joined_tenant` | convite e entrada | `tenant_ref`, `role`, `source` |
| `demo_requested` | lead de demonstração persistido | `module`, `source` |
| `proposal_created` | proposta persistida | `plan_ref`, `status`, `source` |
| `contract_activated` | contrato ativado | `tenant_ref`, `status`, `source` |
| `module_opened` | abertura autorizada | `tenant_ref`, `module` |
| `report_started` / `report_submitted` | formulário anônimo | `module`, `status`, `source` |
| `job_published` | vaga publicada | `tenant_ref`, `status` |
| `application_started` / `application_submitted` | candidatura | `tenant_ref`, `status` |
| `employee_request_created` | solicitação interna | `tenant_ref`, `status` |
| `subscription_started` / `payment_confirmed` | assinatura/pagamento | `tenant_ref`, `plan_ref`, `status`, `source` |
| `onboarding_step_completed` | etapa real concluída | `tenant_ref`, `step_key`, `module` |

Funis planejados, a criar somente após a ingestão confirmar os eventos reais:

1. visita → `demo_requested`;
2. `account_created` → `user_invited`;
3. primeiro acesso → `module_opened` ou primeira ação;
4. `job_published` → `application_submitted`;
5. `report_started` → `report_submitted`;
6. `contract_activated` → `payment_confirmed`.

Não foram criados insights vazios referenciando eventos inexistentes. O projeto conectado ainda precisa ser renomeado, usar timezone `America/Sao_Paulo`, anonimizar IP e desabilitar captura de console nas configurações do PostHog.

## Onboarding do tenant

A home apresenta progresso derivado de empresa identificada, membros ativos, função vinculada, módulos contratados/autorizados e primeira atividade real. Contagens usam filtros no banco e RLS; zero aparece como ausência explicada e falta de autorização como indisponibilidade de escopo.

## CI e ambientes

`.github/workflows/ci.yml` usa Node 22 e executa instalação determinística, audit, verificação de segredos, validação de migrations, lint, typecheck, testes e build. Não depende de credenciais de produção. Preview e Production mantêm configurações independentes.

## Advisors do Supabase

Após a migration, o advisor retornou 63 avisos de segurança (42 informativos e 21 warnings) e 235 de performance (214 informativos e 21 warnings), sem erro crítico. Os 42 itens sem policy são tabelas server-only sem grants para `anon`/`authenticated`. Permanecem para tratamento controlado: RPCs `SECURITY DEFINER` públicas/autenticadas, proteção contra senhas vazadas desabilitada, foreign keys sem índice justificável, índices ainda sem uso e policies permissivas sobrepostas.

Referências: [funções SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [policies permissivas](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) e [proteção de senha](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Validação de fluxos críticos

| Fluxo | Evidência atual | Lacuna real |
|---|---|---|
| autenticação e recuperação | Supabase Auth e rotas existentes | E2E autenticado exige usuário de teste dedicado |
| tenant/roles/módulos | RLS remota, permissions e consultas live | ampliar testes por papel com fixtures isoladas |
| denúncia anônima | RPCs públicas, listagem interna sem conteúdo e analytics sanitizado | E2E completo não deve criar relato real sem fixture |
| Pessoas e Talentos | tabelas/RLS reais e listagens explicativas | criação e transição internas ainda não têm UI completa |
| comercial e contratos | APIs, paginação e testes de autorização | ampliar E2E autenticado no preview |
| Asaas Sandbox | idempotência, fora de ordem, atraso, cancelamento e conciliação em testes | homologação externa depende de eventos reais controlados |
| auditoria privilegiada | registros e endpoints existentes | validar amostra autenticada com conta de teste |

## Testes adicionados

- allowlist de analytics;
- sanitização recursiva e remoção de payload do Sentry;
- checklist sem conclusão inventada e conclusão baseada em fatos;
- validação estática de migrations e varredura de segredos;
- CI reproduzível sem segredos de produção.
- cinco smoke tests Playwright para home, login, admin, headers, JSON inválido e ausência dos bundles do servidor no diretório público.

## Pendências prioritárias

1. Criar conta/tenant de teste isolados para E2E autenticado.
2. Completar criação e transições de Pessoas/Talentos com testes por RLS.
3. Configurar Sentry e PostHog nos ambientes, ingerir eventos controlados e criar os seis funis.
