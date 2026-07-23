import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { listWebhooks } from "@/lib/actions/webhooks";
import { getAppUrl } from "@/lib/appUrl";
import { TestCheckout } from "./TestCheckout";

export const metadata = { title: "Checkout de teste · Traffik" };

export default async function TestCheckoutPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const webhooks = await listWebhooks();
  const active = webhooks.find((w) => w.active) ?? webhooks[0] ?? null;

  return <TestCheckout trackingId={session.user.id} appUrl={getAppUrl()} webhookUrl={active?.url ?? null} />;
}
