require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cors = require("cors");
const Payment = require("./models/Payment");

const app = express();
app.use(express.json());
app.use(cors());

const { PAGARME_API_KEY, MONGO_URI, PORT } = process.env;

if (!PAGARME_API_KEY || !MONGO_URI) {
  console.error("❌ Erro: Variáveis de ambiente não definidas!");
  process.exit(1); // Encerra o processo se faltarem dados essenciais
}

console.log(`Basic ${Buffer.from(PAGARME_API_KEY).toString("base64")}`);

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB conectado"))
  .catch((err) => console.error("❌ Erro ao conectar ao MongoDB:", err));

// Rota inicial
app.get("/", (req, res) =>
  res.send("API de Pagamentos com Pagar.me + MongoDB")
);

// 🔹 **Pagamento com Cartão de Crédito**
app.post("/pagar/cartao", async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.pagar.me/core/v5/orders",
      req.body,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(PAGARME_API_KEY + ":").toString(
            "base64"
          )}`,
          "Content-Type": "application/json",
        },
      }
    );

    const charges = response.data.charges || [];
    const lastTransaction = charges[0]?.last_transaction || {};

    // 🔹 Salvar pagamento no MongoDB
    await Payment.create({
      method: "credit_card",
      amount: req.body.items.reduce(
        (amount, currentItem) => amount + currentItem.amount,
        0
      ),
      status: lastTransaction.status || "pending",
      transactionId: response.data.id,
      brand: lastTransaction.card_brand || "N/A",
      last4: lastTransaction.card_last_four_digits || "N/A",
    });

    res.json({
      message: "Pagamento com cartão realizado com sucesso!",
      transactionId: response.data.id,
      status: lastTransaction.status,
      brand: lastTransaction.card_brand,
      last4: lastTransaction.card_last_four_digits,
    });
  } catch (error) {
    console.error(
      "Erro ao processar pagamento:",
      error.response?.data || error
    );
    res.status(400).json({
      error: error.response?.data || "Erro ao processar pagamento",
    });
  }
});

// Rota para listar pagamentos
app.get("/pagamentos", async (req, res) => {
  const pagamentos = await Payment.find();
  res.json(pagamentos);
});

// 🔹 **Pagamento com PIX (Versão 5)**
app.post("/pagar/pix", async (req, res) => {
  try {
    const { amount } = req.body;

    const response = await axios.post(
      "https://api.pagar.me/core/v5/orders",
      {
        customer: {
          name: "Cliente Exemplo",
          email: "cliente@email.com",
          type: "individual",
        },
        items: [
          {
            description: "Produto Teste",
            quantity: 1,
            amount: amount, // O valor já deve estar em centavos
          },
        ],
        payments: [
          {
            payment_method: "pix",
            pix: {
              expires_in: 3600, // Expira em 1 hora
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(PAGARME_API_KEY).toString(
            "base64"
          )}`, // 🔹 Usa Bearer Token
          "Content-Type": "application/json",
        },
      }
    );
    console.log({ response });

    const charges = response.data.charges || [];
    const lastTransaction = charges[0]?.last_transaction || {};

    // Salvar pagamento no MongoDB
    const payment = await Payment.create({
      method: "pix",
      amount,
      status: "pending",
      transactionId: response.data.id,
      qr_code: lastTransaction.qr_code || "N/A",
      qr_code_url: lastTransaction.qr_code_url || "N/A",
    });

    console.log({ payment });

    res.json({
      message: "Pedido criado com sucesso!",
      transactionId: response.data.id,
      qr_code: response.data.charges[0].last_transaction.qr_code,
      qr_code_url: response.data.charges[0].last_transaction.qr_code_url,
    });
  } catch (error) {
    console.error("error = ", error.response?.data || error);
    res.status(400).json({
      error: error.response?.data || "Erro ao processar PIX",
    });
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
