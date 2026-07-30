-- Taxas e despesas passam a ser ISOLADAS POR ÁREA (decisão do usuário, 30/07).
--
-- ⚠️ REVERTE a semântica anterior, em que `workspaceId` NULO significava "vale
-- para todas as áreas". As despesas existentes eram todas nulas, então elas
-- entravam no cálculo de lucro de TODA área. Agora vão para a PRINCIPAL.
--
-- 🔴 CONSEQUÊNCIA ACEITA: uma área secundária que dependia dessas despesas
-- globais passa a calcular lucro SEM elas — lucro maior do que a realidade, com
-- número plausível. É o risco que a decisão anterior evitava. A mitigação é a
-- tela: área sem taxa de gateway ou sem imposto ganha aviso visível, para o erro
-- deixar de ser silencioso.
UPDATE "Expense" e
SET "workspaceId" = (
  SELECT w.id FROM "Workspace" w
  WHERE w."userId" = e."userId" AND w."isDefault"
  LIMIT 1
)
WHERE e."workspaceId" IS NULL;
