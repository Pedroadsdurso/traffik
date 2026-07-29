import { cache } from "react";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

/**
 * Resolve o id do usuário pelo e-mail — a auto-cura de sessões obsoletas
 * (ver commit a08d0e9). O problema é que o callback `session` roda a cada
 * `auth()`, e um carregamento de página chama `auth()` ~10x (o guard + cada
 * server action do layout): eram 10 idas ao banco de ~100ms só para redescobrir
 * o mesmo id. São duas camadas de cache:
 *
 * 1. `cache()` do React — colapsa as ~10 chamadas de UM request em uma só.
 * 2. TTL em memória — evita repetir a query a cada request. O mapa e-mail→id é
 *    praticamente imutável, então uma janela curta de defasagem é inofensiva:
 *    no pior caso (usuário removido/recriado) volta a errar por até TTL_MS e
 *    depois se auto-cura sozinho, exatamente como antes.
 *
 * Em serverless o mapa vive por instância quente, o que é o comportamento
 * desejado. É pequeno por natureza (uma entrada por usuário ativo).
 */
const TTL_MS = 5 * 60_000;
const idCache = new Map<string, { id: string; exp: number }>();

const resolveUserIdByEmail = cache(async (email: string): Promise<string | null> => {
  const hit = idCache.get(email);
  if (hit && hit.exp > Date.now()) return hit.id;

  const dbUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!dbUser) {
    idCache.delete(email);
    return null;
  }
  idCache.set(email, { id: dbUser.id, exp: Date.now() + TTL_MS });
  return dbUser.id;
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Atrás do proxy da Vercel o host precisa ser confiável, senão auth() lança
  // UntrustedHost e derruba toda página que checa sessão.
  trustHost: true,
  // Credentials exige JWT: a sessão em banco do adapter não é usada aqui.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      // Auto-cura sessões obsoletas: um JWT emitido por um banco anterior
      // carrega um `sub` que não existe mais (viola FK ao gravar). Resolvemos
      // o id atual pelo e-mail (índice único) a cada sessão, com fallback ao
      // `sub`. Evita o clássico "exige relogin" após trocar de banco.
      if (typeof token.email === "string") {
        const id = await resolveUserIdByEmail(token.email);
        if (id) {
          session.user.id = id;
          return session;
        }
        // ⚠️ E-mail no token, mas NENHUM usuário com ele neste banco: a sessão
        // é órfã (o caso clássico é ter trocado a `DATABASE_URL`).
        //
        // Antes caía no `token.sub` — um id FANTASMA, que existia no banco
        // anterior e não existe aqui. Resultado: o guard deixava passar e a
        // primeira escrita estourava `Foreign key constraint violated`, com a
        // tela inteira em 500 e nenhuma pista do motivo. Sessão sem usuário
        // real tem de se comportar como "não logado": o guard manda para o
        // login e o relogin resolve.
        delete (session.user as { id?: string }).id;
        return session;
      }
      // Sem e-mail no token (formato antigo): o `sub` é tudo o que há.
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
