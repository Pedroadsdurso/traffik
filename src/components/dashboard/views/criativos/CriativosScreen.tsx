"use client";

/**
 * CRIATIVOS — a décima tela. Referência: imagem 9.
 *
 * `GalleryTable` (padrão 6 do `03`): carrossel de cards em cima, tabela densa
 * embaixo, alternador entre as duas visões, **um** conjunto de filtros
 * alimentando as duas.
 *
 * ## 🔴 O QUE FOI MEDIDO ANTES DE ESCREVER ESTA TELA — 12/08/2026
 *
 * | | |
 * |---|---|
 * | miniatura da Meta | **`_p64x64`** e expira em **34h a 4,5 dias** (13/13 do backup de produção) |
 * | `Testes A/B` · `Pastas` | **não existem no schema** — zero acertos no `grep` |
 * | `Análise` (badge `Novo`) | sem especificação de conteúdo em nenhum documento |
 * | `Creative` no dev | era **0 linhas**; `npm run dev:criativos` resolveu |
 *
 * As três abas sem dado ficaram **🔧 fora**, por decisão do dono — aba com
 * contador que abre vazia é controle inerte com outra roupa. Ver `lib/ads/criativos.ts`.
 */
import * as React from "react";

import { Abas } from "@/components/tk/Abas";
import { Card, CardMetrica } from "@/components/tk/Card";
import { CardCriativo, rotuloBrl, rotuloPct, rotuloRoas } from "@/components/tk/CardCriativo";
import { EmptyState } from "@/components/tk/EmptyState";
import { Input } from "@/components/tk/Input";
import { Paginacao, type PorPagina } from "@/components/tk/Paginacao";
import { Segmented } from "@/components/tk/Segmented";
import { Select } from "@/components/tk/Select";
import { Skeleton } from "@/components/tk/Skeleton";
import { TabelaCriativos } from "@/components/tk/TabelaCriativos";
import { useRegistrarFaixaDeFiltros } from "@/components/tk/AppShell";
import { FiltroPeriodo } from "@/components/dashboard/ui/FiltroPeriodo";
import type { TraffikView } from "@/components/dashboard/useTraffikState";
import { ABAS, contarAbas, filtrarPorAba, kpisDosCriativos, type IdAba } from "@/lib/ads/criativos";
import type { CreativeRow } from "@/lib/ads/creatives";

type Visao = "grade" | "tabela";
type Formato = "todos" | "Vídeo" | "Imagem";

const TRACO = "—";

