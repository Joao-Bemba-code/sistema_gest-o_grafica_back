const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Orcamento = sequelize.define("orcamento", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  cliente_id: { type: DataTypes.INTEGER, allowNull: false },
  numero: { type: DataTypes.STRING(30), allowNull: false },
  data_emissao: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
  validade: { type: DataTypes.INTEGER, defaultValue: 30 },
  estado: { type: DataTypes.ENUM("pendente", "aprovado", "cancelado", "rejeitado"), defaultValue: "pendente" },
  produto: { type: DataTypes.STRING(200) },
  formato: { type: DataTypes.STRING(100) },
  papel: { type: DataTypes.STRING(200) },
  impressao: { type: DataTypes.STRING(200) },
  acabamento: { type: DataTypes.TEXT },
  especificacao_json: { type: DataTypes.JSON },
  prazo_execucao: { type: DataTypes.STRING(100) },
  condicoes_pagamento: { type: DataTypes.STRING(100) },
  iva: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_sem_iva: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_iva: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  total_com_iva: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  observacoes: { type: DataTypes.TEXT },
  usuario_id: { type: DataTypes.INTEGER },
});

module.exports = Orcamento;
