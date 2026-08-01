# ORDUM 03 — Acesso, papéis e escopo

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

## Papéis de tenant

Papéis como `tenant_admin`, `employee`, `manager`, `hr`, `recruiter`, `compliance`, `committee`, `legal` e `executive` pertencem a um tenant específico. Eles são resolvidos por `memberships`, `roles`, `membership_roles`, `permissions` e `role_permissions`, sem cruzamento com `platform_roles`.
