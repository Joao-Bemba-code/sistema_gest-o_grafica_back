const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const OrcamentoItem = sequelize.define("orcamento_item", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  orcamento_id: { type: DataTypes.INTEGER, allowNull: false },
  descricao: { type: DataTypes.STRING(255), allowNull: false },
  quantidade: { type: DataTypes.INTEGER, defaultValue: 1 },
  preco_unit: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  composto: { type: DataTypes.BOOLEAN, defaultValue: false },
  margem: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  folhas_impressao: { type: DataTypes.INTEGER, defaultValue: 0 },
  toner_material_id: { type: DataTypes.INTEGER },
  toner_custo_unit: { type: DataTypes.DECIMAL(8, 4), defaultValue: 0 },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = OrcamentoItem;
