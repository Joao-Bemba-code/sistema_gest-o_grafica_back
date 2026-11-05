const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Registo de um serviço executado pela equipa (módulo Recursos Humanos).
// Guarda a mesma linha de cálculo do orçamento: quantos trabalhadores,
// quanto tempo e a quanto sai — o total fica gravado para não depender
// de nova conta depois de o catálogo de serviços mudar.
const ServicoExecucao = sequelize.define("servico_execucao", {
  id:              { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id:  { type: DataTypes.INTEGER, allowNull: false },
  servico_id:      { type: DataTypes.INTEGER, allowNull: true },
  descricao:       { type: DataTypes.STRING(255), allowNull: false },
  mob:             { type: DataTypes.INTEGER, defaultValue: 1 },
  prazo_execucao:  { type: DataTypes.INTEGER, defaultValue: 1 },
  prazo_unidade:   { type: DataTypes.STRING(20), defaultValue: "dias" },
  duracao_horas:   { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_hora:      { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total:           { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  observacoes:     { type: DataTypes.TEXT, allowNull: true },
  usuario_id:      { type: DataTypes.INTEGER, allowNull: true },
  deleted:         { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt:       { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = ServicoExecucao;
