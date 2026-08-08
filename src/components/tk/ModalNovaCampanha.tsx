"use client";

import * as React from "react";

import { Modal } from "@/components/dashboard/ui/Modal";
import { OBJETIVOS_ODAX } from "@/lib/ads/objetivos";

import { Button } from "./Button";
import { Input } from "./Input";
import { Select } from "./Select";

/**
 * # Criar campanha
 *
 * ## 🔴 O que ela cria — e o que deliberadamente NÃO cria
 *
 * Uma chamada, uma aresta: `POST /act_<conta>/campaigns`. **Nenhum conjunto,
 * nenhum anúncio.** É o oposto do fluxo guiado do Gerenciador do Facebook, que
 * cria os três juntos — e foi exatamente por isso que uma campanha que se
 * acreditava crua apareceu entregando e gastando.
 *
 * ⚠️ **Nasce PAUSADA**, no Facebook e no nosso banco. Campanha nova ligada
 * sozinha é dinheiro saindo sem ninguém pedir.
 *
 * ⚠️ Reescrita do `views/ads/NovaCampanhaModal` na tela nova. A LÓGICA é a
 * mesma (o estado `newCampaign*` e a rota não foram tocados); o que mudou é que
 * ela usa os primitivos do sistema em vez de `.input`/`.btn` do CSS antigo.
 */

export function ModalNovaCampanha({
  contas,
  conta,
  aoTrocarConta,
  nome,
  aoTrocarNome,
  objetivo,
  aoTrocarObjetivo,
  orcamento,
  aoTrocarOrcamento,
  ocupado,
  aoCriar,
  aoFechar,
}: {
  contas: { id: string; name: string }[];
  conta: string;
  aoTrocarConta: (v: string) => void;
  nome: string;
  aoTrocarNome: (v: string) => void;
  objetivo: string;
  aoTrocarObjetivo: (v: string) => void;
  orcamento: string;
  aoTrocarOrcamento: (v: string) => void;
  ocupado: boolean;
  aoCriar: () => void;
  aoFechar: () => void;
}) {
  const podeCriar = !!conta && nome.trim().length > 0 && !ocupado;

  return (
    <Modal
      aberta
      titulo="Nova campanha"
      onClose={aoFechar}
      largura={520}
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button variante="primario" onClick={aoCriar} disabled={!podeCriar} carregando={ocupado}>
            Criar campanha
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p className="text-body text-text-secondary" style={{ margin: 0, lineHeight: 1.5 }}>
          Cria a campanha no Facebook e para por aí: <strong>sem conjunto e sem anúncio</strong>. Ela nasce{" "}
          <strong>pausada</strong> — para entregar, é preciso montar o conjunto no Gerenciador do Facebook.
        </p>

        {contas.length ? (
          <Select
            rotulo="Conta de anúncio"
            opcoes={contas.map((c) => ({ valor: c.id, rotulo: c.name }))}
            valor={conta || null}
            aoEscolher={aoTrocarConta}
            vazio="Escolha a conta"
          />
        ) : (
          <p className="text-caption text-text-muted" style={{ margin: 0 }}>
            Nenhuma conta nesta Área de Trabalho. Conecte um perfil em Integrações › Anúncios.
          </p>
        )}

        <Input
          rotulo="Nome"
          value={nome}
          placeholder="Ex.: Oferta Black — Tráfego"
          onChange={(e) => aoTrocarNome(e.target.value)}
        />

        <Select
          rotulo="Objetivo"
          opcoes={OBJETIVOS_ODAX}
          valor={objetivo}
          aoEscolher={aoTrocarObjetivo}
        />

        <Input
          rotulo="Orçamento diário (opcional)"
          sufixo="R$"
          inputMode="decimal"
          value={orcamento}
          placeholder="Por dia"
          onChange={(e) => aoTrocarOrcamento(e.target.value)}
          /* Preencher aqui é o que define CBO — e é o que o motor de regras
             exige para conseguir alterar orçamento no nível da campanha. */
          apoio="Com valor, o orçamento fica na campanha (CBO). Em branco, ele vive nos conjuntos (ABO) — e regras de orçamento no nível de campanha não conseguem alterá-lo."
        />
      </div>
    </Modal>
  );
}
