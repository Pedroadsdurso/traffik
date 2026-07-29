/**
 * ⛔ **MÓDULO APOSENTADO em 29/07/2026.**
 *
 * O escopo por inclusão/exclusão de contas foi substituído pela ATRIBUIÇÃO POR
 * PRECEDÊNCIA — `src/lib/areas/precedencia.ts`. O modelo antigo aplicava as
 * dimensões da área em AND, e por isso uma linha podia não casar com área
 * nenhuma e sumir do produto inteiro: medido no backup real de produção, **12
 * de 14 vendas** ficavam invisíveis em todas as telas.
 *
 * Não reintroduza `filtroEfetivo`/`escopoExcluindo`. A pergunta certa não é
 * "casa com os filtros de A?" e sim "de quem é esta linha?", que sempre tem
 * exatamente uma resposta — é isso que faz as áreas particionarem o total.
 *
 * O arquivo continua existindo só para este aviso ficar onde alguém procuraria.
 */
export {};
