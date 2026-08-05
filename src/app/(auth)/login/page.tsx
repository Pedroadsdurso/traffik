import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthForm } from "../AuthForm";
import { AuthShell } from "../AuthShell";
import { loginAction } from "../actions";

export const metadata = { title: "Entrar · Trackhub" };

export default async function LoginPage() {
  // Checa o `id`, não só a sessão: um JWT órfão (de outro banco) chega com
  // `user` mas SEM id. Testar a sessão inteira mandava de volta ao /dashboard,
  // que por sua vez mandava para cá — ERR_TOO_MANY_REDIRECTS. As duas pontas
  // precisam usar exatamente o mesmo critério de "está logado".
  const sessao = await auth();
  if (sessao?.user?.id) redirect("/dashboard");

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
