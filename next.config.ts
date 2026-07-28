import type { NextConfig } from "next";

/**
 * Runtimes instaláveis servidos de `public/`. O padrão do Next para arquivos
 * estáticos não-imutáveis é `max-age=0`, o que faria cada pageview do site do
 * cliente revalidar o arquivo antes de rastrear. Uma hora de cache + SWR mantém
 * o rastreamento imediato e ainda propaga correções no mesmo dia.
 */
const SCRIPTS_INSTALAVEIS = ["/t.js", "/px.js", "/pixel.js"];

const nextConfig: NextConfig = {
  async headers() {
    return SCRIPTS_INSTALAVEIS.map((source) => ({
      source,
      headers: [
        { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        // Servido para páginas de terceiros; nenhuma delas envia credencial.
        { key: "Access-Control-Allow-Origin", value: "*" },
      ],
    }));
  },
};

export default nextConfig;
