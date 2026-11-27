const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Documentos anexados a uma fatura (comprovativos, autorizações) para a
// aprovação no Comercial e validação na Tesouraria. O conteúdo é guardado na
// base de dados (BLOB) para sobreviver a redeploys — o disco é efémero.
const FaturaAnexo = sequelize.define("fatura_anexo", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  fatura_id: { type: DataTypes.INTEGER, allowNull: false },
  nome_original: { type: DataTypes.STRING(255), allowNull: false },
  mime: { type: DataTypes.STRING(100), allowNull: false },
  tamanho: { type: DataTypes.INTEGER, defaultValue: 0 },
  conteudo: { type: DataTypes.BLOB("long"), allowNull: true },
});

module.exports = FaturaAnexo;