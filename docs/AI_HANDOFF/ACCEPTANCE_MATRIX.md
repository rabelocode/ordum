# Acceptance Matrix (Admin Commercial - Fase 3)

| Fluxo | UI | API | DB | Security | Audit | Test | Browser | Status |
|---|---|---|---|---|---|---|---|---|
| lead | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Parcialmente Comprovado | Comprovado |
| demo | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Parcialmente Comprovado | Comprovado |
| proposta | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Parcialmente Comprovado | Comprovado |
| plano | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Parcialmente Comprovado | Comprovado |
| solutions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Parcialmente Comprovado | Comprovado |
| aceite | ✅ | ✅ | ✅ | ✅ | ✅ | Ausente | Parcialmente Comprovado | Comprovado |
| contrato | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Parcialmente Comprovado | Comprovado |
| checkout Sandbox | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Parcialmente Comprovado | Parcial |
| webhook | Ausente | ✅ | ✅ | ✅ | ✅ | ✅ | Não Aplicável | Parcial |
| provisionamento | Ausente | ✅ | ✅ | ✅ | ✅ | ✅ | Não Aplicável | Comprovado |
| onboarding | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Parcialmente Comprovado | Comprovado |
| Admin geral | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Parcialmente Comprovado | Comprovado |
| Integridade | Ausente | Ausente | Ausente | Ausente | Ausente | Ausente | Ausente | **NÃO INICIADA NESTA FASE** |

*Notas:*
- *Testes E2E complexos de UI com Browser Mock não foram rodados via automação, mas a funcionalidade e integração do banco de dados (Integration test em `vitest`) abrangeu boa parte da regra de negócio.*
- *Webhook Asaas Web e Retries (produção via túnel/Nativo Asaas) demandam ambiente real de Staging e não compõem a métrica validada.*
