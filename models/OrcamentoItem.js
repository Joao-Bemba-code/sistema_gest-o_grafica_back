const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const OrcamentoItem = sequelize.define("orcamento_item", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  orcamento_id: { type: DataTypes.INTEGER, allowNull: false },
  descricao: { type: DataTypes.STRING(255), allowNull: false },
  quantidade: { type: DataTypes.INTEGER, defaultValue: 1 },
  preco_unit: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
});

module.exports = OrcamentoItem;
