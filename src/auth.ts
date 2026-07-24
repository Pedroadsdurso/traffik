import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

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
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true },
        });
        if (dbUser) {
          session.user.id = dbUser.id;
          return session;
        }
      }
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
