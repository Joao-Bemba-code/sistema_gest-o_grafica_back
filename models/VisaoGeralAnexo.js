const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const VisaoGeralAnexo = sequelize.define("visao_geral_anexo", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  entidade_tipo: { type: DataTypes.STRING(30) },
  entidade_id: { type: DataTypes.INTEGER },
  nome_original: { type: DataTypes.STRING(255), allowNull: false },
  mime: { type: DataTypes.STRING(100), allowNull: false },
  extensao: { type: DataTypes.STRING(10), allowNull: false },
  tamanho: { type: DataTypes.INTEGER, allowNull: false },
  conteudo: { type: DataTypes.BLOB, allowNull: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
});

module.exports = VisaoGeralAnexo;
