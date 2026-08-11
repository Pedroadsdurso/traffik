/**
 * Modelos favoritos e histórico recente do UTM Builder.
 *
 * > ### 🟡 NADA AQUI SOBREVIVE À SESSÃO — e a tela DECLARA isso
 * >
 * > Não existe tabela. Conferido no `schema.prisma` em 11/08/2026: nenhum dos
 * > 24 modelos guarda modelo de UTM nem histórico de geração.
 * >
 * > A decisão do dono foi construir a tela agora contra esta interface, e a
 * > migration numa sessão só de schema — junto do `ocorreEm` da despesa única,
 * > que foi separado pelo mesmo motivo: **migration não entra no meio de commit
 * > de tela.**
 *
 * ## Por que memória e não `localStorage`
 *
 * `localStorage` funcionaria hoje e sumiria na outra máquina — **sem avisar**.
 * Um modelo favorito é configuração que o usuário acredita ter salvo: a tela
 * confirma o salvamento e o produto não guardou. É o controle inerte, pago em
 * confiança.
 *
 * A memória perde o dado no recarregamento, que é frequente o bastante para
 * ninguém construir hábito em cima — e `persiste: false` obriga a tela a dizer
 * a verdade em texto, em vez de deixar a descoberta para depois.
 *
 * ⛔ **Ao ligar o banco, `persiste` vira `true` e os estados vazios mudam
 * sozinhos.** Se você trocar a implementação e o texto continuar dizendo "não
 * são guardados", a documentação virou mentira no primeiro commit — que é a
 * família que esta base já pagou nove vezes. O `persiste` existe para que a
 * frase seja DERIVADA e não afirmada.
 */

import type { ChaveUtm, EntradaUtm } from "./construir";

export interface ModeloUtm {
  id: string;
  nome: string;
  /** Só os campos de parâmetro. A base não entra: ela muda a cada oferta. */
  campos: Partial<Record<ChaveUtm, string>>;
  favorito: boolean;
  criadoEm: string;
}

export interface EntradaHistorico {
  id: string;
  /** ISO. Quem formata é a tela, via `<Desde>` — nunca `Date.now()` no render. */
  em: string;
  url: string;
  source: string | null;
  medium: string | null;
  campanha: string | null;
}

export interface ArmazemUtm {
  /**
   * `false` = o que for gravado morre no recarregamento.
   *
   * ⛔ A tela LÊ isto para escrever o aviso. Não escreva a frase à mão.
   */
  readonly persiste: boolean;
  listarModelos(): ModeloUtm[];
  salvarModelo(nome: string, campos: EntradaUtm): ModeloUtm | null;
  removerModelo(id: string): void;
  alternarFavorito(id: string): void;
  listarHistorico(): EntradaHistorico[];
  registrarNoHistorico(e: Omit<EntradaHistorico, "id" | "em">): void;
  /** Avisa a tela quando algo muda. Devolve a função que cancela a inscrição. */
  observar(ouvinte: () => void): () => void;
}

const LIMITE_HISTORICO = 12;

/**
 * ⚠️ **Modelos e histórico NÃO são recortados por área**, e isso é decisão, não
 * esquecimento.
 *
 * A regra do artefato vale para o que o usuário **instala** — o script de UTM
 * embute o `WS` e trocar de área precisa trocar o script. Um modelo de UTM é um
 * preset de formulário: `facebook / cpc / lancamento` significa a mesma coisa em
 * qualquer área. Recortá-lo por área faria o modelo "sumir" ao trocar de
 * operação, que é o defeito oposto e igualmente mudo.
 */
function criarArmazemEmMemoria(): ArmazemUtm {
  let modelos: ModeloUtm[] = [];
  let historico: EntradaHistorico[] = [];
  const ouvintes = new Set<() => void>();
  let sequencia = 0;

  const avisar = () => ouvintes.forEach((f) => f());
  /* `crypto.randomUUID` não existe em todo alvo, e um contador basta: o id só
     precisa ser único DENTRO desta sessão, que é toda a vida do armazém. */
  const proximoId = (prefixo: string) => `${prefixo}-${++sequencia}`;

  return {
    persiste: false,

    listarModelos: () => modelos,

    salvarModelo(nome, campos) {
      const limpo = typeof nome === "string" ? nome.trim() : "";
      if (!limpo) return null;

      const guardados: Partial<Record<ChaveUtm, string>> = {};
      for (const [k, v] of Object.entries(campos)) {
        if (k === "base") continue;
        // Mesmo guarda do `montarUrl`: o que não é texto não entra no modelo.
        // Sem ele, um `[object Object]` gravado aqui reapareceria a cada uso.
        if (typeof v === "string" && v.trim()) guardados[k as ChaveUtm] = v.trim();
      }
      if (Object.keys(guardados).length === 0) return null;

      const modelo: ModeloUtm = {
        id: proximoId("mod"),
        nome: limpo,
        campos: guardados,
        favorito: true,
        criadoEm: new Date().toISOString(),
      };
      modelos = [modelo, ...modelos];
      avisar();
      return modelo;
    },

    removerModelo(id) {
      modelos = modelos.filter((m) => m.id !== id);
      avisar();
    },

    alternarFavorito(id) {
      modelos = modelos.map((m) => (m.id === id ? { ...m, favorito: !m.favorito } : m));
      avisar();
    },

    listarHistorico: () => historico,

    registrarNoHistorico(e) {
      /* Gerar duas vezes a mesma URL não vira duas linhas: o histórico responde
         "o que eu montei ultimamente", e a repetição não acrescenta resposta. */
      if (historico[0]?.url === e.url) return;
      historico = [{ ...e, id: proximoId("hist"), em: new Date().toISOString() }, ...historico].slice(
        0,
        LIMITE_HISTORICO,
      );
      avisar();
    },

    observar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
  };
}

/**
 * O armazém da sessão.
 *
 * Módulo é o escopo certo: ele sobrevive à navegação entre telas (que no App
 * Router não recarrega a página) e morre no F5 — que é exatamente a promessa que
 * o texto da tela faz.
 */
export const armazemUtm: ArmazemUtm = criarArmazemEmMemoria();
