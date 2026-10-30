const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Proposta = sequelize.define("proposta", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  cliente_id: { type: DataTypes.INTEGER, allowNull: false },
  numero: { type: DataTypes.STRING(30), allowNull: false },
  unidade: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "UN-01" },
  // Identificação (COM-PRO-02)
  versao: { type: DataTypes.STRING(20), allowNull: true, defaultValue: "1.0" },
  tipo: { type: DataTypes.STRING(100), allowNull: true },
  origem: { type: DataTypes.STRING(100), allowNull: true },
  objecto: { type: DataTypes.STRING(200), allowNull: false },
  // Especificação
  familia: { type: DataTypes.STRING(100), allowNull: true },
  produto: { type: DataTypes.STRING(150), allowNull: true },
  formato: { type: DataTypes.STRING(100), allowNull: true },
  quantidade: { type: DataTypes.STRING(100), allowNull: true },
  suporte: { type: DataTypes.STRING(100), allowNull: true },
  // Lista de produtos acabados: [{ nome, quantidade }].
  produtos: { type: DataTypes.JSON, defaultValue: [] },
  cores: { type: DataTypes.STRING(100), allowNull: true },
  acabamento: { type: DataTypes.STRING(150), allowNull: true },
  descricao: { type: DataTypes.TEXT },
  // Condições
  data_emissao: { type: DataTypes.DATEONLY, allowNull: true },
  validade_data: { type: DataTypes.DATEONLY, allowNull: true },
  valor: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  condicoes_pagamento: { type: DataTypes.STRING(200) },
  prazo_execucao: { type: DataTypes.STRING(100) },
  prazo_entrega: { type: DataTypes.STRING(100) },
  local_entrega: { type: DataTypes.STRING(200), allowNull: true },
  condicoes_entrega: { type: DataTypes.STRING(200), allowNull: true },
  observacoes: { type: DataTypes.TEXT, allowNull: true },
  // Documentos & acessos
  estado_documental: { type: DataTypes.STRING(50), allowNull: true, defaultValue: "Em preparação" },
  modelo_documental: { type: DataTypes.STRING(100), allowNull: true },
  responsavel_comercial: { type: DataTypes.STRING(150) },
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
  anulado: { type: DataTypes.BOOLEAN, defaultValue: false },
  motivo_anulacao: { type: DataTypes.TEXT },
  anulado_por: { type: DataTypes.STRING(200) },
  data_anulacao: { type: DataTypes.DATE, allowNull: true },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = Proposta;
