import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthForm } from "../AuthForm";
import { AuthShell } from "../AuthShell";
import { signupAction } from "../actions";

export const metadata = { title: "Criar conta · Traffik" };

export default async function SignupPage() {
  if (await auth()) redirect("/dashboard");

  return (
    <AuthShell
      kicker="Comece agora"
      title="Criar sua conta"
      subtitle="Leva menos de um minuto. Seu webhook de vendas já sai configurado."
      footer={
        <>
          Já tem conta? <Link href="/login">Entrar</Link>
        </>
      }
    >
      <AuthForm action={signupAction} mode="signup" />
    </AuthShell>
  );
}
