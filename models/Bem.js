const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Bem patrimonial da organização: equipamentos, mobiliário, viaturas, etc.
const Bem = sequelize.define("bem", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  codigo: { type: DataTypes.STRING(50) },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  categoria: { type: DataTypes.STRING(100) },
  familia: { type: DataTypes.STRING(100) },
  subfamilia: { type: DataTypes.STRING(100) },
  grupo: { type: DataTypes.STRING(100) },
  tipo: { type: DataTypes.STRING(100) },
  valor_aquisicao: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  data_aquisicao: { type: DataTypes.DATEONLY },
  estado: {
    type: DataTypes.ENUM("ativo", "manutencao", "abate", "avariado"),
    defaultValue: "ativo",
  },
  localizacao: { type: DataTypes.STRING(100) },
  observacoes: { type: DataTypes.TEXT },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = Bem;
