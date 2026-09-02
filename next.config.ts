import type { NextConfig } from 'next';

// Mapa ładuje kafle z dwóch zewnętrznych hostów: WMTS Geoportalu (topo,
// ortofotomapa, BDOT10k — src/lib/geoportal.ts) i OpenStreetMap
// (ol/source/OSM, domyślnie tile.openstreetmap.org). CSP niżej idzie jako
// Report-Only, nie wymuszający: bez przeglądarki pod ręką nie da się
// sprawdzić, czy OpenLayers gdzieś po drodze nie potrzebuje czegoś, czego
// tu nie przewidziano (blob: dla canvasu, worker-src) — Report-Only nic
// nie blokuje, tylko loguje naruszenia do konsoli, więc daje realną
// widoczność bez ryzyka ubicia mapy w produkcji.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: https://mapy.geoportal.gov.pl https://*.tile.openstreetmap.org",
  "style-src 'self' 'unsafe-inline'", // komponenty ustawiają kolory kategorii przez style={{...}}
  "script-src 'self'",
  "connect-src 'self' https://mapy.geoportal.gov.pl https://*.tile.openstreetmap.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  typedRoutes: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), camera=(), microphone=(), interest-cohort=()',
          },
          { key: 'Content-Security-Policy-Report-Only', value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
