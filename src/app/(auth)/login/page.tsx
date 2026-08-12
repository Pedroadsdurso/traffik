import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { TelaAuth } from "@/components/auth/TelaAuth";
import { loginAction } from "../actions";

export const metadata = { title: "Entrar · TrackHub" };

export default async function LoginPage() {
  // Checa o `id`, não só a sessão: um JWT órfão (de outro banco) chega com
  // `user` mas SEM id. Testar a sessão inteira mandava de volta ao /dashboard,
  // que por sua vez mandava para cá — ERR_TOO_MANY_REDIRECTS. As duas pontas
  // precisam usar exatamente o mesmo critério de "está logado".
  const sessao = await auth();
  if (sessao?.user?.id) redirect("/dashboard");

  return <TelaAuth modo="login" acao={loginAction} />;
}
