import { redirect } from "next/navigation";

// Rota antiga "Facebook Ads" → agora Integrações › Anúncios.
export default function LegacyFacebook() {
  redirect("/dashboard/integracoes/anuncios");
}
