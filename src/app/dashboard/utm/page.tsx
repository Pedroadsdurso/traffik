import { redirect } from "next/navigation";

// Rota antiga "Rastreamento UTM" → agora Integrações › UTMs.
export default function LegacyUtm() {
  redirect("/dashboard/integracoes/utms");
}
