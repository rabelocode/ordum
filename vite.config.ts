import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const release = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'local';
  const sentryUploadConfigured = Boolean(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT);
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(sentryUploadConfigured ? [sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        release: { name: release },
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/assets/**/*.map'] },
        telemetry: false,
      })] : []),
    ],
    define: {
      __ORDUM_RELEASE__: JSON.stringify(release),
    },
    build: {
      sourcemap: sentryUploadConfigured ? ('hidden' as const) : false,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
