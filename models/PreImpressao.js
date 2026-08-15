const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const PreImpressao = sequelize.define("pre_impressao", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  ordem_producao_id: { type: DataTypes.INTEGER },
  arquivo: { type: DataTypes.BOOLEAN, defaultValue: false },
  tamanho: { type: DataTypes.BOOLEAN, defaultValue: false },
  sangria: { type: DataTypes.BOOLEAN, defaultValue: false },
  cmyk: { type: DataTypes.BOOLEAN, defaultValue: false },
  fontes: { type: DataTypes.BOOLEAN, defaultValue: false },
  imagens: { type: DataTypes.BOOLEAN, defaultValue: false },
  revisao: { type: DataTypes.BOOLEAN, defaultValue: false },
  aprovacao: { type: DataTypes.BOOLEAN, defaultValue: false },
  responsavel: { type: DataTypes.STRING(100) },
  resultado: { type: DataTypes.ENUM("aprovado", "reprovado", "pendente"), defaultValue: "pendente" },
  observacoes: { type: DataTypes.TEXT },
  usuario_id: { type: DataTypes.INTEGER },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = PreImpressao;
