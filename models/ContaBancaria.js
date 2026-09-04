const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const ContaBancaria = sequelize.define("conta_bancaria", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  banco_nome: { type: DataTypes.STRING(150), allowNull: false },
  banco_codigo: { type: DataTypes.STRING(20) },
  agencia: { type: DataTypes.STRING(50) },
  numero_conta: { type: DataTypes.STRING(50) },
  iban: { type: DataTypes.STRING(50) },
  moeda: { type: DataTypes.STRING(10), defaultValue: "AOA" },
  tipo_conta: {
    type: DataTypes.ENUM("corrente", "poupanca", "caixa", "investimento"),
    defaultValue: "corrente",
  },
  saldo_inicial: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  saldo_atual: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  titular: { type: DataTypes.STRING(200) },
  observacoes: { type: DataTypes.TEXT },
  favorita: { type: DataTypes.BOOLEAN, defaultValue: false },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = ContaBancaria;
