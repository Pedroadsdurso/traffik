import { redirect } from "next/navigation";

// A tela de UTMs saiu de dentro de Integrações e virou área de primeiro nível
// (`/dashboard/utm`) em 11/08/2026. A rota antiga fica como redirect: ela está
// em link salvo e em documentação, e 404 aqui parece recurso removido.
export default function UtmsAntiga() {
  redirect("/dashboard/utm");
}
