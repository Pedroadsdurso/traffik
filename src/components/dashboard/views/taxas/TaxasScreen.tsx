"use client";

import * as React from "react";
import { Clock, Megaphone } from "lucide-react";

import { getImpostoAnuncios, setImpostoAnuncios, setMyTimezone } from "@/lib/actions/profile";
import { TIMEZONE_OPTIONS, fusosDiscordam, partsInTz } from "@/lib/timezone";
import { Button } from "@/components/tk/Button";
import { Input } from "@/components/tk/Input";
import { Select } from "@/components/tk/Select";
import { Switch } from "@/components/tk/Controles";
import type { TraffikView } from "@/components/dashboard/useTraffikState";
import { Aviso, CabecalhoCartao, Cartao, Secao, SecaoTaxas } from "./SecaoTaxas";

/**
 * TaxasScreen — o que entra na conta do lucro, e o que configura a conta.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 ESTA TELA EDITA A CONTA QUE O DASHBOARD INTEIRO MOSTRA
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Não é configuração como outra qualquer. O que se cadastra aqui alimenta o
 * **Lucro** e o **break-even**, e o break-even é a linha de referência do
 * gráfico Receita × Gasto do Dashboard. Um número errado aqui não aparece
 * aqui — aparece lá, com cara de resultado.
 *
 * ── AS DUAS SEÇÕES, e por que os dois cartões de conta FICAM ────────────────
 *
 * Imposto sobre anúncios e fuso horário não são taxa, e a tela antiga os
 * empilhava junto das taxas sem hierarquia nenhuma — foi por isso que eles
 * pareceram fora de lugar. Eles ficam, por dois motivos do dono (12/08/2026):
 *
 *   · o imposto sobre anúncios ENTRA no break-even e no lucro, então pertence
 *     à mesma conta que esta tela edita;
 *   · o fuso decide o que é "hoje" em TODO o resto do produto, e não existe
 *     outra tela de configuração de conta para recebê-lo.
 *
 * O que muda é a hierarquia: `Configuração da conta` e `Taxas e despesas` são
 * duas seções nomeadas, não seis cartões empilhados.
 *
 * ⚠️ A seção de taxas mora em `SecaoTaxas.tsx` porque ESTE arquivo importa
 * server actions que puxam o prisma — e importar o prisma lança sem
 * `DATABASE_URL`. Sem a separação, `test:taxas` não conseguiria renderizar nada.
 * ══════════════════════════════════════════════════════════════════════════════
 */
export function TaxasScreen({ v }: { v: TraffikView }) {
  return (
    /* ⚠️ LARGURA MÁXIMA, e é conserto de tela: sem ela os cartões esticavam por
       1380px e o campo "Nome" de cada formulário virava uma faixa de meio metro.
       Tela de FORMULÁRIO não é tela de painel — o painel quer densidade e usa a
       largura toda; o formulário quer linha de leitura curta, senão o rótulo e o
       campo que ele nomeia ficam em pontas opostas do monitor. */
    <div style={{ display: "flex", flexDirection: "column", gap: 32, paddingBottom: 40, maxWidth: 1040 }}>
      <Secao titulo="Configuração da conta" apoio="Duas escolhas que mudam o cálculo de todas as telas.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
          <CartaoImposto />
          <CartaoFuso inicial={v.timezone} />
        </div>
      </Secao>

      <SecaoTaxas v={v} />
    </div>
  );
}

/**
 * Imposto sobre anúncios.
 *
 * ⚠️ COMPORTAMENTO PRESERVADO da tela antiga, inclusive o `window.location.reload()`
 * depois de salvar: o lucro é calculado no SERVIDOR, e recarregar é o caminho
 * honesto de repintar os cards com a alíquota nova. Atualização otimista
 * mostraria por um instante um lucro que o servidor ainda não confirmou — numa
 * tela cujo produto é o número.
 */
function CartaoImposto() {
  const [ativo, setAtivo] = React.useState(false);
  const [pct, setPct] = React.useState("12");
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, iniciar] = React.useTransition();

  React.useEffect(() => {
    void getImpostoAnuncios().then((r) => {
      setAtivo(r.ativo);
      setPct(String(r.pct).replace(".", ","));
    });
  }, []);

  function salvar(novoAtivo: boolean, novoPct: string) {
    const n = Number(novoPct.replace(",", "."));
    setErro(null);
    iniciar(async () => {
      const r = await setImpostoAnuncios(novoAtivo, Number.isFinite(n) ? n : 0);
      if (!r.ok) {
        setErro(r.error ?? "Não foi possível salvar.");
        return;
      }
      setTimeout(() => window.location.reload(), 400);
    });
  }

  return (
    <Cartao>
      <CabecalhoCartao
        icone={<Megaphone size={18} strokeWidth={1.75} />}
        titulo="Imposto sobre anúncios"
        apoio="O que a Meta cobra além do gasto"
      />
      <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
        O Gerenciador do Facebook mostra o valor do anúncio sem o imposto que incide sobre ele.
        Ligue aqui para que o seu lucro já venha com esse custo descontado.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <Switch
          ligado={ativo}
          aoMudar={(valor) => {
            setAtivo(valor);
            salvar(valor, pct);
          }}
          rotulo="Descontar do lucro"
        />
        <div style={{ width: 132 }}>
          <Input
            value={pct}
            inputMode="decimal"
            sufixo="%"
            aria-label="Alíquota do imposto sobre anúncios"
            disabled={!ativo || salvando}
            onChange={(e) => setPct(e.target.value)}
            onBlur={(e) => salvar(ativo, e.target.value)}
            erro={erro ?? undefined}
          />
        </div>
      </div>
    </Cartao>
  );
}

