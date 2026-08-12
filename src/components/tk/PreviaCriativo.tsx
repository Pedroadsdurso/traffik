"use client";

/**
 * A pré-visualização de um criativo — e a **ausência** dela, que é o caso comum.
 *
 * > ## 🔴 A IMAGEM DA META EXPIRA EM ~4 DIAS, E É 64×64
 * >
 * > Medido em 12/08/2026 no backup de produção de 01/08, nos **13 de 13**
 * > criativos reais da conta do dono:
 * >
 * > | | |
 * > |---|---|
 * > | resolução do `thumbnailUrl` | **`_p64x64` em 13 de 13** — ícone, não miniatura |
 * > | expiração (parâmetro `oe=`) | entre **34h** e **4,5 dias** após o sync |
 * > | `imageUrl` (a imagem grande) | existe em **1 de 13** — os outros 12 são vídeo |
 * >
 * > Em 12/08 as treze estavam vencidas havia uma semana. **O estado normal desta
 * > tela em produção é a imagem não carregar.**
 *
 * ## ⛔ POR QUE NÃO EXISTE QUADRADO CINZA AQUI
 *
 * A saída óbvia — reservar a caixa e deixá-la vazia quando falha — é a mesma
 * família do *vão dentro de um card*: um retângulo vazio **promete** que ali
 * cabia uma imagem, e quem olha conclui que a ferramenta está carregando, ou
 * quebrada. Ela não está: a Meta expirou o link, e isso é normal.
 *
 * Então o fracasso não deixa buraco — ele desenha o **bloco tipográfico**, que é
 * conteúdo de verdade (o nome do criativo, legível, na identidade do produto) e
 * declara a causa num selo. A tela nunca finge ter imagem.
 *
 * ## As três entradas, e elas são três estados diferentes
 *
 * | Entrada | O que se desenha |
 * |---|---|
 * | URL que carrega | a imagem |
 * | URL que falha (`onError`) | bloco tipográfico + selo `pré-visualização indisponível` |
 * | sem URL nenhuma | bloco tipográfico, **sem** selo — não houve tentativa que falhasse |
 *
 * ⚠️ A terceira NÃO leva selo, e a distinção não é cosmética: *"tentei e a Meta
 * recusou"* e *"a Meta nunca mandou imagem"* são fatos diferentes sobre a conta,
 * e colapsá-los é a distinção central deste projeto sendo perdida mais uma vez.
 *
 * 🔜 Resolver de vez exige copiar a imagem para armazenamento nosso durante o
 * sync — **backend novo**, fora do escopo do redesign, decidido em 12/08/2026.
 */
import * as React from "react";

import { Badge } from "@/components/tk/Badge";

/**
 * A cor do bloco vem do NOME, de forma estável.
 *
 * ⚠️ Determinística de propósito: com `Math.random()` o mesmo criativo mudaria
 * de cor a cada render, e a cor deixaria de ser um jeito de reconhecê-lo na
 * grade — que é a única coisa que ela faz aqui.
 *
 * ⛔ E o matiz é **decoração, não dado**: ele não codifica desempenho, formato
 * nem estado. Se um dia codificar, vira a "cor semântica para grandeza não
 * semântica" que o `CLAUDE.md` proíbe.
 */
function matizDoNome(nome: string): number {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) % 360;
  return h;
}

function iniciais(nome: string): string {
  const palavras = nome
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!palavras.length) return "?";
  return palavras
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function PreviaCriativo({
  nome,
  url,
  formato,
  altura,
  compacta = false,
}: {
  nome: string;
  url: string | null;
  /** `"Vídeo"` ganha o triângulo de play sobreposto. */
  formato?: string;
  /** Altura em px. Na tabela é ~40; no card da grade, ~150. */
  altura: number;
  /** Versão de tabela: sem selo, sem play — só a marca visual. */
  compacta?: boolean;
}) {
  /**
   * O estado guarda **qual URL falhou**, não um booleano.
   *
   * ⚠️ Com `boolean` era preciso um efeito para zerá-lo quando o sync renovasse
   * o link — senão o criativo que falhou ficaria em fallback para sempre, com
   * imagem nova válida na mão. E `setState` dentro de efeito é cascata de
   * render, que o lint desta base reprova com razão.
   *
   * Guardando a URL, a comparação acontece no próprio render: URL nova é
   * diferente da que falhou, então ela é tentada. Zero efeito, zero cascata, e
   * a regra fica legível na expressão em vez de escondida numa lista de deps.
   *
   * ⚠️ E não há divergência de hidratação: o primeiro render é sempre o `<img>`,
   * nos dois lados — `onError` só dispara no navegador.
   */
  const [urlQueFalhou, setUrlQueFalhou] = React.useState<string | null>(null);

  const falhou = !!url && urlQueFalhou === url;
  const mostrarImagem = !!url && !falhou;
  const matiz = matizDoNome(nome);

  return (
    <div
      className="tk-previa"
      style={{
        position: "relative",
        width: "100%",
        height: altura,
        borderRadius: compacta ? 8 : "var(--tk-radius-card)",
        overflow: "hidden",
        /* ⚠️ `--tk-surface-hover`, não um `--tk-surface-sunken` — que NÃO
           EXISTE. Token é casamento de string com o `globals.css`: o inventado
           compila, passa no lint e cai no fallback, com cor errada e nada
           acusando. Foi o erro de 08/08 no Gerenciador, e a conferência aqui
           foi `grep` no CSS antes de escrever a linha. */
        background: mostrarImagem
          ? "var(--tk-surface-hover)"
          : `linear-gradient(135deg, oklch(0.55 0.09 ${matiz}), oklch(0.38 0.07 ${(matiz + 40) % 360}))`,
        display: "grid",
        placeItems: "center",
        flex: "none",
      }}
    >
      {mostrarImagem ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt={nome}
          onError={() => setUrlQueFalhou(url)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        /* O bloco tipográfico. `aria-hidden` porque o nome do criativo já está
           escrito ao lado, em texto de verdade — anunciar as iniciais de novo é
           ruído para quem usa leitor de tela. */
        <div
          aria-hidden="true"
          style={{
            color: "oklch(0.99 0 0 / 0.92)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            fontSize: Math.max(13, Math.round(altura * 0.34)),
            lineHeight: 1,
          }}
        >
          {iniciais(nome)}
        </div>
      )}

      {!compacta && formato === "Vídeo" && mostrarImagem && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: "oklch(0.15 0 0 / 0.55)",
              display: "grid",
              placeItems: "center",
              color: "oklch(0.99 0 0)",
              fontSize: 14,
              paddingLeft: 3,
            }}
          >
            ▶
          </span>
        </span>
      )}

      {/* ⛔ SÓ quando houve tentativa E ela falhou. Sem URL não há o que
          declarar — ver o cabeçalho deste arquivo. */}
      {!compacta && url && falhou && (
        <span style={{ position: "absolute", left: 8, bottom: 8 }}>
          <Badge tom="neutral" title="A Meta assina os links de imagem e eles expiram em poucos dias. A pré-visualização volta na próxima sincronização da conta.">
            pré-visualização indisponível
          </Badge>
        </span>
      )}
    </div>
  );
}
