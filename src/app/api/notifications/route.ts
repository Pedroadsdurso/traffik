import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { listNotifications } from "@/lib/actions/notifications";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });
  const data = await listNotifications(req.nextUrl.searchParams.get("ws"));
  return Response.json(data);
}
