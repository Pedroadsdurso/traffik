import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthForm } from "../AuthForm";
import { AuthShell } from "../AuthShell";
import { signupAction } from "../actions";

export const metadata = { title: "Criar conta · Trackhub" };

export default async function SignupPage() {
  // Checa o `id`, não só a sessão: um JWT órfão (de outro banco) chega com
  // `user` mas SEM id. Testar a sessão inteira mandava de volta ao /dashboard,
  // que por sua vez mandava para cá — ERR_TOO_MANY_REDIRECTS. As duas pontas
  // precisam usar exatamente o mesmo critério de "está logado".
  const sessao = await auth();
  if (sessao?.user?.id) redirect("/dashboard");

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
