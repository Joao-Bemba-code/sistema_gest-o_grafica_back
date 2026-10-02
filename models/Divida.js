const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Dívida a receber de um cliente (dinheiro entregue à frente, encomenda em
// curso, serviços por facturar, etc.). É um COMPROMISSO: nasce quando o
// utilizador regista, não quando o dinheiro muda de mão. Só a baixa da dívida
// gera o movimento de tesouraria correspondente, para o saldo da conta nunca
// ser afectado por uma dívida ainda por receber.
const Divida = sequelize.define("divida", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  cliente_id: { type: DataTypes.INTEGER },
  fatura_id: { type: DataTypes.INTEGER },
  descricao: { type: DataTypes.STRING(300), allowNull: false },
  categoria: { type: DataTypes.STRING(100), defaultValue: "adiantamento" },
  valor: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  valor_pago: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  data_emissao: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
  data_vencimento: { type: DataTypes.DATEONLY },
  // Plano de pagamentos: [{ n, valor, vencimento, data_pagamento, valor_pago,
  // conta_bancaria_id, movimento_id }]. Vazio = dívida de valor único.
  parcelas: { type: DataTypes.JSON },
  conta_bancaria_id: { type: DataTypes.INTEGER },
  metodo_pagamento: {
    type: DataTypes.ENUM("dinheiro", "transferencia", "deposito", "ordem_saida", "multicaixa", "referencia", "cheque", "tpa"),
  },
  estado: {
    type: DataTypes.ENUM("pendente", "parcial", "paga", "vencida", "cancelada"),
    defaultValue: "pendente",
  },
  observacoes: { type: DataTypes.TEXT },
  usuario_id: { type: DataTypes.INTEGER },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = Divida;