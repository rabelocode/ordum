# Arquitetura Global

O ecossistema Ordum é estruturado em módulos independentes que interagem por meio de contratos rigorosos.

## Fronteiras
- **`site`**: Tudo o que é público e institucional (HOME, lead capture).
- **`core`**: Núcleo compartilhado contendo controle de acesso, auth, definição de tenants, auditoria.
- **`solutions/integridade`**: Domínio isolado da solução Integridade.
- **`solutions/pessoas`**: Domínio isolado da solução Pessoas.
- **`solutions/talentos`**: Domínio isolado da solução Talentos.
- **`ordum-admin`**: Área interna da Ordum para gerir as contas clientes.

## Contratos Principais
A base é fundamentada nos seguintes adapters, serviços e repositórios (atualmente simulados em memória/local):
- `AuthAdapter`: Gerencia login/logout.
- `TenantResolver`: Resolve qual tenant está sendo acessado.
- `TenantRepository` / `OrganizationRepository`: Gestão de dados da empresa, unidades, setores.
- `MembershipRepository`: Conecta o `User` ao `Tenant`.
- `AccessControlService`: Define se o usuário possui acesso (`can(context, permission, resource)`).
- `EntitlementsProvider`: Retorna as soluções habilitadas para um tenant (`hasSolution(tenantId, solutionId)`).
- `LandingResolver`: Define a rota pós-login com base na autorização (`resolve(context)`).
- `FileService`, `NotificationService`, `AuditService`: Serviços utilitários.
- `LeadService`: Repositório de captação de leads.
- `SolutionRegistry`: Catálogo extensível das soluções disponíveis na plataforma.

## Fluxo Comercial e Ativação
1. **Visitante** solicita demo (gera um `Lead`).
2. Análise comercial pela equipe Ordum.
3. Aprovação explícita (ação de um `ORDUM_SUPER_ADMIN` ou `ORDUM_SALES`).
4. Criação da Empresa (Tenant) com suas Soluções Contratadas (Entitlements) ativadas.
5. Convite do Administrador (Owner).
6. Configuração Organizacional (cargos, setores).
7. Convite e atribuição de Usuários e Permissões.

*Um lead nunca deve criar ou acessar um tenant automaticamente.*

### Backend de Administração (Server-side Boundary)
Para operações privilegiadas (ex: `provision_tenant`, `releaseDemoAccess`, consulta global de `tenants`) que não podem ou não devem ser executadas pelo client devido a restrições de RLS e segurança global, a Ordum implementa uma boundary server-side via `server.ts` (Express + Vite Middleware).

O backend:
1. Valida a sessão JWT com Supabase.
2. Identifica o usuário e verifica se é um Administrador da Plataforma (atualmente via variável `ADMIN_EMAILS` como debito arquitetural pendente de uma tabela de roles globais).
3. Utiliza a `SUPABASE_SECRET_KEY` de forma isolada do frontend para efetuar operações administrativas no Supabase via *privileged client*.
4. O fluxo comercial para aprovação de leads transforma leads em tenants, inserindo em `tenants`, `tenant_solutions`, disparando convite de auth via Supabase Admin API e gerando o `membership`.
