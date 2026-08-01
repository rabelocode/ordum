CONTINUE O DESENVOLVIMENTO A PARTIR DO ESTADO ATUAL.

NÃO recrie o `/#/admin`.

NÃO recrie tabelas.

NÃO altere o Platform RBAC já implementado.

NÃO introduza Google OAuth.

NÃO crie autenticação paralela.

O objetivo desta etapa é:

1. corrigir definitivamente o fluxo de autenticação da ORDUM;
2. integrar corretamente login, convites e recuperação de senha;
3. fazer `/#/admin` distinguir usuário não autenticado de usuário sem permissão;
4. finalizar a área "Equipe ORDUM", atualmente PARCIAL;
5. validar os fluxos reais já implementados.

---

# 1. MODELO DE AUTENTICAÇÃO OFICIAL

A ORDUM utilizará nesta etapa:

```text
EMAIL + SENHA
+
SUPABASE AUTH
```

Não utilizar Google OAuth.

Não adicionar Google Cloud.

Não adicionar Client ID Google.

Não adicionar provider Google.

Não exigir login social.

O usuário atual já existe em `auth.users` com identidade:

```text
provider = email
```

Portanto implemente sobre a infraestrutura real existente.

---

# 2. UMA AUTENTICAÇÃO PARA TODA A ORDUM

NÃO criar sistemas separados como:

```text
AdminLogin
TenantLogin
EmployeeLogin
SalesLogin
```

A autenticação é uma só:

```text
Supabase Auth
```

Depois da autenticação, a autorização determina o destino.

Arquitetura:

```text
                    EMAIL + SENHA
                         │
                  SUPABASE AUTH
                         │
                     auth.users
                         │
             ┌───────────┴────────────┐
             │                        │
      platform_members            memberships
             │                        │
       EQUIPE ORDUM               CLIENTES
             │                        │
     /#/admin                  Workspace Tenant
```

---

# 3. CRIAR LOGIN REAL

Criar uma rota central adequada, preferencialmente:

```text
/#/login
```

Essa deve ser a tela oficial de login da ORDUM.

Campos:

```text
E-mail
Senha
```

Ações:

```text
Entrar
Esqueci minha senha
```

Não criar signup público.

NÃO mostrar:

```text
Criar minha conta
Cadastre-se
```

A criação de usuários acontece por convite administrativo.

---

# 4. LOGIN COM SUPABASE AUTH

Utilizar o browser client existente e:

```ts
supabase.auth.signInWithPassword({
  email,
  password
})
```

Não fazer autenticação no `server.ts` manualmente.

Não consultar senha no banco.

Não criar hash próprio.

Não persistir senha.

Não criar token próprio.

Supabase Auth continua sendo a autoridade de identidade.

---

# 5. NÃO USAR SECRET KEY NO LOGIN

Frontend utiliza exclusivamente:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Nunca:

```text
SUPABASE_SECRET_KEY
```

no browser.

A secret continua exclusivamente server-side para operações administrativas privilegiadas.

---

# 6. CORRIGIR O ERRO ATUAL DO /#/admin

Hoje:

```text
Usuário não autenticado
→ /#/admin
→ "Acesso Negado"
```

Isso está ERRADO.

Existem estados diferentes:

```text
AUTH LOADING

UNAUTHENTICATED

AUTHENTICATED + AUTHORIZED

AUTHENTICATED + FORBIDDEN
```

Trate-os separadamente.

---

# 7. /#/admin SEM SESSÃO

Quando o usuário acessar:

```text
/#/admin
```

sem Supabase Session válida:

NÃO mostrar:

```text
Acesso Negado
```

Redirecionar para:

```text
/#/login?returnTo=/admin
```

ou mecanismo equivalente compatível com HashRouter.

Depois do login bem-sucedido, retornar ao destino solicitado.

---

# 8. /#/admin COM SESSÃO

Depois do login:

```text
Supabase Auth
→ Session
→ access_token
→ GET /api/admin/me
```

O backend valida:

```text
JWT
→ auth user
→ platform_members
→ role
→ permissions
→ scope
```

Se possuir:

```text
platform.access
```

permitir acesso.

---

# 9. NÃO AUTORIZAR PELO EMAIL

Não fazer:

```ts
email === "agvictorrabelo@gmail.com"
```

O usuário já está cadastrado corretamente no banco.

A autorização deve vir exclusivamente de:

```text
auth.users
→ platform_members
→ platform_roles
→ platform_role_permissions
→ platform_permissions
```

O e-mail é somente identidade de login.

---

# 10. AUTHENTICATED MAS SEM PLATFORM ACCESS

