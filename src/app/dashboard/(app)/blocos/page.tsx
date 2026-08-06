"use client";

/**
 * `/dashboard/blocos` — a PROVA de que o catálogo não tem bloco vazio.
 *
 * 🔴 POR QUE ELA EXISTE: a regra do catálogo é que nada entra sem renderizar de
 * verdade, e a única forma de verificar isso é desenhar todos com dado real. Um
 * bloco que só existe no registro é o pior controle inerte da base — o usuário
 * o ESCOLHE, espera, e é ele quem descobre que não há nada.
 *
 * ⏳ **ELA É TEMPORÁRIA E TEM PRAZO: morre quando o modo de edição chegar**, que
 * é quando o painel "Painéis disponíveis" passa a ser o lugar onde se vê o
 * catálogo. Não está no rail de propósito — é ferramenta de verificação, não
 * tela de produto.
 */
import { useTraffik } from "@/components/dashboard/TraffikContext";
import { CATALOGO } from "@/components/dashboard/catalogo";
import { Card } from "@/components/tk/Card";
import { Badge } from "@/components/tk/Badge";

export default function BlocosPage() {
  const v = useTraffik();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-gap-grid)" }}>
      <p className="text-body text-text-secondary" style={{ margin: 0, lineHeight: 1.5 }}>
        Os {CATALOGO.length} blocos do catálogo, com o dado real do filtro atual. Esta tela é
        temporária: ela existe para provar que nenhum bloco entra no catálogo sem desenhar, e
        morre quando o modo de edição chegar.
      </p>

      <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        {CATALOGO.map((b) => {
          const tem = b.temDado(v);
          return (
            <Card
              key={b.id}
              titulo={b.titulo}
              descricao={b.descricao}
              acao={
                /* O selo diz se o bloco TEM DADO neste período — que é diferente
                   de estar quebrado. Sem ele, um bloco corretamente vazio
                   pareceria defeito. */
                <Badge tom={tem ? "success" : "neutral"} ponto>
                  {tem ? "com dado" : "sem dado no período"}
                </Badge>
              }
            >
              {b.render(v)}
              <p className="text-caption text-text-muted" style={{ margin: "10px 0 0" }}>
                {/* As larguras permitidas ficam visíveis aqui: é o que o modo de
                    edição vai oferecer, e conferir agora evita descobrir no C
                    que um bloco declarou uma largura em que não cabe. */}
                zona {b.zona} · larguras: {(b.larguras ?? []).join(" · ") || "—"}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
