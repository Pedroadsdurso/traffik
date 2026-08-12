"use client";

import * as React from "react";

import { Button } from "./Button";
import { Input } from "./Input";

/**
 * O campo que ENTREGA um artefato — URL de webhook, chave, endereço de ingestão.
 *
 * > ### 🔴 O QUE SAI DAQUI VAI PARA FORA DO PRODUTO
 * >
 * > Isto não é um campo de formulário: é o ponto em que um valor da Trackhub
 * > passa para o painel de um gateway, para o site do cliente ou para o
 * > desenvolvedor dele. A regra do projeto — *tela stale que ENTREGA artefato é
 * > armadilha* — vale em todo lugar em que este componente aparece, e o
 * > CHAMADOR é responsável por só montá-lo com o valor da área ativa.
 *
 * ## É o `Input` do sistema, com um botão ao lado — não um campo novo
 *
 * A moldura, a altura por `--tk-altura-controle`, o foco e o `apoio` vêm todos
 * do primitivo. O que este arquivo acrescenta é o botão e a confirmação; um
 * campo próprio aqui seria a segunda aparência de caixa de texto da base.
 *
 * ⚠️ O botão fica **fora** da caixa, não como `sufixo`: `sufixo` é para unidade
 * fixa ("R$", "%") e não é clicável. Um controle dentro de um campo `readOnly`
 * competiria com a área de seleção do texto, que é o outro jeito de copiar.
 *
 * ## Por que `readOnly` e não texto solto
 *
 * Texto num `<div>` obriga a arrastar o mouse até o fim de uma URL de 70
 * caracteres. **Seleção parcial de token produz um artefato QUASE certo** — e
 * esse é o pior desfecho: parece válido, e o gateway responde 404 semanas
 * depois, no painel de outra empresa. O `onFocus` que seleciona tudo é o que
 * torna o caminho de teclado equivalente ao do botão.
 */
export function CampoCopiavel({
  rotulo,
  valor,
  ajuda,
  id,
  copiado,
  aoCopiar,
  /** O que dizer quando não há valor — nunca um campo vazio sem explicação. */
  vazio,
}: {
  rotulo: React.ReactNode;
  valor: string;
  ajuda?: React.ReactNode;
  id: string;
  copiado: string | null;
  aoCopiar: (texto: string, id: string) => void;
  vazio?: React.ReactNode;
}) {
  if (!valor) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <span className="text-label text-text-secondary">{rotulo}</span>
        <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.6 }}>
          {vazio ?? "—"}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span className="text-label text-text-secondary">{rotulo}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {/* `mono`: o valor daqui é comparado caractere a caractere com o que
            está colado do outro lado — ver a prop no primitivo. */}
        <Input
          mono
          readOnly
          value={valor}
          aria-label={typeof rotulo === "string" ? rotulo : undefined}
          onFocus={(e) => e.currentTarget.select()}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Button variante="secundario" onClick={() => aoCopiar(valor, id)} style={{ flex: "none" }}>
          {copiado === id ? "Copiado" : "Copiar"}
        </Button>
      </div>
      {ajuda && (
        <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.6 }}>
          {ajuda}
        </p>
      )}
    </div>
  );
}
