const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Faturacao = sequelize.define("faturacao", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  orcamento_id: { type: DataTypes.INTEGER },
  ordem_producao_id: { type: DataTypes.INTEGER },
  cliente_id: { type: DataTypes.INTEGER },
  tipo: {
    type: DataTypes.ENUM("fatura", "recibo", "proforma", "nota_credito", "factura_recibo"),
    defaultValue: "fatura",
  },
  numero: { type: DataTypes.STRING(30), allowNull: false },
  data_emissao: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
  data_vencimento: { type: DataTypes.DATEONLY },
  data_pagamento: { type: DataTypes.DATEONLY },
  itens: { type: DataTypes.JSON },
  subtotal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  iva: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  valor_iva: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_pago: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  estado: {
    type: DataTypes.ENUM("emitida", "paga", "parcial", "vencida", "cancelada"),
    defaultValue: "emitida",
  },
  metodo_pagamento: { type: DataTypes.STRING(50) },
  observacoes: { type: DataTypes.TEXT },
  usuario_id: { type: DataTypes.INTEGER },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = Faturacao;
