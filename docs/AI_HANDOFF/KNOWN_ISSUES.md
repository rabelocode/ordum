# BUGS CONHECIDOS E PROBLEMAS (KNOWN ISSUES)

## Fase 2
- **Testes Locais Limitados:** Ausência de script seed inicial homologado para Supabase impossibilita testagem E2E profunda de isolamento contra base *offline*. O ambiente atual exige fixtures reais ou instâncias de teste descartáveis remotas para rodar os specs de `tenantAuth.test.ts` que validem a fronteira RLS física sem burlar (usando apenas roles anon e auth.users fictícios).
- **Sobrescrita Potencial React-Router:** A estrutura `App.tsx` lida com `window.location.hash` explicitamente; Guards construídos em `react-router-dom` legados fariam a UI quebrar caso algum provider os importasse indevidamente. O novo `Guards.tsx` foi convertido para manipulador puro, mas atenção é exigida.
- **Provider Duplication Trap:** Foi necessário manter `AuthProvider`, `TenantProvider` vivos. Se componentes legados forem criados por agentes sem usar `useAccess()`, estarão fora do boundary unificado global, o que criaria confusão entre estados de sessão. Recomendado remoção paulatina.