Se o usuário estiver autenticado mas NÃO for membro autorizado da Platform:

somente aí mostrar:

```text
Acesso Negado

Você não possui permissão para acessar
o painel administrativo global da ORDUM.
```

Adicionar:

```text
Ir para minha organização
Sair
```

Se possuir memberships de tenant, "Ir para minha organização" deve direcionar corretamente ao fluxo de tenant.

Não chamar isso de erro de login.

A pessoa está autenticada, apenas não está autorizada naquele recurso.

---

# 11. RESOLUÇÃO PÓS-LOGIN

Depois de autenticar, resolver o destino.

## Caso A

Possui:

```text
platform_member ativo
+
platform.access
```

e `returnTo=/admin`:

```text
→ /#/admin
```

## Caso B

Não possui Platform Access, mas possui exatamente:

```text
1 membership ativa
```

```text
→ workspace do tenant
```

## Caso C

Possui:

```text
múltiplas memberships
```

```text
→ seleção de organização
```

## Caso D

Não possui:

```text
platform membership
nem
tenant membership
```

mostrar estado:

```text
Sua conta ainda não possui acesso a uma organização.
```

Não criar tenant automaticamente.

---

# 12. PLATFORM MEMBER NÃO É TENANT MEMBERSHIP

Preservar estritamente:

```text
platform_members
→ equipe interna ORDUM
```

e:

```text
memberships
→ empresa cliente
```

Não criar membership de tenant para funcionário da ORDUM sem necessidade.

Não criar platform_member para funcionário do cliente.

---

# 13. SESSION RESTORE

Ao inicializar a aplicação:

```text
Supabase Auth
→ restaurar session
→ resolver auth
→ resolver authorization
→ renderizar aplicação
```

Utilizar a sessão persistida pelo Supabase corretamente.

Pode utilizar mecanismos oficiais do client como:

```text
getSession()
onAuthStateChange()
```

conforme apropriado à arquitetura existente.

---

# 14. NÃO DAR FLICKER DE ACESSO NEGADO

Durante:

```text
auth initialization
/api/admin/me
tenant resolution
```

mostrar:

```text
loading
skeleton
```

Nunca:

```text
Acesso Negado
```

até a autorização realmente terminar.

Fluxo:

```text
LOADING
   ↓
AUTH RESOLVED
   ↓
AUTHORIZATION RESOLVED
   ↓
LOGIN | APP | FORBIDDEN
```

---

# 15. LOGOUT

Implementar logout real através do Supabase Auth.

Ao sair:

```text
session encerrada
→ contexts limpos
→ dados sensíveis removidos do estado
→ /#/login
```

Não implementar logout apenas removendo uma flag local.

---

# 16. ESQUECI MINHA SENHA

Na tela:

```text
/#/login
```

implementar:

```text
Esqueci minha senha
```

Criar fluxo usando Supabase Auth.

Tela inicial:

```text
E-mail
Enviar link de recuperação
```

Criar rota adequada:

```text
/#/auth/reset-password
```

ou equivalente.

Ao abrir o link enviado pelo Supabase:

```text
session recovery
→ Nova senha
→ Confirmar senha
```

e então utilizar o método oficial do Supabase para atualizar a senha do usuário autenticado pelo recovery flow.

Depois:

```text
Senha alterada
→ /#/login
```

---

# 17. NÃO EXPOR SE EXISTE UMA CONTA

Na recuperação de senha, utilizar mensagem neutra:

```text
Se existir uma conta associada a este e-mail,
você receberá as instruções de recuperação.
```

Evitar enumeração de usuários.

---

# 18. MODELO DE CRIAÇÃO DE CONTA

NÃO haverá signup público nesta etapa.

Os usuários entram na ORDUM por:

```text
CONVITE
```

Existem dois contextos:

```text
Equipe ORDUM
Clientes / colaboradores dos tenants
```

Ambos utilizam Supabase Auth.

---

# 19. CONVITE DA EQUIPE ORDUM

Admin pode convidar:

```text
Admin
Manager
Sales
```

dentro das regras existentes.

Manager pode convidar:

```text
Sales
```

somente para equipes que gerencia e quando autorizado.

O backend deve utilizar:

```ts
supabase.auth.admin.inviteUserByEmail(...)
```

usando privileged client server-side.

Nunca chamar Auth Admin API diretamente do browser.

---

# 20. CONVITE DE CLIENTES

Quando uma empresa é provisionada:

```text
Tenant
→ responsável da empresa
→ convite por email
```

Não obrigar Google.

O responsável recebe o convite da ORDUM e finaliza o acesso.

Fluxo:

