Owner: chatgpt_backend
Status: ready_for_backend_sync
Branch: fix/admin-functional-recovery
Head: f0e630f8842b2807a88aa2ea223d3c3f381102c9
Headline: Admin Access Management — papéis e permissões administráveis em linguagem humana.

Implemented:
- `Acessos`, `Papéis` e `Permissões` substituem o simulador técnico como experiência principal.
- Lista responsiva por nome/e-mail, função, equipe e status; detalhe em drawer com função, equipes, último acesso e preview imediato.
- Permissões agrupadas em Comercial, Clientes, Financeiro, Operação e Administração, sem keys técnicas na operação comum.
- Preview reutiliza a taxonomia da Navigation IA; diagnóstico técnico permaneceu como ferramenta secundária autorizada.
- Papéis existentes são derivados do backend e humanizados; papéis de sistema são identificados e não possuem ação destrutiva.
- Alteração de função/equipes, suspensão e reativação usam APIs existentes; alteração da própria função fica bloqueada na UX e no servidor.
- Membros e Acessos possuem links contextuais; auditoria de convites, função, equipes, suspensão e reativação ganhou linguagem humana.
- Requisições do dashboard agora são canceladas na troca de sessão, eliminando 401 no console durante troca de persona.

Database:
- Nenhuma migration, RPC, policy ou alteração estrutural.
- BR-006 criado para catálogo completo e gestão transacional de papéis personalizados; sem workaround frontend.

Tests:
- Suite completa: 224 testes; 223 PASS, 1 live E2E explicitamente SKIP, 0 FAIL.
- Focados: taxonomia de acesso, labels humanas, papéis customizados e regressão das proteções de autoalteração/último admin PASS.
- Secret scan, migration validation, lint, typecheck e build PASS.

Preview:
- READY — `dpl_65Ewga2oVJg6phJmBKfFezGF3Pu3`
- Imutável: https://ordum-w9p89uzme-ordum.vercel.app
- Alias: https://ordum-git-fix-admin-functional-recovery-ordum.vercel.app

QA:
- Run descartável `admin-access-msw0764m-3a5d63`; cinco pessoas e quatro papéis de QA; cleanup de Auth, membros, equipes, permissões e papéis concluído.
- Admin: Membros → Gerenciar acesso; tabs, filtros, drawer, função, equipe, preview e status clicados.
- Comercial: menu real Comercial + Clientes; Financeiro/Administração/Operação ausentes.
- Financeiro: função alterada pela UI; novo login exibiu Clientes + Financeiro; deep link de Acessos negado.
- Customer Success: função alterada pela UI; novo login exibiu Clientes, Implantação e Customer Success.
- Mobile `390x844`: lista, filtros e cards sem overflow horizontal.
- Console errors `0`; HTTP 5xx `0`; alteração final persistida no backend e fixtures removidas.
- Screenshots: `tmp/admin-access/01-access-list.png` a `08-access-mobile.png`, somente com dados descartáveis.

Blockers:
- BR-006: papéis personalizados e papéis sem pessoa vinculada precisam de contrato backend próprio. Não bloqueia gestão dos papéis existentes.
- BR-001 SMTP externo, BR-002 cron não bloqueante e BR-005 Asaas Sandbox permanecem pendentes e inalterados.

Suggested next package:
- Backend sync do BR-006; depois homologar criação/edição de papel personalizado e sua auditoria pela UI preparada.
