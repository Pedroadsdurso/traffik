"use client";

import * as React from "react";

/**
 * Greeting — "Bom dia, Pedro" no lugar do título fixo do Dashboard.
 *
 * 🔴 O CÁLCULO É NO CLIENTE, E A SAUDAÇÃO SÓ APARECE DEPOIS DA HIDRATAÇÃO.
 * O servidor roda em UTC (Vercel) e não conhece o fuso de quem está olhando: se
 * ele renderizasse "Boa noite" e o cliente corrigisse para "Bom dia" no primeiro
 * frame, o texto piscaria em toda carga. Aqui o NOME já vai no HTML do servidor
 * e a saudação entra depois, num espaço que já estava reservado — sem piscar e
 * sem empurrar o layout.
 *
 * ⚠️ É a mesma regra do resto da base: **nenhuma leitura de hora usa o fuso do
 * processo**. A diferença é que aqui a fonte certa é o RELÓGIO DO APARELHO, não
 * o fuso configurado da conta — a saudação fala com quem está na frente da tela.
 *
 * ⚠️ Recalcula quando a aba volta ao foco. Quem deixa a ferramenta aberta o dia
 * inteiro — que é o caso — veria "Bom dia" às 19h. Sem timer: um `setInterval`
 * rodando o dia todo para trocar duas palavras não se paga.
 */

function saudacaoDaHora(h: number): string {
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Primeiro nome → nome completo → parte do e-mail antes do @ → nada.
 * Nunca "undefined", nunca "usuário": um rótulo genérico é pior que a ausência,
 * porque parece que a ferramenta não sabe quem você é.
 */
export function primeiroNome(nome?: string | null, email?: string | null): string | null {
  const limpo = (nome ?? "").trim();
  if (limpo) {
    const primeiro = limpo.split(/\s+/)[0]!;
    return truncar(primeiro || limpo);
  }
  const antesDoArroba = (email ?? "").split("@")[0]?.trim();
  return antesDoArroba ? truncar(antesDoArroba) : null;
}

const LIMITE = 20;
function truncar(s: string): string {
  return s.length > LIMITE ? `${s.slice(0, LIMITE - 1)}…` : s;
}

export function Greeting({
  nome,
  email,
  subtitulo,
}: {
  nome?: string | null;
  email?: string | null;
  subtitulo: React.ReactNode;
}) {
  const [saudacao, setSaudacao] = React.useState<string | null>(null);

  React.useEffect(() => {
    const calcular = () => setSaudacao(saudacaoDaHora(new Date().getHours()));
    calcular();
    // Só quando a aba volta ao foco — sem timer.
    const aoVoltar = () => document.visibilityState === "visible" && calcular();
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", calcular);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", calcular);
    };
  }, []);

  const pessoa = primeiroNome(nome, email);

  return (
    <div style={{ minWidth: 0 }}>
      <h1 className="text-display text-text" style={{ margin: 0 }}>
        {/* Sem saudação ainda (antes da hidratação), o nome aparece sozinho e a
            saudação entra à esquerda. O `min-height` da linha não muda, então
            não há salto — só o texto crescendo para dentro do espaço que já era
            dele. */}
        {saudacao ? (pessoa ? `${saudacao}, ${pessoa}` : saudacao) : (pessoa ?? " ")}
      </h1>
      <p className="text-body text-text-secondary" style={{ margin: "2px 0 0" }}>
        {subtitulo}
      </p>
    </div>
  );
}
