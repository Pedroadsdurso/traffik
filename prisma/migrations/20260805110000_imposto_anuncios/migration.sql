-- Imposto sobre o GASTO com anuncios (o que a Meta cobra alem do gasto).
--
-- No Brasil o anuncio nao custa o que aparece no Gerenciador: sobre ele incide
-- tributo, tipicamente ~12% somando as parcelas municipais e federais. Esse
-- valor NAO chega em `DailyAdMetric.spend` -- a Meta reporta o gasto liquido --
-- entao o lucro da ferramenta vinha sistematicamente MAIOR que a realidade,
-- por uma fracao fixa do investimento, com o numero continuando plausivel.
--
-- 🔴 Por que nao e uma linha em `Expense`: as despesas de la incidem sobre o
-- FATURAMENTO (ou por pedido). Esta incide sobre o GASTO. Modelar como IMPOSTO
-- comum a aplicaria na base errada, e o erro seria invisivel — daria um numero
-- do mesmo tamanho quando faturamento e gasto sao parecidos, que e o caso mais
-- comum de quem esta perto do ponto de equilibrio.
--
-- ADITIVA: duas colunas com DEFAULT, sem backfill. O padrao e DESLIGADO, nao
-- 12%: ligar sozinho mudaria o lucro exibido de todo mundo no dia do deploy,
-- sem ninguem pedir. Quem tem a aliquota certa e o usuario.
ALTER TABLE "User" ADD COLUMN "impostoAnunciosAtivo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "impostoAnunciosPct"   DECIMAL(6,3) NOT NULL DEFAULT 12;
