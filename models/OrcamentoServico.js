const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const OrcamentoServico = sequelize.define("orcamento_servico", {
  id:              { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  orcamento_id:    { type: DataTypes.INTEGER, allowNull: false },
  servico_id:      { type: DataTypes.INTEGER, allowNull: true },
  descricao:       { type: DataTypes.STRING(255), allowNull: false },
  mob:             { type: DataTypes.INTEGER, defaultValue: 1 },
  prazo_execucao:  { type: DataTypes.INTEGER, defaultValue: 1 },
  duracao_horas:   { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_hora:      { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total:           { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  deleted:         { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt:       { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = OrcamentoServico;
