/**
 * Nome e centroide aproximado por país (ISO-3166 alpha-2), para o bloco
 * "Vendas por País" do Bloco 5.
 *
 * É uma tabela enxuta de propósito: cobre os países que realmente aparecem em
 * venda de infoproduto em português + os maiores mercados. Um país fora da
 * lista continua aparecendo no **Ranking** (com o código cru); só não ganha
 * ponto no mapa. Ampliar é acrescentar uma linha.
 *
 * Centroides em graus decimais, precisão de ~1° — suficiente para posicionar um
 * ponto num mapa-múndi de 360px.
 */

export interface Pais {
  nome: string;
  lat: number;
  lng: number;
}

export const PAIS: Record<string, Pais> = {
  BR: { nome: "Brasil", lat: -10.0, lng: -55.0 },
  PT: { nome: "Portugal", lat: 39.5, lng: -8.0 },
  US: { nome: "Estados Unidos", lat: 39.0, lng: -98.0 },
  AR: { nome: "Argentina", lat: -34.0, lng: -64.0 },
  CL: { nome: "Chile", lat: -30.0, lng: -71.0 },
  CO: { nome: "Colômbia", lat: 4.0, lng: -73.0 },
  MX: { nome: "México", lat: 23.0, lng: -102.0 },
  PY: { nome: "Paraguai", lat: -23.0, lng: -58.0 },
  UY: { nome: "Uruguai", lat: -33.0, lng: -56.0 },
  PE: { nome: "Peru", lat: -10.0, lng: -76.0 },
  BO: { nome: "Bolívia", lat: -17.0, lng: -65.0 },
  VE: { nome: "Venezuela", lat: 8.0, lng: -66.0 },
  EC: { nome: "Equador", lat: -1.5, lng: -78.0 },
  ES: { nome: "Espanha", lat: 40.0, lng: -4.0 },
  IT: { nome: "Itália", lat: 42.8, lng: 12.8 },
  FR: { nome: "França", lat: 46.0, lng: 2.0 },
  DE: { nome: "Alemanha", lat: 51.0, lng: 9.0 },
  GB: { nome: "Reino Unido", lat: 54.0, lng: -2.0 },
  IE: { nome: "Irlanda", lat: 53.0, lng: -8.0 },
  NL: { nome: "Países Baixos", lat: 52.5, lng: 5.75 },
  BE: { nome: "Bélgica", lat: 50.8, lng: 4.5 },
  CH: { nome: "Suíça", lat: 47.0, lng: 8.0 },
  CA: { nome: "Canadá", lat: 60.0, lng: -96.0 },
  AU: { nome: "Austrália", lat: -25.0, lng: 134.0 },
  NZ: { nome: "Nova Zelândia", lat: -41.0, lng: 174.0 },
  JP: { nome: "Japão", lat: 36.0, lng: 138.0 },
  AO: { nome: "Angola", lat: -12.5, lng: 18.5 },
  MZ: { nome: "Moçambique", lat: -18.25, lng: 35.0 },
  CV: { nome: "Cabo Verde", lat: 16.0, lng: -24.0 },
  ZA: { nome: "África do Sul", lat: -29.0, lng: 24.0 },
  IN: { nome: "Índia", lat: 21.0, lng: 78.0 },
  CN: { nome: "China", lat: 35.0, lng: 105.0 },
};

/** Centroide do país, ou `null` se não estiver na tabela. */
export function centroide(code: string): { lat: number; lng: number } | null {
  const p = PAIS[code.trim().toUpperCase()];
  return p ? { lat: p.lat, lng: p.lng } : null;
}

/** Nome legível, caindo no código cru quando desconhecido. */
export function nomePais(code: string): string {
  return PAIS[code.trim().toUpperCase()]?.nome ?? code.toUpperCase();
}
