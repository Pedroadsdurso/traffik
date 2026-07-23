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
