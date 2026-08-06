# Active Coordination Protocol - Ordum Integridade Fase 4A

Agent Active Rules:
- No integrations out-of-scope.
- All code needs node unit tests for pure idempotency.

## 1. Mapeamento da Camada de Dados (Painel Interno Integridade)

### Restrições Estritas de Migration
NENHUMA migration, RPC de provisionamento ou coluna SQL foi adicionada para a Fase 4A. Todo o fluxo opera exclusivamente sobre a estrutura herdada.

### Tabelas Reais e Relações
- **`integrity_reports`**: Entidade principal (campos limitados a description, protocol, status, category, channel e risk_level).
- **`integrity_case_events`**: Alimentará a timeline e os históricos de transições explícitas e assinalamentos. 
- **`integrity_case_assignments`**: Mapeamento autônomo M:N para controlar quais `membership_id` gerenciam qual caso.
- **`integrity_report_messages`**: Mensageria segura (com `visible_to_reporter` e `author_type='case_manager'`).
- **`integrity_report_secrets`**: Hash do Password público; ESTRITAMENTE bloqueado de vazar no GET do backend.
- **RLS Reais**: No backend Node com bypass, o RLS não é ativado nativamente na service_role, no entanto o controle de locação multitenant e Row-Level Security Lógico é obrigatoriamente replicado em todas as queries (`tenant_id = req.tenant.id`).

### Permissions e Acessos Reais
Protegido estritamente pelo `requireTenantSolution('integrity')`.
Ações de alteração (triagem, assignment, mensagem) e leitura dependem unicamente das seguintes permissões:
- `integrity.cases.read`
- `integrity.cases.manage`

### Restrições Mapeadas (Gaps para Fase 4B)
- **SLA**: O schema carece de prazos. No momento exibiremos apens "tempo em aberto". Termos como "fora do SLA" não devem ser utilizados e nem persistidos em metadata.
- **Departamento**: A denúncia não tem Setor/Unidade, portanto não haverá filtro de setor. O máximo a ser exibido (como visualização, não agrupamento/filtro) é o departamento do usuário que atendeu, rotulado como "Departamento do responsável".
- **Conflito de Interesse**: Sem contrato e dados suficientes, NENHUMA lógica de conflitos, badges de conflito ou restrições foram inventadas, sendo estas delegadas à próxima fase.

### Fluxo de Comunicação Anônima 
Aprovado e fundamentado via `integrity_report_messages`. Sempre com:
- `visible_to_reporter = true` (público) ou `false` (visível apenas na equipe de apuração).
- `author_type = 'case_manager'`
- Derivando sempre `author_membership_id` e `tenant_id` do Request Autenticado no Express (nunca do JSON `req.body`).

### Status Válidos
As transições são firmadas em loop único: `received`, `triage`, `in_review`, `waiting`, `resolved`, `archived`.
