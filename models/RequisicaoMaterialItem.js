const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const RequisicaoMaterialItem = sequelize.define("requisicao_material_item", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  requisicao_id: { type: DataTypes.INTEGER, allowNull: false },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  material_id: { type: DataTypes.INTEGER, allowNull: false },
  material_codigo: { type: DataTypes.STRING(50) },
  material_nome: { type: DataTypes.STRING(200), allowNull: false },
  unidade: { type: DataTypes.STRING(20), defaultValue: "un" },
  quantidade: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  // quantidade efectivamente saída do stock no momento da aprovação
  quantidade_atendida: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  observacoes: { type: DataTypes.STRING(300) },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = RequisicaoMaterialItem;
