# BR-008 — Migration History Reconciliation

Data: 17/08/2026  
Projeto: `ordum-production` (`plnciaxcujnvaermxmby`)

## Antes

`supabase migration list --linked` apresentou três divergências locais e três remotas:

| Local | Remoto | Evidência |
| --- | --- | --- |
| `20260803130703_harden_privileged_function_search_paths` | `20260803132209_harden_privileged_function_search_paths` | SQL equivalente; hash canônico `a72d18098ba62ffbe3f4f06d4f52183d`. |
| ausente | `20260805230011_seed_default_customer_onboarding_template` | Migration remota distinta; SQL remoto materializado localmente sem execução. |
| `20260805230000_fix_admin_transition_control_plane` | `20260806231533_fix_admin_transition_control_plane` | SQL equivalente; hash canônico `7fb71b98452eafc1690ff8e74b506b1e`. |
| `20260806230000_backfill_commercial_items` | ausente | Não existe sob outro timestamp remoto; consulta agregada mostrou `proposals_pending_backfill=0` e `contracts_pending_backfill=0`, portanto sua execução seria no-op no estado atual. |

Hash canônico: SQL em minúsculas, sem comentários de linha e sem espaços em branco. Nenhum conteúdo de cliente foi lido.

## Reconciliação autorizada

Somente histórico, via CLI oficial:

1. reverter o alias remoto `20260803132209` e marcar `20260803130703` como aplicado;
2. preservar `20260805230011` e materializar seu SQL remoto exato no Git;
3. reverter o alias remoto `20260806231533` e marcar `20260805230000` como aplicado;
4. marcar `20260806230000` como aplicado, pois as duas condições idempotentes do backfill retornaram zero pendências.

Proibido e não executado: DDL, `db push`, execução de migration, alteração manual em `supabase_migrations.schema_migrations` ou leitura de conteúdo comercial.

## Depois

O CLI oficial confirmou cinco reparos de histórico:

- `20260803132209` → `reverted`;
- `20260803130703` → `applied`;
- `20260806231533` → `reverted`;
- `20260805230000` → `applied`;
- `20260806230000` → `applied`.

`supabase migration list --linked` passou a retornar 40 linhas com `local = remote` em todas as versões. A migration `20260805230011` materializada localmente possui hash canônico `824e2935128453cb67414c290c1eb932`, igual ao registro remoto.

Resultado: histórico Git ↔ Supabase sincronizado; nenhum DDL ou dado foi alterado.