```text
ORDUM provisiona Tenant
      ↓
cria/inicia usuário Auth por invite
      ↓
envia convite por email
      ↓
usuário abre link
      ↓
ORDUM reconhece sessão de invite
      ↓
define senha
      ↓
conta finalizada
      ↓
membership
      ↓
tenant_admin
      ↓
workspace
```

---

# 21. ACCEPT INVITE

Criar rota apropriada:

```text
/#/auth/accept-invite
```

ou equivalente compatível com Supabase Auth e HashRouter.

Essa página deve:

1. validar a sessão criada pelo link;
2. identificar corretamente o usuário;
3. solicitar:

```text
Nome
Nova senha
Confirmar senha
```

quando necessário;

4. atualizar senha usando Supabase Auth;
5. concluir configuração;
6. carregar profile/membership;
7. direcionar para o destino correto.

Não pedir novamente o e-mail.

---

# 22. CONVITE NÃO DEFINE SENHA NO ADMIN

Quando um Admin convida alguém:

NÃO pedir:

```text
senha do funcionário
senha do cliente
```

O próprio usuário deve definir sua senha de forma privada.

Admin nunca deve conhecer a senha de terceiros.

---

# 23. CONVITE EXPIRADO OU INVÁLIDO

Criar tratamento adequado:

```text
Convite inválido ou expirado.
```

Adicionar ação quando apropriado:

```text
Solicitar novo convite
```

Não gerar erro técnico cru.

---

# 24. EMAIL TEMPLATES

Se os templates atuais do Supabase ainda estiverem genéricos, preparar/documentar a necessidade de customização:

```text
Invite User
Reset Password
```

Não precisa redesenhar todo sistema de e-mail se não houver suporte atual.

Mas os redirects devem apontar corretamente para as rotas da ORDUM.

---

# 25. REDIRECT URLs

Garantir que os redirects utilizados por:

```text
invite
password recovery
```

correspondam às URLs permitidas do Supabase Auth.

Não hardcode somente:

```text
localhost
```

Criar resolução apropriada de origem, usando ambiente atual.

Desenvolvimento:

```text
http://localhost:3000
```

Produção:

origem real da ORDUM.

Se configuração externa do Supabase Dashboard ainda for necessária, documentar exatamente qual Redirect URL precisa ser adicionada.

Não fingir que a configuração externa foi realizada pelo código.

---

# 26. LOGIN DOS CLIENTES

O cliente também deve utilizar:

```text
/#/login
```

Não criar:

```text
/#/client-login
```

desnecessariamente.

Depois da autenticação:

```text
memberships
```

determinam a organização e o workspace.

---

# 27. CLIENTE COM UMA ORGANIZAÇÃO

Se possuir exatamente uma membership ativa:

```text
→ selecionar automaticamente
→ abrir workspace
```

---

# 28. CLIENTE COM VÁRIAS ORGANIZAÇÕES

Se possuir mais de uma membership:

mostrar seletor:

```text
Escolha uma organização
```

Nunca armazenar tenant selecionado como prova de autorização.

Persistência local da escolha pode existir apenas como preferência UX.

Backend/RLS continua validando acesso.

---

# 29. USUÁRIO DA ORDUM + CLIENTE

A arquitetura deve suportar tecnicamente uma pessoa que possua:

```text
platform_member
+
membership
```

sem quebrar.

Se houver Platform Access e acessar:

```text
/#/admin
```

abrir Admin.

Se solicitar workspace de tenant onde possui membership:

permitir tenant conforme RBAC.

Não assumir exclusividade entre as duas tabelas.

---

# 30. FINALIZAR EQUIPE ORDUM

O relatório atual marcou:

```text
Equipe ORDUM: PARCIAL
```

Finalize agora.

Página:

```text
/#/admin/staff
```

deve permitir ao Admin:

* visualizar membros;
* convidar membro;
* selecionar Platform Role;
* selecionar relationship_type;
* adicionar a uma ou mais equipes;
* alterar role;
* alterar vínculo;
* suspender;
* reativar;
* adicionar/remover equipes;
* visualizar status;
* visualizar último acesso quando fonte real existir.

---

# 31. REGRAS DE ROLE

Preservar:

```text
admin
manager
sales
```

Somente Admin pode criar/promover:

```text
manager
admin
```

Manager só pode convidar:

```text
sales
```

para equipe gerenciada.

---

# 32. ADMIN = PARTNER

Preservar restrição:

```text
role = admin
→ relationship_type = partner
```

Não permitir pela UI selecionar:

```text
Admin + Employee
Admin + Representative
```

Se o banco rejeitar, a UI deve antecipar a regra.

---

