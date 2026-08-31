const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const OrdemProducao = sequelize.define("ordem_producao", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  cliente_id: { type: DataTypes.INTEGER },
  orcamento_id: { type: DataTypes.INTEGER },
  numero: { type: DataTypes.STRING(30), allowNull: false },
  produto: { type: DataTypes.STRING(200) },
  quantidade: { type: DataTypes.INTEGER },
  data_entrada: { type: DataTypes.DATEONLY },
  data_entrega: { type: DataTypes.DATEONLY },
  estado: {
    type: DataTypes.ENUM("aguardando", "em_producao", "finalizado", "entregue"),
    defaultValue: "aguardando",
  },
  requisicao_estado: {
    type: DataTypes.ENUM("pendente", "libertada"),
    defaultValue: "pendente",
  },
  progresso: { type: DataTypes.INTEGER, defaultValue: 0 },
  pre_impressao_ok: { type: DataTypes.BOOLEAN, defaultValue: false },
  impressao_ok: { type: DataTypes.BOOLEAN, defaultValue: false },
  acabamento_ok: { type: DataTypes.BOOLEAN, defaultValue: false },
  qualidade_ok: { type: DataTypes.BOOLEAN, defaultValue: false },
  entrega_ok: { type: DataTypes.BOOLEAN, defaultValue: false },
  observacoes: { type: DataTypes.TEXT },
  historico_processos: { type: DataTypes.JSON, defaultValue: [] },
  usuario_id: { type: DataTypes.INTEGER },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = OrdemProducao;
