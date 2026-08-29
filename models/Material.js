const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Material = sequelize.define("material", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  categoria_id: { type: DataTypes.INTEGER },
  codigo: { type: DataTypes.STRING(50) },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  nome_tecnico: { type: DataTypes.STRING(200) },
  fornecedor: { type: DataTypes.STRING(200) },
  descricao: { type: DataTypes.TEXT },
  especificidade: { type: DataTypes.TEXT },
  condicao_armazenagem: { type: DataTypes.TEXT },
  localizacao: { type: DataTypes.STRING(100) },
  unidade: { type: DataTypes.STRING(20), defaultValue: "un" },
  formato: { type: DataTypes.STRING(100) },
  gramagem: { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
  largura: { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
  altura: { type: DataTypes.DECIMAL(8, 2), defaultValue: 0 },
  tipo_estoque: {
    type: DataTypes.ENUM("folha", "metro", "peso", "volume", "unidade"),
    defaultValue: "unidade",
  },
  controla_lote: { type: DataTypes.BOOLEAN, defaultValue: false },
  percentual_quebra: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  mover_estoque: { type: DataTypes.BOOLEAN, defaultValue: true },
  especificacoes: { type: DataTypes.JSON, defaultValue: {} },
  quantidade: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  estoque_reservado: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  estoque_min: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  estoque_max: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  ponto_ressuprimento: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  custo_unit: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  margem: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  lucro: { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = Material;
