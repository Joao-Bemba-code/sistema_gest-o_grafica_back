const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const TesourariaMovimento = sequelize.define("tesouraria_movimento", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  conta_bancaria_id: { type: DataTypes.INTEGER },
  tipo: {
    type: DataTypes.ENUM("entrada", "saida", "transferencia"),
    allowNull: false,
  },
  categoria: {
    type: DataTypes.ENUM(
      "venda", "servico", "devolucao",
      "compra", "despesa", "salario", "imposto", "aluguel", "utilidades",
      "transferencia_interna", "deposito", "levantamento"
    ),
    defaultValue: "venda",
  },
  descricao: { type: DataTypes.STRING(300), allowNull: false },
  valor: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  data_movimento: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
  hora_movimento: { type: DataTypes.TIME },
  referencia: { type: DataTypes.STRING(100) },
  referencia_tipo: {
    type: DataTypes.ENUM("fatura", "orcamento", "recibo", "ordem_saida", "deposito", "outro"),
  },
  referencia_id: { type: DataTypes.INTEGER },
  cliente_id: { type: DataTypes.INTEGER },
  fatura_id: { type: DataTypes.INTEGER },
  conta_destino_id: { type: DataTypes.INTEGER },
  metodo_pagamento: {
    type: DataTypes.ENUM("dinheiro", "transferencia", "deposito", "ordem_saida", "multicaixa", "referencia", "cheque"),
  },
  comprovativo: { type: DataTypes.STRING(500) },
  estado: {
    type: DataTypes.ENUM("pendente", "confirmado", "cancelado"),
    defaultValue: "confirmado",
  },
  aprovado_por: { type: DataTypes.INTEGER },
  observacoes: { type: DataTypes.TEXT },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = TesourariaMovimento;