export function CriativosScreen({ v }: { v: TraffikView }) {
  const mostrarFiltros = useRegistrarFaixaDeFiltros();

  const [aba, setAba] = React.useState<IdAba>("todos");
  const [visao, setVisao] = React.useState<Visao>("grade");
  const [busca, setBusca] = React.useState("");
  const [formato, setFormato] = React.useState<Formato>("todos");
  const [pagina, setPagina] = React.useState(1);
  /* 🔧 A imagem 9 mostra `Mostrar 20`. Aqui é **25**, e a divergência é do
     PRIMITIVO, não desta tela: `Paginacao` oferece 10/25/50/100, e é a mesma
     escada do Gerenciador e do Pixel. Inventar um `20` só aqui faria a mesma
     lista paginar diferente de tela para tela — inconsistência real em troca de
     fidelidade a um número que a referência escolheu sem critério visível. */
  const [porPagina, setPorPagina] = React.useState<PorPagina>(25);

  const todos: CreativeRow[] = v.creatives;

  /* ⚠️ A ordenação já vem do servidor (`creativesSort`), e é a MESMA lista para
     a grade e para a tabela — duas ordenações dariam duas respostas para a
     mesma pergunta. Aqui só se filtra. */
  const filtrados = React.useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return filtrarPorAba(todos, aba).filter(
      (c) =>
        (formato === "todos" || c.format === formato) &&
        (termo === "" || c.name.toLowerCase().includes(termo) || c.campaign.toLowerCase().includes(termo)),
    );
  }, [todos, aba, formato, busca]);

  /* ⛔ Os KPIs somam a lista INTEIRA da área, não a página nem a aba. "CTR médio"
     dentro da aba `Em queda` seria o CTR dos que caíram — um número correto
     respondendo outra pergunta, e o rótulo não avisaria. */
  const kpis = React.useMemo(() => kpisDosCriativos(todos), [todos]);
  const contagens = React.useMemo(() => contarAbas(todos), [todos]);

  /**
   * Voltar para a primeira página quando o conjunto muda — senão o usuário fica
   * na página 4 de uma lista que agora tem 1, olhando o vazio.
   *
   * ⚠️ **Ajuste durante o render, não `useEffect`.** Com efeito, o React pinta
   * uma vez a página 4 vazia e só então corrige — o usuário vê o vazio piscar. E
   * `setState` síncrono dentro de efeito é cascata de render, reprovada pelo
   * lint desta base. Comparar a chave no corpo do componente é o padrão que a
   * própria documentação do React indica para "estado derivado de props".
   */
  const chave = [aba, formato, busca, v.creativesPeriod, v.creativesSort, v.workspaceAtiva].join("|");
  const [chaveAnterior, setChaveAnterior] = React.useState(chave);
  if (chave !== chaveAnterior) {
    setChaveAnterior(chave);
    setPagina(1);
  }

  const inicio = (pagina - 1) * porPagina;
  const daPagina = filtrados.slice(inicio, inicio + porPagina);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ── Faixa de filtros ────────────────────────────────────────────────
          Ela só existe porque a tela a REGISTRA — é o contrato que impede o
          botão `Filtros` do header de ficar inerte. */}
      {mostrarFiltros && (
        <Card>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <FiltroPeriodo
              minWidth={170}
              periodo={v.creativesPeriod}
              from={v.creativesFrom}
              to={v.creativesTo}
              timezone={v.timezone}
              onChange={v.setCreativesPeriod}
            />
            <Select
              rotulo="Ordenar por"
              valor={v.creativesSort}
              aoEscolher={(x) => v.setCreativesSort(x)}
              opcoes={[
                { valor: "roas", rotulo: "ROAS (maior)" },
                { valor: "ctr", rotulo: "CTR (maior)" },
                { valor: "spend", rotulo: "Gasto (maior)" },
                { valor: "sales", rotulo: "Vendas (maior)" },
              ]}
            />
            <Select
              rotulo="Formato"
              valor={formato}
              aoEscolher={setFormato}
              opcoes={[
                { valor: "todos", rotulo: "Todos os formatos" },
                { valor: "Vídeo", rotulo: "Vídeo" },
                { valor: "Imagem", rotulo: "Imagem" },
              ]}
            />
            <div style={{ minWidth: 220, flex: "1 1 220px" }}>
              <Input
                rotulo="Buscar"
                placeholder="Nome do criativo ou campanha"
                value={busca}
                onChange={(e) => setBusca(e.currentTarget.value)}
                blocoInteiro
              />
            </div>
          </div>
        </Card>
      )}

      {/* ── Os seis KPIs ────────────────────────────────────────────────────
          ⚠️ Todos com o MESMO tom (`primary`). §13 do `06`: quadrado tingido é
          decoração honesta e por isso não classifica — tingir cada um de uma cor
          faria a caixa parecer selo de estado. E nenhum recebe verde/vermelho:
          são volume e eficiência, não lucro. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16 }}>
        {v.creativesLoading && todos.length === 0
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} altura={116} />)
          : [
              { r: "Criativos", val: kpis.total.toLocaleString("pt-BR"), ic: "🖼", aj: "Anúncios com criativo na área ativa. Anúncio ainda não sincronizado não aparece." },
              { r: "CTR médio", val: rotuloPct(kpis.ctrMedio), ic: "👆", aj: "Soma dos cliques dividida pela soma das impressões — não a média dos CTR de cada criativo, que daria o mesmo peso a um teste de 50 impressões e a um em escala." },
              { r: "CPC médio", val: rotuloBrl(kpis.cpcMedio), ic: "💧", aj: "Gasto total dividido pelos cliques totais. Vem todo do Facebook." },
              { r: "Conversão", val: rotuloPct(kpis.conversao === null ? null : kpis.conversao * 100), ic: "🎯", aj: "Vendas por clique. Atenção: os cliques vêm do Facebook e as vendas do gateway — são dois instrumentos, e a razão herda a discordância entre eles." },
              { r: "ROAS médio", val: rotuloRoas(kpis.roasMedio), ic: "📈", aj: "Receita atribuída dividida pelo gasto, somando tudo. Receita do gateway, gasto do Facebook." },
              {
                r: "Entregando",
                val: kpis.veiculando.toLocaleString("pt-BR"),
                ic: "🟢",
                aj: "Quantos a Meta está entregando AGORA — pelo status efetivo, não pelo que foi configurado. Um anúncio ativo em campanha pausada não conta." + (kpis.semVeiculacaoConhecida > 0 ? `\n\n${kpis.semVeiculacaoConhecida} ainda não foram sincronizados e ficam fora desta conta — não sabemos se entregam.` : ""),
              },
            ].map((k) => (
              <CardMetrica key={k.r} rotulo={k.r} valor={k.val} ajuda={k.aj} icone={{ no: k.ic, tom: "primary" }} />
            ))}
      </div>

      {/* ── Abas + alternador de visão ─────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <Abas
          abas={ABAS.map((a) => ({ id: a.id, rotulo: a.rotulo, contagem: contagens[a.id] }))}
          ativa={aba}
          aoTrocar={setAba}
          rotuloAcessivel="Recortes de criativos"
        />
        {/* §14.1 — duas lentes fixas sobre o MESMO dado: Segmented, não Select. */}
        <Segmented
          valor={visao}
          aoTrocar={setVisao}
          rotuloAcessivel="Como exibir os criativos"
          opcoes={[
            { valor: "grade", rotulo: "▦ Grade", titulo: "Cards com pré-visualização" },
            { valor: "tabela", rotulo: "☰ Tabela", titulo: "Linhas densas, mais métricas por criativo" },
          ]}
        />
      </div>

      {/* A frase da aba ativa. Sem ela, `Em queda` é um rótulo sem critério — e
          um recorte cujo critério ninguém sabe é um número em que ninguém pode
          confiar. */}
      <p className="text-caption text-text-muted" style={{ margin: 0 }}>
        {ABAS.find((a) => a.id === aba)!.ajuda}
      </p>

      {/* ── O conteúdo ─────────────────────────────────────────────────────── */}
      {v.creativesLoading && todos.length === 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
          {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} altura={300} />)}
        </div>
      ) : filtrados.length === 0 ? (
        <Vazio temAlgum={todos.length > 0} aba={aba} />
      ) : (
        <>
          {visao === "grade" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16, alignItems: "start" }}>
              {/* ⚠️ `alignItems: start` — nomes de tamanhos diferentes fazem
                  cards de alturas diferentes, e esticar empurraria o vão para
                  DENTRO do card, onde ele promete conteúdo que não veio. */}
              {daPagina.map((c) => <CardCriativo key={c.id} c={c} />)}
            </div>
          ) : (
            <Card semPadding>
              <div style={{ padding: "var(--tk-pad-card)" }}>
                <TabelaCriativos linhas={daPagina} />
              </div>
            </Card>
          )}

          <Paginacao
            total={filtrados.length}
            pagina={pagina}
            porPagina={porPagina}
            aoTrocarPagina={setPagina}
            aoTrocarPorPagina={(n) => { setPorPagina(n); setPagina(1); }}
            substantivo="criativos"
          />
        </>
      )}
    </div>
  );
}

