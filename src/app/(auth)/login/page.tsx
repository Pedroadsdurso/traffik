import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthForm } from "../AuthForm";
import { AuthShell } from "../AuthShell";
import { loginAction } from "../actions";

export const metadata = { title: "Entrar · Traffik" };

export default async function LoginPage() {
  if (await auth()) redirect("/dashboard");

  return (
    <AuthShell
      kicker="Acesso"
      title="Entrar na sua conta"
      subtitle="Acompanhe cliques, vendas e campanhas em um só lugar."
      footer={
        <>
          Ainda não tem conta? <Link href="/signup">Criar conta</Link>
        </>
      }
    >
      <AuthForm action={loginAction} mode="login" />
    </AuthShell>
  );
}
