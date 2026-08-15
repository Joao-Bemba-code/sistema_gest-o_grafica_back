const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Qualidade = sequelize.define("qualidade", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  ordem_producao_id: { type: DataTypes.INTEGER },
  cor: { type: DataTypes.ENUM("aprovado", "reprovado", "pendente"), defaultValue: "pendente" },
  corte: { type: DataTypes.ENUM("aprovado", "reprovado", "pendente"), defaultValue: "pendente" },
  quantidade: { type: DataTypes.ENUM("aprovado", "reprovado", "pendente"), defaultValue: "pendente" },
  acabamento: { type: DataTypes.ENUM("aprovado", "reprovado", "pendente"), defaultValue: "pendente" },
  embalagem: { type: DataTypes.ENUM("aprovado", "reprovado", "pendente"), defaultValue: "pendente" },
  resultado: { type: DataTypes.ENUM("aprovado", "reprovado", "pendente"), defaultValue: "pendente" },
  observacoes: { type: DataTypes.TEXT },
  usuario_id: { type: DataTypes.INTEGER },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = Qualidade;
