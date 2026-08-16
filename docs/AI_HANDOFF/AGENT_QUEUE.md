Owner: chatgpt_backend
Status: ready_for_product_review
Branch: fix/admin-functional-recovery
Head: d2d5f29a2b73d000cf9da033da6845219e841552
Headline: Admin Navigation IA — menus e submenus organizados por domínio e nível de acesso.

Preview:
- READY — `dpl_CxjFcFueNugMJBdvctc8EEPhNEoM`
- Imutável: https://ordum-itwya3pqi-ordum.vercel.app
- Alias: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app
- Browser QA: console errors `0`; HTTP 5xx `0`; logs Vercel 5xx `0`.

Arquitetura de menu:
- Árvore única de dois níveis: Início direto; Comercial, Clientes, Financeiro, Operação e Administração como accordions.
- Filtragem primária por `platformCan`; fallbacks legados preservados apenas onde já existiam; parents vazios removidos.
- Desktop e mobile consomem a mesma árvore; um grupo aberto por vez; rota ativa prevalece sobre preferência visual local.
- Breadcrumb, título, parent/child active state e bloqueio frontend de deep link derivam da mesma definição.
- Financeiro roteável por `?view=overview|subscriptions|payments|overdue`; deep link e back/forward homologados.

Permissões usadas:
- Comercial: `platform.leads.read`, `platform.demos.manage`, `platform.commercial.read`.
- Clientes: `platform.clients.read`, `platform.onboarding.read`, `platform.success.read`.
- Financeiro: `platform.billing.read`.
- Operação: `platform.support.read`, `platform.audit.read|platform.audit.team.read`, `platform.system.read`.
- Administração: `platform.staff.read`, `platform.teams.read`, `platform.access.simulate`, `platform.settings.read`.

QA:
- Run descartável `admin-nav-msvyu5y1-4536f9`; cleanup de Auth, membros, permissões e papéis de QA concluído.
- Admin: cinco domínios autorizados; Administração expandida; footer com nome, papel humano e ambiente.
- Comercial: somente Comercial + Empresas; URL direta de Financeiro negada.
- Financeiro: somente Empresas + Financeiro; Cobranças deep-linked e active state; back/forward entre Cobranças e Assinaturas.
- Customer Success: somente Clientes com Empresas, Implantação e Customer Success.
- Desktop `1440x1000`; mobile `390x844`; Space/Enter no accordion; submenu fecha drawer; Escape fecha drawer; sem overflow.
- Screenshots: `tmp/admin-navigation/01-admin-full.png` a `07-mobile-menu.png`.

Checks:
- lint, typecheck, migration validation, secret scan e build PASS.
- 18/18 testes focados de navegação, Financeiro e regressão de produto PASS.
- Integridade não foi alterado; smoke de regressão focado permaneceu PASS.

Bugs corrigidos:
- Lista plana substituída por navegação semântica e permission-aware.
- Assinaturas, Cobranças e Inadimplência agora possuem URL própria e histórico do navegador coerente.
- Rota administrativa conhecida sem permissão mostra acesso negado antes de renderizar a página.
- IDs `aria-controls` desktop/mobile deixaram de colidir; fechamento de grupo limpa a preferência persistida.
- “Equipes comerciais” e “Acessos” foram humanizados para “Equipes” e “Acessos e permissões”.

Backend Requests:
- BR-001 pendente: SMTP transacional externo.
- BR-002 pendente não bloqueante: cron intradiário/runner.
- BR-005 pendente: credenciais Asaas Sandbox; produção permanece desabilitada.
- Nenhum request novo: perfis customizados já são representáveis pelo RBAC atual e foram validados com fixtures descartáveis.
