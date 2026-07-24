/** URL pública da aplicação, usada para montar o snippet do pixel e as
 *  URLs de webhook. Detecta o domínio da Vercel automaticamente. */
export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // Na Vercel esses são preenchidos automaticamente.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

/**
 * Versão utilizável em componentes client — é a URL que fica **embutida nos
 * scripts gerados** (pixel e UTM), que rodam no site do cliente e por isso não
 * podem usar `window.location.origin` (ali o origin é o site dele, não o nosso).
 *
 * `NEXT_PUBLIC_APP_URL` precisa ser lido como literal: o Next substitui a
 * expressão inteira em tempo de build, então nada de desestruturar `process.env`.
 */
export function getPublicAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // Sem a env var, cai no origin atual — funciona em dev, mas em produção gera
  // script apontando para o domínio errado. Por isso a UI mostra a URL resolvida.
  if (typeof window !== "undefined") return window.location.origin;
  return getAppUrl();
}