# 33. ÚLTIMO ADMIN

Não permitir:

* suspender o último Admin ativo;
* remover o último Admin ativo;
* rebaixar o último Admin ativo.

Retornar mensagem clara.

---

# 34. SUSPENSÃO

Ao suspender um `platform_member`:

```text
status = suspended
```

ou status real equivalente já definido.

Isso deve impedir Platform Access.

Não necessariamente apagar `auth.users`.

Manter histórico/auditoria.

---

# 35. STAFF ENDPOINTS

Finalizar:

```text
GET   /api/admin/staff
POST  /api/admin/staff
PATCH /api/admin/staff/:id

POST /api/admin/staff/:id/suspend
POST /api/admin/staff/:id/reactivate
```

E endpoints auxiliares somente se realmente necessários.

Não duplicar arquitetura.

---

# 36. AUDITORIA DO STAFF

Registrar:

```text
platform.member.invited
platform.member.role_changed
platform.member.relationship_changed
platform.member.suspended
platform.member.reactivated
platform.member.team_added
platform.member.team_removed
```

Nunca registrar senha ou token.

---

# 37. LOGIN DE PLATFORM MEMBER SUSPENSO

Supabase Auth pode continuar autenticando a identidade.

Mas:

```text
/api/admin/me
```

deve negar Platform Access se:

```text
platform_members.status != active
```

Mostrar:

```text
Seu acesso administrativo está suspenso.
```

Não chamar isso de "senha inválida".

---

# 38. CLIENTE INATIVO

Da mesma forma:

usuário pode possuir Auth válido mas tenant/membership estar desativado.

A autenticação continua válida.

A autorização deve bloquear o recurso.

Não misturar autenticação e autorização.

---

# 39. ERROS DE LOGIN

Tratar UX para:

```text
credenciais inválidas
campos vazios
network error
rate limit
conta sem acesso
sessão expirada
```

Não mostrar mensagens técnicas do Supabase diretamente quando forem inadequadas ao usuário.

---

# 40. SEGURANÇA

Não guardar:

```text
password
JWT manual
isAdmin
role
permissions
```

como autoridade em localStorage.

A persistência normal de sessão gerenciada pelo Supabase Auth é permitida.

Isso é diferente de criar autorização local.

---

# 41. API BEARER TOKEN

Chamadas a:

```text
/api/admin/*
```

devem continuar enviando o access token da sessão Supabase.

Backend:

```text
Authorization: Bearer <JWT>
```

→ valida usuário
→ resolve Platform Context.

Nunca receber:

```text
userId
actorUserId
role
permission
```

do browser como prova de identidade.

---

# 42. VISUAL DO LOGIN

Criar experiência visual coerente com a ORDUM.

Identidade:

```text
Carbono
Cobre
Marfim
```

Sensação:

```text
corporativo
seguro
sofisticado
minimalista
tecnológico
```

Tela limpa.

Não transformar em landing page.

Não colocar excesso de marketing.

---

# 43. LOGIN NÃO DEVE DIZER "ADMIN"

Como será autenticação central, prefira:

```text
Acessar Ordum
```

em vez de:

```text
Login administrativo
```

A autorização decide o destino depois.

Pode mostrar contexto quando chegou via `/admin`, mas o componente deve continuar reutilizável.

---

# 44. TESTAR SEU ADMIN

Testar com o usuário Platform Admin já existente.

Fluxo obrigatório:

```text
sem sessão
→ /#/admin
→ /#/login
→ email + senha
→ Supabase Session
→ /api/admin/me
→ platform.access
→ /#/admin
```

Depois:

```text
F5
→ session restaurada
→ /#/admin
```

Depois:

```text
Logout
→ session encerrada
→ /#/login
```

---

# 45. NÃO CRIAR GOOGLE LOGIN

Nesta etapa NÃO implementar:

```text
signInWithOAuth
Google
Microsoft
GitHub
```

Pode ser adicionado futuramente.

Não é requisito atual.

---

# 46. VALIDAR IMPLEMENTAÇÕES ANTERIORES

O código já informa como FUNCIONAL:

* Platform Teams;
* Members;
* Leads;
* Lead Assignments;
* Self Claim;
* Client Assignments;
* Solutions;
* Audit;
* System Health.

Não recrie.

Mas faça smoke tests depois que o login estiver funcionando.

---

# 47. NÃO INVENTAR DADOS PARA DIZER QUE TESTOU

O banco pode ainda não conter:

```text
teams
team members
leads
assignments
```

Não inserir fixtures permanentes silenciosamente em produção.

O objetivo é permitir que esses registros sejam criados pela UI real.

