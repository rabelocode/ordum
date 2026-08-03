# ORDUM 03 — Acesso, papéis e escopo

> Atualização do piloto: `tenant_admin` recebe permissões tenant-scoped por `role_permissions`; não cria `platform_member`, não ignora RLS e não amplia privilégios globais. O frontend usa as chaves reais do catálogo remoto.

## Autorização efetiva

```text
acesso = membro ativo
       + papel interno
       + permissões do papel
       + equipes atribuídas
       + política do recurso
```

`relationship_type` descreve vínculo (`partner`, `employee`, `contractor`, `representative`, `agency`, `other`) e nunca concede privilégio.

## Papéis internos canônicos

| Papel | Escopo | Capacidades principais |
|---|---|---|
| `admin` | global | equipe, papéis, planos, aprovação, billing, auditoria e sistema |
| `manager` | equipes gerenciadas | membros Sales, distribuição, acompanhamento, aprovação comercial e leitura financeira no escopo |
| `sales` | proprietário/equipes conforme visibilidade | leads, atividades, demos, propostas, contratos e status financeiro necessário ao atendimento |

Permissões `*.read` não tornam gerente ou vendedor global. A API sempre combina a permissão com equipe, proprietário e visibilidade (`own`, `team`, `all`). Membros suspensos falham antes de qualquer operação.

## Proteções implementadas

- gerente só adiciona/remove Sales em equipes que gerencia;
- gerente não cria gerente nem altera papel global;
- gerente não convida Sales para equipe externa ao seu escopo;
- gerente só aprova proposta/contrato dentro da alçada monetária configurada; alçada ausente ou excedida exige admin;
- vendedor não lê lead ou cliente de outra equipe;
- somente admin provisiona, suspende cliente, altera entitlements contratados, cancela recorrência ou reprocessa webhook;
- alteração da própria função global é bloqueada;
- o último admin ativo não pode ser rebaixado ou suspenso;
- `tenant_admin` não dá acesso a `/#/admin`;
- campos editáveis de equipe são allowlisted no backend;
- ações críticas registram ator, correlação, IP/user-agent quando disponíveis, antes/depois sanitizado e resultado.
- RPCs `SECURITY DEFINER` têm `search_path` explícito e `EXECUTE` revogado de `PUBLIC`; helpers de RLS são concedidos somente a `authenticated`, enquanto seis RPCs de formulário público são concedidas explicitamente a `anon`/`authenticated` por necessidade funcional;
- o bucket `ordum-public` continua servindo URLs públicas, mas os papéis de browser não podem listar todos os objetos via Storage API.

## Papéis de tenant

Papéis como `tenant_admin`, `employee`, `manager`, `hr`, `recruiter`, `compliance`, `committee`, `legal` e `executive` pertencem a um tenant específico. Eles são resolvidos por `memberships`, `roles`, `membership_roles`, `permissions` e `role_permissions`, sem cruzamento com `platform_roles`.
# Matriz administrativa

`/#/admin/acessos` oferece simulação somente leitura da decisão de acesso e mostra a origem do allow/deny. A simulação preserva a separação entre papel, vínculo, equipe, escopo e permissão; `relationship_type` nunca concede acesso.