/**
 * Fuso horário.
 *
 * ⚠️ COMPORTAMENTO PRESERVADO, inclusive o aviso de divergência com o fuso do
 * APARELHO e a dispensa em `localStorage` **por fuso de aparelho** — quem
 * dispensou em Lisboa e depois abre em São Paulo vê de novo. É preferência de
 * tela e não vai para o banco, de propósito.
 */
function CartaoFuso({ inicial }: { inicial: string }) {
  const [tz, setTz] = React.useState(inicial);
  const [salvo, setSalvo] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [tzAparelho, setTzAparelho] = React.useState<string | null>(null);
  const [dispensado, setDispensado] = React.useState(true);
  const [, iniciar] = React.useTransition();

  React.useEffect(() => {
    let doAparelho: string | undefined;
    try {
      doAparelho = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!doAparelho) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura de sistema EXTERNO (Intl + localStorage), que o servidor não conhece: ler no render daria divergência de hidratação.
    setTzAparelho(doAparelho);
    setDispensado(localStorage.getItem(`tk.fuso.dispensado.${doAparelho}`) === "1");
  }, []);

  function dispensar() {
    if (tzAparelho) localStorage.setItem(`tk.fuso.dispensado.${tzAparelho}`, "1");
    setDispensado(true);
  }

  function salvar(valor: string) {
    setTz(valor);
    setErro(null);
    setSalvo(false);
    iniciar(async () => {
      const r = await setMyTimezone(valor);
      if (!r.ok) {
        setErro(r.error ?? "Não foi possível salvar.");
        return;
      }
      setSalvo(true);
      setTimeout(() => window.location.reload(), 400);
    });
  }

  const divergente = tzAparelho != null && !dispensado && fusosDiscordam(tz, tzAparelho);
  const p = partsInTz(new Date(), tz);
  const dd = (n: number) => String(n).padStart(2, "0");

  return (
    <Cartao>
      <CabecalhoCartao
        icone={<Clock size={18} strokeWidth={1.75} />}
        titulo="Fuso horário"
        apoio="Decide o que é “hoje” em todas as telas"
      />

      <Select
        rotulo="Fuso da conta"
        valor={tz}
        aoEscolher={salvar}
        opcoes={[
          /* O fuso GRAVADO entra na lista mesmo fora do catálogo — senão um valor
             legado sumiria do seletor e a tela mostraria outro fuso como se fosse
             o salvo. */
          ...(TIMEZONE_OPTIONS.some((o) => o.value === tz) ? [] : [{ valor: tz, rotulo: tz }]),
          ...TIMEZONE_OPTIONS.map((o) => ({ valor: o.value, rotulo: o.label })),
        ]}
      />

      {/* ⚠️ A hora é a CONFERÊNCIA: é a única forma de o usuário saber que
          escolheu o fuso certo sem ter de confiar no nome da cidade. */}
      <p className="text-caption text-text-muted" style={{ margin: 0 }}>
        Agora são{" "}
        <strong className="text-text">
          {dd(p.hour)}:{dd(p.minute)}
        </strong>{" "}
        de {dd(p.day)}/{dd(p.month)} neste fuso.
      </p>

      {erro && (
        <p role="alert" className="text-caption text-danger" style={{ margin: 0 }}>
          {erro}
        </p>
      )}
      {salvo && !erro && (
        <p role="status" className="text-caption text-text-muted" style={{ margin: 0 }}>
          Salvo — recarregando os dados…
        </p>
      )}

      {divergente && (
        <Aviso>
          <span>
            O seu aparelho está em <strong className="text-text">{tzAparelho}</strong>, diferente do fuso
            da conta. Os números seguem o fuso da <strong className="text-text">conta</strong>.
          </span>
          <Button variante="fantasma" onClick={dispensar} style={{ alignSelf: "flex-start" }}>
            Entendi
          </Button>
        </Aviso>
      )}
    </Cartao>
  );
}
