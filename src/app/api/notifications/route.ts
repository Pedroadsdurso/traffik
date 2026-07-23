import { auth } from "@/auth";
import { listNotifications } from "@/lib/actions/notifications";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });
  const data = await listNotifications();
  return Response.json(data);
}
