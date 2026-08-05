# Decisões (DECISIONS)

## ADR-0001 — Protocolo Mínimo de Continuidade
- Data: 2026-08-04
- Status: Aprovada
- Contexto: Inconsistência de continuidade entre IA (Gemini/Codex).
- Decisão: Exigir criação e atualização de registros detalhados na pasta `docs/AI_HANDOFF`.
- Motivo: Evitar depender da memória do agente e histórico de chat perdido.
- Consequências: Aumento da latência nas conclusões das tarefas locais, mas alta confiabilidade de Handoff. 
- Agente: antigravity
- Commit: aed8d4f
