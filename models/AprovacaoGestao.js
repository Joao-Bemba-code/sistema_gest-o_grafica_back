const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const AprovacaoGestao = sequelize.define("aprovacao_gestao", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  codigo: { type: DataTypes.STRING(30), allowNull: false },
  origem: { type: DataTypes.STRING(100), allowNull: false },
  descricao: { type: DataTypes.STRING(300), allowNull: false },
  valor: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  alcada: { type: DataTypes.ENUM("KSCP", "Direção Geral"), allowNull: false, defaultValue: "KSCP" },
  requisito: { type: DataTypes.STRING(300) },
  verificacao_documental: { type: DataTypes.STRING(300) },
  condicao_execucao: { type: DataTypes.STRING(300) },
  estado: { type: DataTypes.ENUM("pendente", "aprovada", "devolvida", "rejeitada"), allowNull: false, defaultValue: "pendente" },
  comprovativo_id: { type: DataTypes.INTEGER },
  criado_por: { type: DataTypes.INTEGER, allowNull: false },
  decidido_por: { type: DataTypes.INTEGER },
  data_decisao: { type: DataTypes.DATE },
  pin_validado_em: { type: DataTypes.DATE },
  observacao_decisao: { type: DataTypes.TEXT },
}, {
  indexes: [
    { unique: true, fields: ["organizacao_id", "codigo"], name: "aprovacao_gestao_codigo_uk" },
  ],
});

module.exports = AprovacaoGestao;
