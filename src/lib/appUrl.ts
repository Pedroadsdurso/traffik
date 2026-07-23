/** URL pública da aplicação, usada para montar o snippet do pixel e as
 *  URLs de webhook. Cai para localhost em desenvolvimento. */
export function getAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
