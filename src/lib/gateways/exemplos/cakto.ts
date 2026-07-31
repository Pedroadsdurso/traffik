/**
 * Payloads de exemplo da Cakto, para o testador da aba Testes.
 *
 * O primeiro é o da documentação oficial, verbatim. O segundo é o **mesmo**
 * payload no modo agrupado: o item principal mais um order bump, com o mesmo
 * `checkout` e `parent_order` apontando para o `refId` do principal — que é a
 * forma que a documentação descreve para o disparo agrupado.
 *
 * ⚠️ Existem para validar a integração ANTES de haver conta no gateway. Quando
 * um payload real chegar e divergir daqui, é o payload real que manda: atualize
 * este arquivo com o que veio de verdade.
 */

const itemPrincipal = {
  id: "87956abe-940e-4e8b-8a27-82c482920f64",
  refId: "9vbgfmg",
  customer: {
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "34999999999",
    docNumber: "12345678909",
    birthDate: null,
    docType: "cpf",
  },
  address: null,
  shipping: null,
  affiliate: "affiliate@example.com",
  offer: { id: "B8BcHrY", name: "Special Offer", price: 100, image: null },
  offer_type: "main",
  product: {
    name: "Produto Teste",
    id: "ff3fdf61-e88f-43b5-982a-32d50f112414",
    short_id: "AckhQ75",
    supportEmail: "suporte@seudominio.com",
    type: "unique",
    invoiceDescription: "",
  },
  checkout: 12345,
  subscription: null,
  subscription_period: 1,
  parent_order: null,
  checkoutUrl: "https://pay.cakto.com.br/EXAMPLE",
  status: "paid",
  baseAmount: 100,
  discount: 10,
  amount: 90,
  commissions: [
    { user: "produtor@seudominio.com", totalAmount: 85.5, type: "producer", percentage: 95 },
  ],
  fees: 4.5,
  couponCode: null,
  reason: null,
  refund_reason: null,
  installments: 1,
  paymentMethod: "credit_card",
  paymentMethodName: "Cartão de Crédito",
  paidAt: "2026-06-26T12:00:00.000000+00:00",
  createdAt: "2026-06-26T12:00:00.000000+00:00",
  due_date: null,
  refundedAt: null,
  chargedbackAt: null,
  canceledAt: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_term: null,
  utm_content: null,
  sck: null,
  fbc: null,
  fbp: null,
  card: { lastDigits: "4323", holderName: "Card Example", brand: "visa" },
};

/** O order bump: MESMO `checkout`, `parent_order` = `refId` do principal. */
const itemOrderBump = {
  ...itemPrincipal,
  id: "b1d7a0c2-5e3f-4a91-9c8d-6f2b1a4e7d90",
  refId: "k7Xp2qB",
  offer: { id: "K2pQ9wL", name: "E-book Bônus", price: 27, image: null },
  offer_type: "orderbump",
  product: {
    ...itemPrincipal.product,
    name: "E-book Bônus",
    id: "a9c0e51d-22b7-4f48-9a13-7e5d4c8b2f01",
    short_id: "Bz9Lm3X",
  },
  parent_order: "9vbgfmg",
  baseAmount: 27,
  discount: 0,
  amount: 27,
  commissions: [
    { user: "produtor@seudominio.com", totalAmount: 25.65, type: "producer", percentage: 95 },
  ],
  fees: 1.35,
};

export const EXEMPLOS_CAKTO = [
  {
    nome: "Compra aprovada (disparo individual)",
    payload: {
      secret: "f8c3de3d-1fea-4d7c-a8b0-29f63c4c3454",
      event: "purchase_approved",
      data: itemPrincipal,
    },
  },
  {
    nome: "Compra aprovada com order bump (disparo agrupado)",
    payload: {
      secret: "f8c3de3d-1fea-4d7c-a8b0-29f63c4c3454",
      event: "purchase_approved",
      // ⚠️ Aqui `data` é ARRAY. É a diferença que quebraria um parser que
      // assumisse objeto — em silêncio, processando um item ou nenhum.
      data: [itemPrincipal, itemOrderBump],
    },
  },
  {
    nome: "Pix gerado (venda pendente)",
    payload: {
      secret: "f8c3de3d-1fea-4d7c-a8b0-29f63c4c3454",
      event: "pix_gerado",
      data: { ...itemPrincipal, status: "waiting_payment", paidAt: null, paymentMethod: "pix" },
    },
  },
  {
    nome: "Evento que ainda não conhecemos",
    payload: {
      secret: "f8c3de3d-1fea-4d7c-a8b0-29f63c4c3454",
      event: "evento_novo_da_cakto",
      data: { ...itemPrincipal, status: "refunded" },
    },
  },
];
