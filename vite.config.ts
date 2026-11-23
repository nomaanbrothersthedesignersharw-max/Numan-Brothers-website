import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const url = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

  // Preview builds are intentionally allowed before client database onboarding.
  // Production MUST fail closed rather than shipping an empty CMS storefront.
  if (process.env.VERCEL_ENV === 'production') {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key.trim())) {
      throw new Error(
        'Nomaan Brothers production deployment blocked: configure the dedicated ' +
        'client-owned VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY first.'
      );
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, '.') } },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-helmet-async'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-motion': ['motion'],
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
