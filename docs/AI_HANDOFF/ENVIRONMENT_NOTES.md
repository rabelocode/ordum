# Anotações de Ambiente (ENVIRONMENT NOTES)

- A conexão com o Supabase exige as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` ou não roda a aplicação local ou remote na Vercel.
- O rate limits local exige `INTEGRITY_RATE_LIMIT_SECRET` ou `SUPABASE_SECRET_KEY` no server `server.ts`.
