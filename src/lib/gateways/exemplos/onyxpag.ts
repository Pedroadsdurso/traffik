/**
 * Payloads de exemplo da **OnyxPag**, para o testador da aba Testes.
 *
 * ⚠️ **Só o primeiro é literal da documentação** (https://doc.onyxpag.com,
 * seção "Webhooks e PostbackURL"). Os outros três são o MESMO formato com o
 * evento e o status trocados — a doc mostra um exemplo só.
 *
 * Isso importa: um exemplo derivado prova que o parser trata o evento, **não**
 * que o gateway manda exatamente aquilo. Quem fecha essa lacuna é rodar um
 * payload REAL no testador e conferir que não sobrou nada em âmbar.
 */
export const EXEMPLOS_ONYXPAG = [
  {
    nome: "Pagamento confirmado (PIX) — literal da doc",
    payload: {
      event: "transaction.paid",
      timestamp: "2025-01-07T08:51:18-03:00",
      data: {
        transaction_id: "PXB_68E4FE71E4AF4_1759837809",
        external_id: "12345",
        amount: "25.90",
        fee_amount: "1.30",
        net_amount: "24.60",
        currency: "BRL",
        payment_method: "pix",
        status: "paid",
        created_at: "2025-01-07T08:50:11-03:00",
        updated_at: "2025-01-07T08:51:18-03:00",
        paid_at: "2025-01-07T08:51:18-03:00",
        customer: {
          name: "João Silva",
          email: "joao.silva@email.com",
          phone: "11999999999",
          document: "12345678900",
        },
        items: [{ title: "Nome do produto", quantity: 1, unit_price: "25.90" }],
      },
    },
  },
  {
    nome: "Cobrança criada (PIX aguardando) — derivado",
    payload: {
      event: "transaction.created",
      timestamp: "2025-01-07T08:50:11-03:00",
      data: {
        transaction_id: "PXB_68E4FE71E4AF4_1759837809",
        external_id: "12345",
        amount: "25.90",
        fee_amount: "1.30",
        net_amount: "24.60",
        currency: "BRL",
        payment_method: "pix",
        status: "pending",
        created_at: "2025-01-07T08:50:11-03:00",
        customer: {
          name: "João Silva",
          email: "joao.silva@email.com",
          phone: "11999999999",
          document: "12345678900",
        },
        items: [{ title: "Nome do produto", quantity: 1, unit_price: "25.90" }],
      },
    },
  },
  {
    nome: "Cobrança expirada — derivado",
    payload: {
      event: "transaction.expired",
      timestamp: "2025-01-08T08:50:11-03:00",
      data: {
        transaction_id: "PXB_68E4FE71E4AF4_1759837809",
        amount: "25.90",
        currency: "BRL",
        payment_method: "pix",
        status: "expired",
        customer: { name: "João Silva", email: "joao.silva@email.com" },
        items: [{ title: "Nome do produto", quantity: 1, unit_price: "25.90" }],
      },
    },
  },
  {
    nome: "Reembolso (cartão) — derivado",
    payload: {
      event: "transaction.refunded",
      timestamp: "2025-01-09T10:12:00-03:00",
      data: {
        transaction_id: "CRD_77A1BB90C2D31_1759900001",
        amount: "100.00",
        fee_amount: "5.90",
        net_amount: "94.10",
        currency: "BRL",
        payment_method: "credit_card",
        status: "refunded",
        customer: {
          name: "Maria Souza",
          email: "maria@email.com",
          phone: "11988887777",
          document: "98765432100",
        },
        items: [{ title: "Mentoria Avançada", quantity: 1, unit_price: "100.00" }],
      },
    },
  },
  {
    nome: "Evento DESCONHECIDO — deve gerar aviso",
    payload: {
      event: "transaction.chargeback_opened",
      timestamp: "2025-01-10T09:00:00-03:00",
      data: {
        transaction_id: "CRD_99Z9ZZ99Z9Z99_1759911111",
        amount: "49.90",
        currency: "BRL",
        payment_method: "credit_card",
        status: "contestada",
        customer: { name: "Teste", email: "teste@email.com" },
        items: [{ title: "Produto", quantity: 1, unit_price: "49.90" }],
      },
    },
  },
];
