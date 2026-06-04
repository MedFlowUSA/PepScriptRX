import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
            return 'vendor';
          }
          if (id.includes('/src/pages/admin/AdminSubmissionDetail')) return 'admin-submission-detail';
          if (id.includes('/src/pages/admin/AdminInventory')) return 'admin-inventory';
          if (id.includes('/src/pages/admin/AdminRxPlus')) return 'admin-rx-plus';
          if (id.includes('/src/pages/admin/AdminReps')) return 'admin-reps';
          if (id.includes('/src/pages/admin/AdminAactivatedPromos')) return 'admin-promos';
          if (id.includes('/src/pages/admin/')) return 'admin';
          if (id.includes('/src/pages/patient/')) return 'patient';
          if (id.includes('/src/pages/public/')) return 'public';
          if (id.includes('/src/pages/rep/')) return 'rep';
          if (id.includes('/src/pages/physician/')) return 'physician';
          if (id.includes('/src/pages/fulfillment/')) return 'fulfillment';
        },
      },
    },
  },
})
