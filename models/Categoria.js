const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Categoria = sequelize.define("categoria", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(100), allowNull: false },
  familia: {
    type: DataTypes.ENUM(
      "papeis",
      "tintas",
      "chapas",
      "produto_quimico",
      "equipamentos",
      "ferramentas",
      "suporte_especial",
      "material_acabamento",
      "consumiveis",
      "impressao",
      "acabamento",
      "pre_impressao",
      "design",
      "montagem",
      "logistica",
      "consultoria",
      "manutencao",
      "servicos_gerais"
    ),
    defaultValue: "papeis",
  },
  subfamilia: { type: DataTypes.STRING(100), allowNull: true },
  tipo: {
    type: DataTypes.STRING(50),
    defaultValue: "materia_prima",
  },
  campos_especificacao: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  validade_dias: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null, comment: "Dias de validade para produtos químicos" },
  data_validade: { type: DataTypes.DATEONLY, allowNull: true, defaultValue: null, comment: "Data de validade para produtos químicos" },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = Categoria;
