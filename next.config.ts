import type { NextConfig } from "next";

/**
 * Runtimes instaláveis servidos de `public/`. O padrão do Next para arquivos
 * estáticos não-imutáveis é `max-age=0`, o que faria cada pageview do site do
 * cliente revalidar o arquivo antes de rastrear.
 *
 * ⚠️ TTL curto de propósito. Com `max-age=3600` (o valor anterior), uma correção
 * no rastreamento levava até 1h para chegar em quem já tinha o arquivo em cache —
 * isso atrapalhou um diagnóstico real em 28/07/2026, com o navegador executando a
 * versão velha enquanto o servidor já tinha a nova. Com 5 min + `stale-while-
 * revalidate`, o arquivo continua sendo servido na hora (sem esperar rede) e a
 * correção se propaga rápido.
 */
const SCRIPTS_INSTALAVEIS = ["/t.js", "/px.js", "/pixel.js"];

const nextConfig: NextConfig = {
  async headers() {
    return SCRIPTS_INSTALAVEIS.map((source) => ({
      source,
      headers: [
        { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=86400" },
        // Servido para páginas de terceiros; nenhuma delas envia credencial.
        { key: "Access-Control-Allow-Origin", value: "*" },
      ],
    }));
  },
};

export default nextConfig;
