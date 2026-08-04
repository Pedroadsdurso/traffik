-- Erro da descoberta de contas, no perfil. ADITIVA: duas colunas nullable.
--
-- Sem isto, um token que perdeu `ads_read` faz `/me/adaccounts` falhar, o erro
-- e engolido pelo try/catch por perfil, e TODAS as contas daquele perfil ficam
-- com `accountStatus` nulo sem nenhuma explicacao na tela.
ALTER TABLE "AdProfile" ADD COLUMN "lastDiscoveryError"   TEXT;
ALTER TABLE "AdProfile" ADD COLUMN "lastDiscoveryErrorAt" TIMESTAMP(3);
