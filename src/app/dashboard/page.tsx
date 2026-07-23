import { auth } from "@/auth";
import { TraffikApp } from "@/components/dashboard/TraffikApp";

export default async function DashboardPage() {
  const session = await auth();
  return <TraffikApp user={{ name: session?.user?.name, email: session?.user?.email }} />;
}
