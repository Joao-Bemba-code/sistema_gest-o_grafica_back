const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Maquina = sequelize.define("maquina", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  categoria_id: { type: DataTypes.INTEGER },

  // 1. Identificação
  codigo: { type: DataTypes.STRING(50) },
  nome_comum: { type: DataTypes.STRING(200), allowNull: false },
  nome_tecnico: { type: DataTypes.STRING(200) },
  descricao: { type: DataTypes.TEXT },
  subfamilia: { type: DataTypes.STRING(100) },
  fornecedor: { type: DataTypes.STRING(200) },
  unidade: { type: DataTypes.STRING(20), defaultValue: "un" },

  // 2. Especificação
  marca: { type: DataTypes.STRING(100) },
  modelo: { type: DataTypes.STRING(100) },
  numero_serie: { type: DataTypes.STRING(100) },
  fabricante: { type: DataTypes.STRING(200) },
  ano_fabrico: { type: DataTypes.INTEGER },
  numero_patrimonial: { type: DataTypes.STRING(100) },
  estado: {
    type: DataTypes.ENUM("operacional", "manutencao", "avariada", "desativada"),
    defaultValue: "operacional",
  },

  // 3. Capacidade
  capacidade_nominal: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  capacidade_pratica: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  tempo_medio_setup: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }, // minutos
  horas_disponiveis_dia: { type: DataTypes.DECIMAL(6, 2), defaultValue: 0 },
  horas_produtivas_dia: { type: DataTypes.DECIMAL(6, 2), defaultValue: 0 },
  producao_media: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  eficiencia_media: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 }, // %

  // 4. Material consumível (lista JSON: [{"tipo":"material","nome":""},...])
  materiais_consumiveis: { type: DataTypes.JSON, defaultValue: [] },

  // 5. Manutenção (lista JSON de intervenções e configuração)
  manutencao_tipo: { type: DataTypes.STRING(100) },
  manutencao_periodicidade: { type: DataTypes.STRING(100) },
  ultima_manutencao: { type: DataTypes.DATEONLY },
  proxima_manutencao: { type: DataTypes.DATEONLY },
  manutencoes: { type: DataTypes.JSON, defaultValue: [] },

  // 6. Stock
  estoque_min: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  estoque_max: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  custo_unit: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  margem: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  localizacao: { type: DataTypes.STRING(100) },

  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = Maquina;
