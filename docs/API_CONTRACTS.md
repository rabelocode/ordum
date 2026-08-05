# API Contracts

## Commercial Flow & Transactionality

Aviso: Os fluxos atuais de geração de Proposta com Itens e Contrato com Itens utilizam atomicidade controlada no backend em NodeJS via _manual rollback_. 
Isso pode ocasionalmente falhar se a network cair após o insert inicial e antes do insert das dependências.

**Necessidade Futura (Tech Debt):** 
Desenvolver e utilizar _RPC transacional_ do Postgres:
- `create_commercial_proposal_with_items`
- `create_commercial_contract_from_proposal`

## Supabase Constraints
- Para impedir duplicação, o sistema agora garante unicidade no contrato. A constraint confirmada no Supabase é: 
  `commercial_contracts_proposal_id_key UNIQUE (proposal_id)`
  *Isto impede a geração de dezenas de contratos a partir de uma única proposta (Idempotência)*.
