// Security headers via helmet. The Content-Security-Policy only matters for the
// HTML page (the built frontend served in production), so its allow-list has to
// cover everything the frontend loads from other origins.

import helmet from 'helmet';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      // Product images come from Shopify's CDN.
      'img-src': ["'self'", 'data:', 'blob:', 'https://cdn.shopify.com'],
      // Fonts are self-hosted (bundled by Vite), so no font CDN is allowed.
      'style-src': ["'self'", "'unsafe-inline'"],
      'font-src': ["'self'", 'data:'],
      // Admin image uploads go from the browser straight to Shopify's staged
      // upload storage (see routes/storage.ts).
      'connect-src': ["'self'", 'https://shopify-staged-uploads.storage.googleapis.com'],
    },
  },
});
