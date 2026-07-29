import { AreasView } from "@/components/dashboard/views/AreasView";

export const metadata = { title: "Áreas de Trabalho · Traffik" };

/**
 * Destino do "Gerenciar áreas" do seletor da sidebar — que até aqui dava 404.
 *
 * A view é autocontida (busca por server action, estado local), mesmo padrão de
 * `UtmsView`/`PixelView`: nada disto pertence ao `useTraffikState`, que existe
 * para o estado compartilhado entre telas.
 */
export default function AreasPage() {
  return <AreasView />;
}
