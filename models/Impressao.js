const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Impressao = sequelize.define("impressao", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  ordem_producao_id: { type: DataTypes.INTEGER },
  maquina: { type: DataTypes.STRING(100) },
  operador: { type: DataTypes.STRING(100) },
  data_inicio: { type: DataTypes.STRING(20) },
  data_fim: { type: DataTypes.STRING(20) },
  quantidade_produzida: { type: DataTypes.INTEGER, defaultValue: 0 },
  quantidade_rejeitada: { type: DataTypes.INTEGER, defaultValue: 0 },
  taxa_rejeicao: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  observacoes: { type: DataTypes.TEXT },
  usuario_id: { type: DataTypes.INTEGER },
});

module.exports = Impressao;
