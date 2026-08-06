import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "react-grid-layout/css/styles.css";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

/**
 * Fontes do redesign (Fase 1). `next/font` baixa e auto-hospeda no build — não
 * há requisição para o Google em tempo de execução, e não há salto de layout.
 *
 * ⚠️ Registrar NÃO é aplicar. O `body` continua em `var(--font-body)` (Inter,
 * importada no topo do globals.css). Trocar a fonte do body reflui as 21 rotas
 * de uma vez, num dashboard denso, sem ninguém ter olhado nenhuma delas — é
 * "tocar em tela existente" pela porta dos fundos. Quem consome estas fontes
 * nesta fase é só /design-system, via `--tk-font-sans` / `--tk-font-mono`.
 * A troca do body é da Fase 3, junto com o shell que a verifica.
 */
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

/**
 * Anti-FOUC do tema: aplica `data-theme` ANTES da primeira pintura, senão a
 * página aparece no tema escuro por um instante para quem escolheu o claro.
 */
const SCRIPT_TEMA = `(function(){try{var s=localStorage.getItem('traffik_theme');
document.documentElement.setAttribute('data-theme',s==='light'||s==='dark'?s:'dark');}catch(e){}})();`;

export const metadata: Metadata = {
  title: "TrackHub",
  description: "Tracking de tráfego, vendas e Facebook Ads",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/*
          🔴 SCRIPT INLINE NO <head>, e NÃO `next/script` com `beforeInteractive`.

          O comentário que estava aqui defendia o contrário e estava errado — ele
          confundia dois casos. O aviso "Encountered a script tag while rendering
          React component" vale para uma <script> que aparece DEPOIS da carga
          inicial: numa navegação pelo cliente o React insere o nó via innerHTML e
          o navegador não executa. Não é o caso de um script do LAYOUT RAIZ, que
          só existe no HTML do primeiro documento — ali o navegador executa
          normalmente, como executaria qualquer <script> de um HTML servido.

          Na prática o `next/script` era quem estava disparando o aviso, e com a
          aplicação inteira em tela preta. `dangerouslySetInnerHTML` entrega o
          código como TEXTO do elemento, sem passar por criação de nó no cliente.

          ⚠️ O anti-FOUC continua sendo o ponto: sem isto a página aparece no
          escuro por um instante para quem escolheu o claro. O script tem de rodar
          ANTES da primeira pintura, e é por isso que ele mora no <head> e é
          síncrono — nada de `defer`, nada de `useEffect`.
        */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
