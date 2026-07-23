import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/auth";

/** Toda rota sob /dashboard exige sessão ativa. */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <>{children}</>;
}
