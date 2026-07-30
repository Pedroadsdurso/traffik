"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getPendenciasDaArea, type PendenciasDTO } from "@/lib/actions/diagnostics";
import { sx } from "@/lib/sx";
import { Icone } from "./Icone";

/**
 * Banner de pendências da Área de Trabalho ativa.
 *
 * ## Por que existe
 *
 * Criar uma área agora é um modal de três campos, e a área nasce **zerada** — o
 * que é o desenho certo, mas cria um risco: cair num dashboard vazio sem
 * nenhuma indicação do que fazer. Este banner é a resposta, e é a **única parte
 * do assistente de 5 passos que sobreviveu**: os outros quatro passos viraram
 * redundantes quando a configuração passou a acontecer dentro da área, pela
 * própria sidebar.
 *
 * ## ⚠️ A Principal nunca mostra banner
 *
 * Ela é o catch-all e é o estado normal de quem tem uma operação só. Aviso
 * permanente vira ruído que se aprende a ignorar — inclusive quando muda de
 * texto. Quem decide isso é o servidor (`getPendenciasDaArea` devolve
 * `faltando: []` para a principal), não este componente.
 *
 * ## Dispensa fica no navegador, por área
 *
 * `localStorage`, com a chave por id de área: dispensar em B não esconde o
 * aviso de C. Não vai para o banco de propósito — é preferência de tela, não
 * dado de negócio, e uma coluna nova para isto não se paga.
 */
const CHAVE = "traffik_pend_dispensadas";

function lidas(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

export function BannerPendencias({ workspaceId }: { workspaceId: string | null }) {
  const [dados, setDados] = useState<PendenciasDTO | null>(null);
  const [dispensada, setDispensada] = useState(true); // esconde até saber

  useEffect(() => {
    let vivo = true;
    setDados(null);
    getPendenciasDaArea(workspaceId)
      .then((d) => {
        if (!vivo) return;
        setDados(d);
        setDispensada(lidas().includes(d.areaId));
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
    // Refaz a leitura ao trocar de área — as pendências são de cada uma.
  }, [workspaceId]);

  if (!dados || dispensada || dados.faltando.length === 0) return null;

  const dispensar = () => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify([...new Set([...lidas(), dados.areaId])]));
    } catch {
      // Sem localStorage (modo privado), a dispensa vale só para esta sessão.
    }
    setDispensada(true);
  };

  const AMBAR = "#f59e0b";

  return (
    <div
      className="card"
      style={sx(
        "display:flex;gap:12px;align-items:flex-start;" +
          `border-left:3px solid ${AMBAR};background:color-mix(in srgb, ${AMBAR} 7%, var(--color-surface))`,
      )}
    >
      <Icone nome="bussola" tamanho={18} cor="aviso" />

      <div style={sx("min-width:0;flex:1")}>
        <div style={sx("font-size:14px;font-weight:600")}>
          Falta configurar esta área ({dados.ok} de {dados.total} prontos)
        </div>
        <div className="text-muted" style={sx("font-size:12.5px;margin-top:2px")}>
          Enquanto isso, os números aqui podem não ser só desta operação.
        </div>

        <div style={sx("display:flex;flex-direction:column;gap:5px;margin-top:10px")}>
          {dados.faltando.map((i) => (
            <div key={i.key} style={sx("display:flex;align-items:baseline;gap:8px;font-size:13px")}>
              <span aria-hidden style={sx(`color:${AMBAR};flex:none`)}>•</span>
              <span style={sx("min-width:0")}>
                <strong>{i.label}</strong>
                <span className="text-muted"> — {i.detail}</span>
              </span>
              {i.href && (
                <Link href={i.href} className="btn btn-ghost" style={sx("flex:none;font-size:12px;padding:2px 8px")}>
                  Resolver
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        className="btn btn-ghost"
        type="button"
        onClick={dispensar}
        title="Não mostrar mais para esta área"
        style={sx("flex:none;font-size:12px")}
      >
        Dispensar
      </button>
    </div>
  );
}
