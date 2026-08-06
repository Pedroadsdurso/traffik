"use client";

import * as React from "react";
import { Button } from "./Button";
import { Modal } from "@/components/dashboard/ui/Modal";

/**
 * BARRA DE EDIÇÃO — entrar, salvar, cancelar e redefinir.
 *
 * ⚠️ Ela fica GRUDADA no topo enquanto se edita. As zonas empurram a tela para
 * baixo de mais de uma altura de janela, e um Salvar que sai de vista obriga a
 * subir de volta para concluir — que é onde a pessoa acaba fechando a aba com a
 * edição por gravar.
 *
 * ### 🔴 REDEFINIR PERGUNTA, E OS OUTROS DOIS NÃO
 *
 * `Salvar` e `Cancelar` são reversíveis um pelo outro: salvou sem querer, edita
 * de novo; cancelou sem querer, refaz. **`Redefinir` não tem volta** — ele apaga
 * a linha no banco na hora, e o `Cancelar` depois disso restauraria um arranjo
 * que não existe mais em lugar nenhum.
 *
 * Por isso ele é o único com confirmação, e a confirmação diz **as duas coisas
 * que o usuário não consegue deduzir**: que grava imediatamente, e que o
 * Cancelar não desfaz.
 *
 * ⚠️ `destrutivo` é contorno, não preenchimento: a ação irreversível precisa ser
 * encontrável sem ser o alvo mais convidativo da barra.
 */

export function BarraEdicao({
  editando,
  salvando,
  aoEditar,
  aoSalvar,
  aoCancelar,
  aoRedefinir,
}: {
  editando: boolean;
  salvando: boolean;
  aoEditar: () => void;
  aoSalvar: () => void;
  aoCancelar: () => void;
  aoRedefinir: () => void;
}) {
  const [confirmando, setConfirmando] = React.useState(false);

  if (!editando) {
    /* ⚠️ À ESQUERDA, e não à direita. À direita ele cairia a ~10px de onde o
       `Salvar` aparece assim que a barra abre — o mesmo canto, quase o mesmo y.
       Um segundo clique no lugar em que o primeiro acabou de funcionar é o gesto
       mais natural que existe, e ali ele gravaria o layout sem o usuário ter
       editado nada. A entrada e o commit não podem dividir coordenada. */
    return (
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <Button variante="secundario" onClick={aoEditar}>
          Editar painel
        </Button>
      </div>
    );
  }

  return (
    <>
      <div
        className="bg-surface border border-border"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          borderRadius: "var(--tk-radius-card)",
          padding: "var(--tk-pad-card)",
          display: "flex",
          alignItems: "center",
          gap: "var(--tk-gap-grid)",
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="text-label text-text">Editando o painel</div>
          {/* A frase é a garantia que o hook dá de verdade: enquanto se edita,
              o banco não é tocado. Sem dizê-la, a pessoa edita com medo. */}
          <div className="text-caption text-text-secondary" style={{ marginTop: 2 }}>
            Nada é gravado até você salvar.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variante="destrutivo" onClick={() => setConfirmando(true)} disabled={salvando}>
            Redefinir
          </Button>
          <Button variante="fantasma" onClick={aoCancelar} disabled={salvando}>
            Cancelar
          </Button>
          <Button variante="primario" onClick={aoSalvar} carregando={salvando}>
            Salvar
          </Button>
        </div>
      </div>

      <Modal
        aberta={confirmando}
        titulo="Redefinir o painel?"
        descricao="Volta ao arranjo padrão: 4 principais, o resumo completo e todos os painéis."
        onClose={() => setConfirmando(false)}
        rodape={
          <>
            <Button variante="fantasma" onClick={() => setConfirmando(false)}>
              Manter o meu
            </Button>
            <Button
              variante="destrutivo"
              onClick={() => {
                setConfirmando(false);
                aoRedefinir();
              }}
            >
              Redefinir
            </Button>
          </>
        }
      >
        <p className="text-body text-text-secondary" style={{ margin: 0, lineHeight: 1.5 }}>
          O seu arranjo é apagado <strong>na hora</strong>, e o Cancelar não desfaz — diferente das outras
          mudanças desta tela, que só valem quando você salva.
        </p>
      </Modal>
    </>
  );
}
