const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const OrcamentoMaterial = sequelize.define("orcamento_material", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  orcamento_item_id: { type: DataTypes.INTEGER, allowNull: false },
  material_id: { type: DataTypes.INTEGER },
  descricao: { type: DataTypes.STRING(255), allowNull: false },
  unidade: { type: DataTypes.STRING(20), defaultValue: "un" },
  quantidade: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  custo_unit: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  custo_total: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  mover_estoque: { type: DataTypes.BOOLEAN, defaultValue: false },
});

module.exports = OrcamentoMaterial;
