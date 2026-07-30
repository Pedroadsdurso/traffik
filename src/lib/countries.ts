/**
 * Nome e centroide por país (ISO-3166 alpha-2), para o bloco "Vendas por País".
 *
 * ## Cobertura MUNDIAL (30/07/2026)
 *
 * Era uma tabela de 32 países, "os que aparecem em infoproduto em português".
 * Isso estava errado como premissa: o produto é usado por gestores de tráfego
 * que rodam oferta para o mundo inteiro, e o mapa é a ferramenta que diz **onde
 * escalar e onde o CPA está alto**. Um país fora da lista não ganhava ponto no
 * globo — ou seja, o mercado novo era justamente o invisível.
 *
 * Hoje cobre os 193 membros da ONU + territórios com tráfego próprio, batendo
 * com os 252 códigos que a base de IP sabe resolver. `npm run test:pais`
 * verifica que todo país resolvível tem coordenada.
 *
 * ## ⚠️ A bandeira é CALCULADA, não guardada
 *
 * `bandeiraDe("BR")` monta o emoji a partir dos indicadores regionais Unicode.
 * Guardar 250 emojis literais num arquivo-fonte é convite a erro de digitação
 * invisível — um emoji errado é indistinguível de um certo em code review, e
 * quebra só na tela de quem vende para aquele país.
 *
 * Centroides em graus decimais, precisão de ~1° — suficiente para posicionar um
 * ponto num globo de ~300 px. Para países com territórios dispersos, o
 * centroide é o da **massa principal**, não o geométrico: o centroide real da
 * França cai no Atlântico por causa dos territórios ultramarinos.
 */

export interface Pais {
  nome: string;
  lat: number;
  lng: number;
  /** Emoji da bandeira — usado no tooltip do globo e no ranking. */
  bandeira: string;
}

/**
 * `[nome em pt-BR, latitude, longitude]`.
 *
 * Formato de tupla de propósito: 250 linhas de objeto com três chaves repetidas
 * seriam 4× o arquivo sem nenhuma informação a mais.
 */
