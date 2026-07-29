import type { Metadata } from "next";
import Script from "next/script";
import "react-grid-layout/css/styles.css";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

/**
 * Anti-FOUC do tema: aplica `data-theme` ANTES da primeira pintura, senão a
 * página aparece no tema escuro por um instante para quem escolheu o claro.
 */
const SCRIPT_TEMA = `(function(){try{var s=localStorage.getItem('traffik_theme');
document.documentElement.setAttribute('data-theme',s==='light'||s==='dark'?s:'dark');}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Traffik",
  description: "Tracking de tráfego, vendas e Facebook Ads",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        {/*
          `next/script` com `beforeInteractive`, e NÃO uma tag <script> crua.
          Uma <script> escrita como elemento React dispara no console:
          "Encountered a script tag while rendering React component. Scripts
          inside React components are never executed when rendering on the
          client" — e o aviso é literal: numa navegação pelo cliente a tag é
          inserida via innerHTML e o navegador não a executa.

          `beforeInteractive` injeta o código no HTML inicial e roda antes de
          qualquer módulo do Next, que é exatamente o que o anti-FOUC precisa.
          A documentação exige que ele fique no layout raiz.
        */}
        <Script id="traffik-tema" strategy="beforeInteractive">
          {SCRIPT_TEMA}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
