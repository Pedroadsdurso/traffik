import type { Metadata } from "next";
// CSS base do grid arrastável do Dashboard (posicionamento e placeholder).
// Vem antes do globals.css para que os nossos overrides ganhem.
import "react-grid-layout/css/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Traffik",
  description: "Tracking de tráfego, vendas e Facebook Ads",
  // Favicon: `src/app/icon.png` e `apple-icon.png` são a convenção de arquivo do
  // Next — ele injeta os <link> sozinho, com hash de cache. Foram gerados a
  // partir do .webp original via sharp (`scripts/gen-favicon.mjs`), porque a
  // convenção não aceita webp e nem todo browser desenha favicon nesse formato.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