/**
 * ⛔ **Vazio tem CAUSAS diferentes, e a tela precisa saber qual.**
 *
 * "Nenhum criativo" quando não há nenhum é uma coisa; quando há 40 e o filtro
 * escondeu todos é outra, e o próximo passo do usuário é o oposto nos dois
 * casos. Colapsar as duas manda quem filtrou demais ir conectar conta.
 */
function Vazio({ temAlgum, aba }: { temAlgum: boolean; aba: IdAba }) {
  if (!temAlgum) {
    return (
      <EmptyState
        titulo="Nenhum criativo ainda"
        causa={
          <>
            Os criativos chegam junto com os anúncios, na sincronização com a Meta. Conecte uma conta em{" "}
            <strong>Integrações › Anúncios</strong> e ligue o rastreamento dela.
          </>
        }
        acao={{ texto: "Ir para Integrações › Anúncios", href: "/dashboard/integracoes/anuncios" }}
      />
    );
  }
  if (aba === "queda") {
    return (
      <EmptyState
        titulo="Nenhum criativo em queda"
        causa={
          <>
            Nenhum perdeu 20% ou mais de CTR entre as duas metades do período — o que é uma boa notícia.
            <br />
            <span className="text-caption">
              Períodos curtos podem não ter duas metades para comparar: criativo sem medição dos dois lados fica de fora,
              porque falta de dado não é queda.
            </span>
          </>
        }
        compacto
      />
    );
  }
  return (
    <EmptyState
      titulo="Nenhum criativo neste recorte"
      causa={<>Existem criativos na área, mas nenhum se encaixa nos filtros e na aba selecionados. {TRACO} tente ampliar o período ou limpar a busca.</>}
      compacto
    />
  );
}
