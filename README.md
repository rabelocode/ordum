<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Ordum

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d61c47b2-1366-4754-8194-9d11ab7b6e71

## Run Locally

**Prerequisites:**  Node.js


1. Use Node.js 22.
2. Install dependencies with `npm ci`.
3. Copy `.env.example` to `.env.local` and fill in the Supabase values.
4. Start the app with `npm run dev` and open `http://localhost:3000`.

## Deploy with GitHub and Vercel

1. Create a Git repository and push this folder to GitHub.
2. In Vercel, select **Add New > Project** and import the GitHub repository.
3. Add these Environment Variables in Vercel for Production, Preview, and Development:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
4. Deploy. Vercel will build every pushed commit automatically. Pushes to the production branch create production deployments; other branches create preview deployments.

Never commit `.env.local` or expose `SUPABASE_SECRET_KEY` through a `VITE_` variable.
