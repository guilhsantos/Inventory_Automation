import type { NextConfig } from "next";

// Cabeçalhos de segurança aplicados a todas as páginas
const securityHeaders = [
  // Impede que o app seja embutido em iframe de outro site (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Navegador não "adivinha" o tipo de arquivo
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Não envia a URL completa para outros sites
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Câmera só para o próprio app (scanner de código de barras)
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Desative isso se o erro de build persistir
  // reactCompiler: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
