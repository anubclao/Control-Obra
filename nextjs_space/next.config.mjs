/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Security headers — aplicados a TODAS las rutas.
  // Por qué este bloque existe:
  //   - Sin CSP, el sitio es vulnerable a XSS si un input del usuario
  //     llegara a renderizarse como HTML/JS sin sanitizar.
  //   - Sin HSTS, un atacante en la misma red puede downgradear a HTTP.
  //   - Sin X-Frame-Options, el sitio puede ser embebido en iframes
  //     (clickjacking).
  //   - Sin X-Content-Type-Options, navegadores pueden hacer MIME-sniffing
  //     de uploads y ejecutar contenido malicioso.
  async headers() {
    const securityHeaders = [
      // HSTS: forzar HTTPS por 1 año, incluir subdominios.
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      },
      // Prevenir MIME-sniffing.
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      // Anti clickjacking: no permitir ser embebido en iframes.
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      // XSS protection legacy (navegadores modernos ya lo ignoran, pero
      // no hace daño).
      {
        key: "X-XSS-Protection",
        value: "1; mode=block",
      },
      // Política de referrers más estricta.
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      // Permisos del navegador: no permitir cámara/micrófono/geolocalización
      // salvo que se necesite explícitamente (no es el caso de este ERP).
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
      // Content Security Policy.
      //   - default-src 'self': solo recursos del mismo origen.
      //   - script-src 'self' 'unsafe-inline' + nonce: Next.js necesita
      //     inline scripts para hidratación; el nonce se aplica vía middleware
      //     (no implementado aquí porque añade complejidad). 'unsafe-inline'
      //     es el trade-off hasta que se implemente nonce-based CSP.
      //   - style-src 'self' 'unsafe-inline': Tailwind y shadcn/ui requieren
      //     inline styles.
      //   - img-src 'self' data: blob: https:: imágenes de BD o Next/Image.
      //   - connect-src 'self': solo fetch al mismo origen.
      //   - frame-ancestors 'none': refuerza X-Frame-Options.
      //   - base-uri 'self': previene <base> tag injection.
      //   - form-action 'self': formularios solo a mismo origen.
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
