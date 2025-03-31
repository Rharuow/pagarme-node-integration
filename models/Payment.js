const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  method: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, default: "pending" },
  transactionId: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Payment", PaymentSchema);
