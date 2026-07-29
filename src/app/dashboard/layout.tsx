import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/auth";

/**
 * Toda rota sob /dashboard exige sessão ativa **com usuário existente**.
 *
 * A checagem é por `user.id`, não por `user`: uma sessão órfã (JWT de um banco
 * anterior, cujo e-mail não existe mais aqui) chega com `user` preenchido e
 * **sem id**. Testar só `user` deixava ela passar, e o 500 aparecia lá na
 * frente, na primeira escrita que violasse a FK.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <>{children}</>;
}