Depois informe quais fluxos foram efetivamente testáveis.

---

# 48. PRIMEIRO TESTE MANUAL APÓS LOGIN

Com Admin autenticado, deve ser possível:

```text
/#/admin
→ Equipes
→ Nova equipe
```

Criar uma equipe real.

Depois:

```text
F5
```

Ela deve permanecer.

Esse será o primeiro smoke test operacional real.

---

# 49. SEGUNDO TESTE

Pela Equipe ORDUM:

```text
Convidar usuário de teste
→ role Manager
→ relationship_type Employee
→ adicionar à equipe
```

Usuário recebe convite.

Aceita.

Define senha.

Entra.

Deve ver somente o escopo adequado.

---

# 50. TERCEIRO TESTE

Convidar:

```text
Sales
relationship_type = Representative
```

Validar experiência comercial e ausência de:

```text
Deploy
Sistema
Engenharia
Staff global
Auditoria global
```

---

# 51. TESTAR CLIENTE

Release Demo / provisionamento:

```text
lead
→ tenant
→ tenant_admin
→ convite
→ usuário aceita
→ define senha
→ login
→ membership
→ workspace
```

Confirmar que cliente NÃO recebe Platform Access.

---

# 52. DEPLOYMENTS E ENGENHARIA

Manter:

```text
NÃO INTEGRADO
```

enquanto integrações externas não existirem.

Não tentar "resolver" isso nesta etapa.

Não criar Kubernetes.

Não criar Cloud Run.

Não criar infraestrutura fictícia.

---

# 53. SYSTEM HEALTH

Preservar implementação atual.

Não alterar se já está retornando dados reais e seguros.

---

# 54. AUDITORIA

Preservar implementação atual.

Adicionar somente os eventos relacionados a Auth/Staff quando adequados.

Não registrar:

```text
password
reset token
invite token
JWT
SUPABASE_SECRET_KEY
```

---

# 55. DOCUMENTAÇÃO

Atualize os MDs para documentar definitivamente:

```text
Authentication
Authorization
Email/Password
Invite Flow
Password Recovery
Session Restore
Platform Login
Tenant Login
Post Login Resolution
No Public Signup
Platform Member
Membership
Staff Invitations
Tenant Invitations
```

Registrar explicitamente:

```text
AUTHENTICATION != AUTHORIZATION
```

e:

```text
platform_members != memberships
```

---

# 56. ESTADO FINAL ESPERADO

Fluxo:

```text
                           /#/login
                               │
                        Email + Senha
                               │
                         Supabase Auth
                               │
                           auth.users
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
          platform_members               memberships
                 │                           │
          Platform RBAC                  Tenant RBAC
                 │                           │
        ┌────────┼────────┐          ┌───────┴────────┐
      Admin    Manager   Sales      Tenant A        Tenant B
        │         │        │
      Global    Teams     Own
```

Convite:

```text
Admin / Manager autorizado
        ↓
inviteUserByEmail
        ↓
email
        ↓
accept invite
        ↓
define senha
        ↓
Supabase Session
        ↓
authorization resolution
        ↓
Admin OU Workspace
```

---

# 57. CRITÉRIO DE CONCLUSÃO

Só considere esta etapa concluída quando:

* `/#/admin` deslogado direciona para Login;
* Login por email/senha funciona;
* seu Platform Admin consegue entrar;
* refresh mantém sessão;
* logout funciona;
* usuário autenticado sem Platform Access recebe Forbidden;
* recuperação de senha funciona;
* convite possui tela de aceitação;
* convidado define sua própria senha;
* cliente consegue entrar via mesmo Auth;
* Platform Member resolve para Admin;
* Membership resolve para Tenant;
* múltiplas memberships possuem seletor;
* Equipe ORDUM deixa de ser PARCIAL;
* Admin consegue convidar/editar/suspender/reactivar staff;
* Manager não consegue escalar privilégios;
* nenhum login Google foi introduzido;
* nenhum signup público foi introduzido;
* build/typecheck passam;
* documentação corresponde ao estado real.

Execute as alterações.

Não responda apenas com plano.

Ao terminar, informe:

AUTHENTICATION: FUNCIONAL/PARCIAL
LOGIN EMAIL/SENHA:
SESSION RESTORE:
LOGOUT:
PASSWORD RECOVERY:
INVITE ACCEPTANCE:
POST LOGIN RESOLUTION:
PLATFORM LOGIN:
TENANT LOGIN:
MULTI-TENANT:
EQUIPE ORDUM:
SECURITY:
TESTES EXECUTADOS:
BUILD:
MDS:
PENDÊNCIAS REAIS:
