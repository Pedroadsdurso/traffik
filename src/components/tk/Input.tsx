"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Input — campo de texto com rótulo, apoio e erro.
 *
 * O componente inteiro existe por causa de uma coisa que é fácil errar de um
 * jeito que ninguém vê: **o erro tem de ser LIDO, não só pintado.** Borda
 * vermelha é invisível para leitor de tela e para quem não distingue vermelho de
 * verde — é o critério 1.4.1 do WCAG. Aqui o erro sempre vira TEXTO, e o texto é
 * amarrado ao campo por `aria-describedby` + `aria-invalid`.
 *
 * Por isso `erro` é `string` e não `boolean`: um booleano deixaria pintar a
 * borda sem dizer o que houve, que é exatamente o desenho que este arquivo
 * recusa.
 *
 * ⚠️ `text-muted` é o placeholder — e ele só passou a ser legível na Fase 6. No
 * tema claro ele rendia 2.34:1 (era #94A3B8); hoje é #637184, a 4.56:1. Não
 * volte a "clarear o placeholder para ficar discreto": discreto ele já é pela
 * hierarquia de luminosidade, um degrau abaixo do `text-secondary`.
 */

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "size"> & {
  rotulo?: React.ReactNode;
  /** Texto de apoio permanente (formato esperado, unidade, de onde vem o dado). */
  apoio?: React.ReactNode;
  /** A MENSAGEM do erro. Presente = campo inválido. */
  erro?: string;
  iconeInicio?: React.ReactNode;
  /** Sufixo fixo — "R$", "%", "×". Não é botão. */
  sufixo?: React.ReactNode;
  blocoInteiro?: boolean;
  /**
   * Fonte monoespaçada — para valor que a pessoa COMPARA caractere a caractere:
   * token de webhook, chave de API, id de pixel.
   *
   * ⚠️ Não é estética. Em fonte proporcional `O`/`0` e `l`/`1` são quase iguais,
   * e o erro que isso produz não é um campo feio: é um token quase certo, colado
   * no painel de outra empresa, que responde 404 semanas depois.
   *
   * ⛔ Precisa ser prop e não `style` do chamador porque o `<input>` interno
   * carrega `.text-body`, que declara `font-family` — herança do contêiner não
   * alcança.
   */
  mono?: boolean;
  /**
   * Campo de senha com o olho que REVELA o valor digitado.
   *
   * ⛔ É prop, e não um botão que cada chamador põe no `sufixo`, por uma razão
   * de acessibilidade que é fácil errar sem ninguém ver: o botão precisa dizer
   * o ESTADO ("mostrar" × "ocultar"), não só existir. Um ícone de olho sem
   * `aria-label` que muda é, para quem usa leitor de tela, um botão sem nome
   * que faz algo invisível.
   *
   * ⚠️ E `sufixo` não serve mesmo: ele é documentado como "não é botão" e não
   * recebe foco. Reaproveitá-lo daria um alvo de clique que o Tab não alcança.
   *
   * ⚠️ O olho NÃO entra na ordem de tabulação depois do campo por acaso — ele
   * vem logo em seguida de propósito, para quem digitou a senha errada
   * alcançá-lo com um Tab.
   */
  revelavel?: boolean;
};

export const Input = React.forwardRef<HTMLInputElement, Props>(function Input(
  { rotulo, apoio, erro, iconeInicio, sufixo, blocoInteiro = true, mono = false, revelavel = false, id, disabled, style, type, ...resto },
  ref,
) {
  const gerado = React.useId();
  const idCampo = id ?? gerado;
  const idApoio = `${idCampo}-apoio`;
  const idErro = `${idCampo}-erro`;
  const [revelado, setRevelado] = React.useState(false);

  /* Com `revelavel`, quem manda no `type` é o estado — senão um `type="password"`
     do chamador venceria o clique no olho e o botão ficaria inerte. */
  const tipoEfetivo = revelavel ? (revelado ? "text" : "password") : type;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: blocoInteiro ? "100%" : undefined }}>
      {rotulo && (
        <label htmlFor={idCampo} className="text-label text-text-secondary">
          {rotulo}
        </label>
      )}

      <div
        className={
          "flex items-center gap-2 bg-surface-hover border rounded-controle " +
          "transition-[border-color] " +
          (erro ? "border-danger " : "border-border ") +
          (disabled ? "opacity-45 " : "focus-within:border-primary ")
        }
        style={{ height: "var(--tk-altura-controle)", padding: "0 10px", ...style }}
      >
        {iconeInicio && (
          <span aria-hidden="true" className="text-text-muted" style={{ flex: "none", display: "flex" }}>
            {iconeInicio}
          </span>
        )}

        <input
          {...resto}
          type={tipoEfetivo}
          ref={ref}
          id={idCampo}
          disabled={disabled}
          aria-invalid={erro ? true : undefined}
          /* O apoio continua anunciado junto com o erro: ele costuma dizer o
             FORMATO esperado, que é o que a pessoa precisa justamente quando
             errou. Trocar um pelo outro esconde a instrução na hora em que ela
             mais serve. */
          aria-describedby={[apoio ? idApoio : null, erro ? idErro : null].filter(Boolean).join(" ") || undefined}
          className={
            "text-body text-text bg-transparent border-0 outline-none w-full min-w-0 " +
            "placeholder:text-text-muted disabled:cursor-not-allowed"
          }
          style={{
            height: "100%",
            caretColor: "var(--tk-primary)",
            ...(mono
              ? { fontFamily: "var(--tk-font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 12.5 }
              : null),
          }}
        />

        {sufixo && (
          <span className="text-caption text-text-muted" style={{ flex: "none" }}>
            {sufixo}
          </span>
        )}

        {revelavel && (
          <button
            type="button"
            onClick={() => setRevelado((v) => !v)}
            disabled={disabled}
            /* O nome do botão é o que ele VAI FAZER, e o `aria-pressed` é o
               estado em que ele está. Só o ícone mudar não diz nada a quem não
               enxerga o ícone. */
            aria-label={revelado ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={revelado}
            className="text-text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-controle cursor-pointer disabled:cursor-not-allowed"
            style={{ flex: "none", display: "flex", background: "none", border: 0, padding: 2 }}
          >
            <Olho aberto={revelado} />
          </button>
        )}
      </div>

      {apoio && !erro && (
        <p id={idApoio} className="text-caption text-text-muted" style={{ margin: 0 }}>
          {apoio}
        </p>
      )}
      {erro && (
        /* `role="alert"` para o erro que aparece DEPOIS de enviar o formulário
           ser anunciado sozinho — sem ele, quem usa leitor de tela só descobre
           voltando ao campo. */
        <p id={idErro} role="alert" className="text-caption text-danger" style={{ margin: 0 }}>
          {erro}
        </p>
      )}
    </div>
  );
});

/** O glifo do olho. `aria-hidden` porque quem nomeia o botão é o `aria-label`. */
function Olho({ aberto }: { aberto: boolean }) {
  const Glifo = aberto ? Eye : EyeOff;
  return <Glifo size={16} strokeWidth={1.75} aria-hidden="true" />;
}
