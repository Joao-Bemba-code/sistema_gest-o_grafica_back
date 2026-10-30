const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Documentos anexados à proposta (esboços, catálogos, aprovações do cliente).
// O conteúdo fica guardado na base de dados (BLOB) para sobreviver aos
// redeploys — o disco do Render é efémero. Um documento nunca é eliminado:
// só pode ser anulado, mantendo o ficheiro e o registo de quem anulou e quando.
const PropostaDocumento = sequelize.define("proposta_documento", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  proposta_id: { type: DataTypes.INTEGER, allowNull: false },
  nome_original: { type: DataTypes.STRING(255), allowNull: false },
  mime: { type: DataTypes.STRING(100) },
  tamanho: { type: DataTypes.INTEGER, defaultValue: 0 },
  conteudo: { type: DataTypes.BLOB("long"), allowNull: true },
  anulado: { type: DataTypes.BOOLEAN, defaultValue: false },
  anulado_em: { type: DataTypes.DATE, allowNull: true },
  anulado_por: { type: DataTypes.STRING(150), allowNull: true },
  anexado_por: { type: DataTypes.STRING(150), allowNull: true },
});

module.exports = PropostaDocumento;
