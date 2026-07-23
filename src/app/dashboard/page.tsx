import { auth } from "@/auth";
import { TraffikApp } from "@/components/dashboard/TraffikApp";
import { getAppUrl } from "@/lib/appUrl";

export default async function DashboardPage() {
  const session = await auth();
  return (
    <TraffikApp
      user={{ name: session?.user?.name, email: session?.user?.email }}
      trackingId={session?.user?.id}
      appUrl={getAppUrl()}
    />
  );
}
