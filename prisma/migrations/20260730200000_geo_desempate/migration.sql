-- Desempate de país por segmentação da campanha, e a PROCEDÊNCIA de cada país.
--
-- ⚠️ Tudo ADITIVO e com default. O build antigo em produção ignora estas
-- colunas — a direção segura (o oposto do incidente da 20260728120000).

-- Países que o ANUNCIANTE configurou na segmentação do conjunto.
-- Vazio = campanha mundial, ou segmentação ainda não sincronizada. Nos dois
-- casos "não desempata", que é o comportamento certo: lista vazia vale para
-- todos, como em toda dimensão de filtro deste projeto.
ALTER TABLE "AdSet" ADD COLUMN "geoCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- De ONDE veio o país. Sem isto não há como auditar nem como a tela dizer
-- "isto é estimativa". Valores: payload | ip | carrier | locale | idioma |
-- campanha | clique | header | incerto.
ALTER TABLE "Click" ADD COLUMN "countrySource" TEXT;
ALTER TABLE "Sale"  ADD COLUMN "countrySource" TEXT;

-- Sinais coletados agora para uso posterior (custam nada e não dá para voltar
-- no tempo). O `Accept-Language` é header e vale para o script JÁ instalado;
-- o fuso vem do payload e só chega de quem reinstalar o script.
ALTER TABLE "Click" ADD COLUMN "acceptLanguage" TEXT;
ALTER TABLE "Click" ADD COLUMN "timezone" TEXT;