const DADOS: Record<string, readonly [string, number, number]> = {
  // ── América do Sul ──
  BR: ["Brasil", -10, -55], AR: ["Argentina", -34, -64], CL: ["Chile", -30, -71],
  CO: ["Colômbia", 4, -73], PE: ["Peru", -10, -76], VE: ["Venezuela", 8, -66],
  EC: ["Equador", -1.5, -78], BO: ["Bolívia", -17, -65], PY: ["Paraguai", -23, -58],
  UY: ["Uruguai", -33, -56], GY: ["Guiana", 5, -59], SR: ["Suriname", 4, -56],
  GF: ["Guiana Francesa", 4, -53], FK: ["Ilhas Malvinas", -51.8, -59.5],

  // ── América Central e Caribe ──
  MX: ["México", 23, -102], GT: ["Guatemala", 15.5, -90.3], HN: ["Honduras", 15, -86.5],
  SV: ["El Salvador", 13.8, -88.9], NI: ["Nicarágua", 13, -85], CR: ["Costa Rica", 10, -84],
  PA: ["Panamá", 9, -80], CU: ["Cuba", 21.5, -80], DO: ["República Dominicana", 19, -70.7],
  HT: ["Haiti", 19, -72.4], JM: ["Jamaica", 18.1, -77.3], PR: ["Porto Rico", 18.2, -66.5],
  TT: ["Trinidad e Tobago", 10.7, -61.2], BS: ["Bahamas", 24.2, -76], BB: ["Barbados", 13.2, -59.5],
  BZ: ["Belize", 17.2, -88.7], AG: ["Antígua e Barbuda", 17.1, -61.8], LC: ["Santa Lúcia", 13.9, -61],
  GD: ["Granada", 12.1, -61.7], VC: ["São Vicente e Granadinas", 13.3, -61.2],
  KN: ["São Cristóvão e Névis", 17.3, -62.7], DM: ["Dominica", 15.4, -61.4],
  AW: ["Aruba", 12.5, -69.9], CW: ["Curaçao", 12.2, -69], BM: ["Bermudas", 32.3, -64.8],
  KY: ["Ilhas Cayman", 19.3, -81.2], VG: ["Ilhas Virgens Britânicas", 18.4, -64.6],
  VI: ["Ilhas Virgens Americanas", 18.3, -64.9], TC: ["Turcas e Caicos", 21.7, -71.6],
  AI: ["Anguilla", 18.2, -63.1], MS: ["Montserrat", 16.7, -62.2], MQ: ["Martinica", 14.6, -61],
  GP: ["Guadalupe", 16.2, -61.6], BQ: ["Países Baixos Caribenhos", 12.2, -68.3],
  SX: ["Sint Maarten", 18, -63.1], BL: ["São Bartolomeu", 17.9, -62.8],
  MF: ["São Martinho", 18.1, -63.1],

  // ── América do Norte ──
  US: ["Estados Unidos", 39, -98], CA: ["Canadá", 60, -96], GL: ["Groenlândia", 72, -40],
  PM: ["São Pedro e Miquelão", 46.9, -56.3],

  // ── Europa Ocidental e do Sul ──
  PT: ["Portugal", 39.5, -8], ES: ["Espanha", 40, -4], FR: ["França", 46.5, 2.5],
  IT: ["Itália", 42.8, 12.8], DE: ["Alemanha", 51, 9], GB: ["Reino Unido", 54, -2],
  IE: ["Irlanda", 53, -8], NL: ["Países Baixos", 52.5, 5.75], BE: ["Bélgica", 50.8, 4.5],
  CH: ["Suíça", 47, 8], AT: ["Áustria", 47.6, 14.1], LU: ["Luxemburgo", 49.8, 6.1],
  MC: ["Mônaco", 43.7, 7.4], AD: ["Andorra", 42.5, 1.6], SM: ["San Marino", 43.9, 12.5],
  VA: ["Vaticano", 41.9, 12.5], LI: ["Liechtenstein", 47.2, 9.5], MT: ["Malta", 35.9, 14.4],
  GI: ["Gibraltar", 36.1, -5.4], GR: ["Grécia", 39, 22], CY: ["Chipre", 35, 33],

  // ── Europa do Norte ──
  SE: ["Suécia", 62, 15], NO: ["Noruega", 62, 10], DK: ["Dinamarca", 56, 10],
  FI: ["Finlândia", 64, 26], IS: ["Islândia", 65, -18], EE: ["Estônia", 59, 26],
  LV: ["Letônia", 57, 25], LT: ["Lituânia", 55.2, 23.9], FO: ["Ilhas Faroé", 62, -7],
  AX: ["Åland", 60.2, 20], IM: ["Ilha de Man", 54.2, -4.5], JE: ["Jersey", 49.2, -2.1],
  GG: ["Guernsey", 49.5, -2.6],

  // ── Europa Central e do Leste ──
  PL: ["Polônia", 52, 19], CZ: ["Tchéquia", 49.8, 15.5], SK: ["Eslováquia", 48.7, 19.5],
  HU: ["Hungria", 47, 20], RO: ["Romênia", 46, 25], BG: ["Bulgária", 43, 25],
  HR: ["Croácia", 45.1, 15.5], SI: ["Eslovênia", 46.1, 14.8], RS: ["Sérvia", 44, 21],
  BA: ["Bósnia e Herzegovina", 44, 18], ME: ["Montenegro", 42.8, 19.3],
  MK: ["Macedônia do Norte", 41.6, 21.7], AL: ["Albânia", 41, 20], XK: ["Kosovo", 42.6, 20.9],
  UA: ["Ucrânia", 49, 32], BY: ["Belarus", 53.7, 28], MD: ["Moldávia", 47, 28.8],
  RU: ["Rússia", 60, 90],

  // ── Oriente Médio e Cáucaso ──
  TR: ["Turquia", 39, 35], IL: ["Israel", 31.5, 34.8], PS: ["Palestina", 31.9, 35.2],
  SA: ["Arábia Saudita", 24, 45], AE: ["Emirados Árabes Unidos", 24, 54],
  QA: ["Catar", 25.3, 51.2], KW: ["Kuwait", 29.3, 47.6], BH: ["Bahrein", 26, 50.5],
  OM: ["Omã", 21, 57], YE: ["Iêmen", 15.5, 48], JO: ["Jordânia", 31, 36],
  LB: ["Líbano", 33.9, 35.9], SY: ["Síria", 35, 38], IQ: ["Iraque", 33, 44],
  IR: ["Irã", 32, 53], GE: ["Geórgia", 42, 43.5], AM: ["Armênia", 40.3, 45],
  AZ: ["Azerbaijão", 40.3, 47.6],

  // ── Ásia Central e do Sul ──
  KZ: ["Cazaquistão", 48, 68], UZ: ["Uzbequistão", 41.4, 64.6], TM: ["Turcomenistão", 39, 59],
  KG: ["Quirguistão", 41.2, 74.8], TJ: ["Tadjiquistão", 38.9, 71.3], AF: ["Afeganistão", 33.9, 67.7],
  PK: ["Paquistão", 30, 70], IN: ["Índia", 21, 78], BD: ["Bangladesh", 24, 90],
  LK: ["Sri Lanka", 7.9, 80.8], NP: ["Nepal", 28.4, 84.1], BT: ["Butão", 27.5, 90.4],
  MV: ["Maldivas", 3.2, 73.2],

  // ── Leste e Sudeste Asiático ──
  CN: ["China", 35, 105], JP: ["Japão", 36, 138], KR: ["Coreia do Sul", 36.5, 127.8],
  KP: ["Coreia do Norte", 40, 127], TW: ["Taiwan", 23.7, 121], HK: ["Hong Kong", 22.3, 114.2],
  MO: ["Macau", 22.2, 113.5], MN: ["Mongólia", 46.9, 103.8], ID: ["Indonésia", -2, 118],
  MY: ["Malásia", 4.2, 102], SG: ["Singapura", 1.35, 103.8], TH: ["Tailândia", 15, 101],
  VN: ["Vietnã", 16, 106], PH: ["Filipinas", 12.9, 122], MM: ["Mianmar", 21.9, 96],
  KH: ["Camboja", 12.6, 104.9], LA: ["Laos", 19.9, 102.5], BN: ["Brunei", 4.5, 114.7],
  TL: ["Timor-Leste", -8.8, 125.7],

  // ── África do Norte e Ocidental ──
  MA: ["Marrocos", 32, -6], DZ: ["Argélia", 28, 3], TN: ["Tunísia", 34, 9],
  LY: ["Líbia", 27, 17], EG: ["Egito", 26.8, 30.8], SD: ["Sudão", 15.5, 30],
  MR: ["Mauritânia", 20.5, -10.9], ML: ["Mali", 17.6, -4], NE: ["Níger", 17.6, 8],
  TD: ["Chade", 15.5, 18.7], SN: ["Senegal", 14.5, -14.5], GM: ["Gâmbia", 13.4, -15.5],
  GW: ["Guiné-Bissau", 11.8, -15.2], GN: ["Guiné", 10, -11], SL: ["Serra Leoa", 8.5, -11.8],
  LR: ["Libéria", 6.4, -9.4], CI: ["Costa do Marfim", 7.5, -5.5], GH: ["Gana", 8, -1.2],
  TG: ["Togo", 8.6, 0.8], BJ: ["Benim", 9.3, 2.3], NG: ["Nigéria", 9.1, 8.7],
  BF: ["Burquina Faso", 12.2, -1.6], CV: ["Cabo Verde", 16, -24], EH: ["Saara Ocidental", 24.2, -12.9],

  // ── África Central, Oriental e Austral ──
  CM: ["Camarões", 5.7, 12.7], CF: ["República Centro-Africana", 6.6, 20.9],
  GA: ["Gabão", -0.8, 11.6], CG: ["República do Congo", -0.2, 15.8],
  CD: ["República Democrática do Congo", -2.9, 23.7], GQ: ["Guiné Equatorial", 1.6, 10.3],
  ST: ["São Tomé e Príncipe", 0.2, 6.6], AO: ["Angola", -12.5, 18.5], ZM: ["Zâmbia", -13.1, 27.8],
  ZW: ["Zimbábue", -19, 29.9], MW: ["Malaui", -13.3, 34.3], MZ: ["Moçambique", -18.25, 35],
  BW: ["Botsuana", -22.3, 24.7], NA: ["Namíbia", -22.6, 17.1], ZA: ["África do Sul", -29, 24],
  LS: ["Lesoto", -29.6, 28.2], SZ: ["Essuatíni", -26.5, 31.5], MG: ["Madagascar", -19, 46.9],
  MU: ["Maurício", -20.3, 57.6], SC: ["Seicheles", -4.7, 55.5], KM: ["Comores", -11.6, 43.3],
  RE: ["Reunião", -21.1, 55.5], YT: ["Mayotte", -12.8, 45.2], TZ: ["Tanzânia", -6.4, 34.9],
  KE: ["Quênia", 0.2, 37.9], UG: ["Uganda", 1.4, 32.3], RW: ["Ruanda", -1.9, 29.9],
  BI: ["Burundi", -3.4, 29.9], ET: ["Etiópia", 9.1, 40.5], ER: ["Eritreia", 15.2, 39.8],
  DJ: ["Djibuti", 11.8, 42.6], SO: ["Somália", 5.2, 46.2], SS: ["Sudão do Sul", 7.9, 30],
  SH: ["Santa Helena", -15.9, -5.7],

  // ── Oceania ──
  AU: ["Austrália", -25, 134], NZ: ["Nova Zelândia", -41, 174], PG: ["Papua-Nova Guiné", -6.3, 143.9],
  FJ: ["Fiji", -17.7, 178], SB: ["Ilhas Salomão", -9.6, 160.2], VU: ["Vanuatu", -15.4, 166.9],
  NC: ["Nova Caledônia", -20.9, 165.6], PF: ["Polinésia Francesa", -17.7, -149.4],
  WS: ["Samoa", -13.8, -172.1], TO: ["Tonga", -21.2, -175.2], KI: ["Quiribáti", 1.9, -157.4],
  FM: ["Micronésia", 6.9, 158.2], MH: ["Ilhas Marshall", 7.1, 171.2], PW: ["Palau", 7.5, 134.6],
  NR: ["Nauru", -0.5, 166.9], TV: ["Tuvalu", -7.1, 177.6], GU: ["Guam", 13.4, 144.8],
  MP: ["Marianas do Norte", 15.2, 145.8], AS: ["Samoa Americana", -14.3, -170.7],
  CK: ["Ilhas Cook", -21.2, -159.8], NU: ["Niue", -19, -169.9], WF: ["Wallis e Futuna", -13.8, -177.2],
  NF: ["Ilha Norfolk", -29, 168], TK: ["Tokelau", -9.2, -171.8],

  // ── Territórios remotos ──
  AQ: ["Antártida", -75, 0], BV: ["Ilha Bouvet", -54.4, 3.4], GS: ["Geórgia do Sul", -54.5, -37],
  HM: ["Ilhas Heard e McDonald", -53.1, 73.5], TF: ["Terras Austrais Francesas", -49.3, 69.2],
  IO: ["Território Britânico do Oceano Índico", -7.3, 72.4], CX: ["Ilha Christmas", -10.5, 105.6],
  CC: ["Ilhas Cocos", -12.2, 96.9], UM: ["Ilhas Menores dos EUA", 19.3, 166.6],
  PN: ["Ilhas Pitcairn", -24.4, -128.3], SJ: ["Svalbard e Jan Mayen", 78, 20],

  // ── Códigos ISO OBSOLETOS que a base de IP ainda emite ──
  // Não são erro de digitação: blocos antigos continuam registrados com eles.
  // Sem estas duas linhas a venda seria geolocalizada e mesmo assim não
  // apareceria no globo — que é exatamente a falha que a cobertura mundial
  // veio corrigir. `npm run test:pais` falha se um código novo ficar de fora.
  FX: ["França (metropolitana)", 46.5, 2.5], // retirado da ISO; equivale a FR
  AN: ["Antilhas Neerlandesas", 12.2, -69], // dissolvido em 2010 → CW, SX, BQ
};

