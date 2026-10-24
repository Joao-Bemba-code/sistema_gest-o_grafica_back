const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Sessão de caixa: abertura com um valor contado, fecho com o valor conferido.
// O valor esperado é calculado a partir dos movimentos confirmados da conta
// (caixa) registados durante a sessão. A diferença entre o contado no fecho e
// o esperado fica registada para auditoria.
const CaixaSessao = sequelize.define("caixa_sessao", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  conta_bancaria_id: { type: DataTypes.INTEGER, allowNull: false },
  data_abertura: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  valor_abertura: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  usuario_abertura_id: { type: DataTypes.INTEGER },
  usuario_abertura_nome: { type: DataTypes.STRING(200) },
  observacoes_abertura: { type: DataTypes.TEXT },
  data_fecho: { type: DataTypes.DATE, allowNull: true },
  valor_esperado: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  valor_fecho: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  diferenca: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  usuario_fecho_id: { type: DataTypes.INTEGER },
  usuario_fecho_nome: { type: DataTypes.STRING(200) },
  observacoes_fecho: { type: DataTypes.TEXT },
  estado: {
    type: DataTypes.ENUM("aberto", "fechado"),
    defaultValue: "aberto",
  },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: "caixa_sessoes",
  defaultScope: { where: { deleted: false } },
});

module.exports = CaixaSessao;
