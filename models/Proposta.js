const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Proposta = sequelize.define("proposta", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  cliente_id: { type: DataTypes.INTEGER, allowNull: false },
  numero: { type: DataTypes.STRING(30), allowNull: false },
  unidade: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "UN-01" },
  objecto: { type: DataTypes.STRING(200), allowNull: false },
  descricao: { type: DataTypes.TEXT },
  prazo_execucao: { type: DataTypes.STRING(100) },
  validade: { type: DataTypes.INTEGER, defaultValue: 30 },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "rascunho" },
  data_envio: { type: DataTypes.DATE, allowNull: true },
  data_recebida: { type: DataTypes.DATE, allowNull: true },
  data_avaliada: { type: DataTypes.DATE, allowNull: true },
  data_aprovada: { type: DataTypes.DATE, allowNull: true },
  data_rejeitada: { type: DataTypes.DATE, allowNull: true },
  avaliacao: { type: DataTypes.TEXT },
  motivo_rejeicao: { type: DataTypes.TEXT },
  orcamento_id: { type: DataTypes.INTEGER, allowNull: true },
  usuario_id: { type: DataTypes.INTEGER },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = Proposta;
