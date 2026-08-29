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
  tipo_material: { type: DataTypes.STRING(20), defaultValue: "material" },
  usar_parcial: { type: DataTypes.BOOLEAN, defaultValue: false },
  formato_final: { type: DataTypes.STRING(50) },
  largura_final: { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
  altura_final: { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
  pecas_por_folha: { type: DataTypes.INTEGER, defaultValue: 1 },
  preco_folha: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  formato: { type: DataTypes.STRING(50) },
  largura_mm: { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
  altura_mm: { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
  quantidade_folhas: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = OrcamentoMaterial;