/**
 * Emoji da bandeira a partir do código ISO-2, pelos indicadores regionais
 * Unicode (`A` → U+1F1E6). Nada é guardado: o par de indicadores É a bandeira.
 */
export function bandeiraDe(code: string): string {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🌐";
  return String.fromCodePoint(...[...c].map((l) => 0x1f1e6 + l.charCodeAt(0) - 65));
}

export const PAIS: Record<string, Pais> = Object.fromEntries(
  Object.entries(DADOS).map(([code, [nome, lat, lng]]) => [
    code,
    { nome, lat, lng, bandeira: bandeiraDe(code) },
  ]),
);

/** Centroide do país, ou `null` se não estiver na tabela. */
export function centroide(code: string): { lat: number; lng: number } | null {
  const p = PAIS[code.trim().toUpperCase()];
  return p ? { lat: p.lat, lng: p.lng } : null;
}

/** Nome legível, caindo no código cru quando desconhecido. */
export function nomePais(code: string): string {
  return PAIS[code.trim().toUpperCase()]?.nome ?? code.toUpperCase();
}

/**
 * O país existe na tabela e pode ser desenhado no globo?
 *
 * ⚠️ **Quem não pode ser desenhado NÃO some** — o ranking o mostra com o código
 * cru e uma marca de "sem posição no mapa". Sumir em silêncio esconderia
 * justamente o mercado novo, que é o que o usuário está procurando quando abre
 * este bloco.
 */
export function temPosicao(code: string): boolean {
  return code.trim().toUpperCase() in PAIS;
}
