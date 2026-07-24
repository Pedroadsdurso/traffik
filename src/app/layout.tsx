import type { Metadata } from "next";
// CSS base do grid arrastável do Dashboard (posicionamento e placeholder).
// Vem antes do globals.css para que os nossos overrides ganhem.
import "react-grid-layout/css/styles.css";
import "./globals.css";

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
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
