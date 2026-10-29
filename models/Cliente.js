const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Cliente = sequelize.define("cliente", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  codigo: { type: DataTypes.STRING(30) },
  tipo: { type: DataTypes.ENUM("cliente", "fornecedor"), defaultValue: "cliente" },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  empresa: { type: DataTypes.STRING(200) },
  nif: { type: DataTypes.STRING(20) },
  telefone: { type: DataTypes.STRING(20) },
  whatsapp: { type: DataTypes.STRING(20) },
  email: { type: DataTypes.STRING(100) },
  endereco: { type: DataTypes.TEXT },
  // Ficha de registro de clientes (COM-CLI-01): identidade & unidade de negócio.
  tipo_cliente: { type: DataTypes.STRING(50) },
  nome_comercial: { type: DataTypes.STRING(200) },
  segmento: { type: DataTypes.STRING(100) },
  unidade_negocio: { type: DataTypes.STRING(100) },
  unidades_secundarias: { type: DataTypes.JSON },
  // Contactos principais & endereço.
  pais: { type: DataTypes.STRING(100) },
  provincia: { type: DataTypes.STRING(100) },
  municipio: { type: DataTypes.STRING(100) },
  bairro: { type: DataTypes.STRING(100) },
  rua: { type: DataTypes.STRING(200) },
  numero_porta: { type: DataTypes.STRING(20) },
  // Classificação comercial.
  categoria: { type: DataTypes.STRING(100) },
  setor_atividade: { type: DataTypes.STRING(100) },
  fonte_origem: { type: DataTypes.STRING(100) },
  referencia_interna: { type: DataTypes.STRING(200) },
  // Responsável comercial interno pelo cliente.
  responsavel_comercial: { type: DataTypes.STRING(150) },
  // Pessoa de contacto do cliente (responsável directo pelos assuntos).
  pessoa_contacto: { type: DataTypes.STRING(150) },
  pessoa_funcao: { type: DataTypes.STRING(100) },
  pessoa_telefone: { type: DataTypes.STRING(30) },
  pessoa_email: { type: DataTypes.STRING(150) },
  data_cadastro: { type: DataTypes.DATEONLY },
  observacoes: { type: DataTypes.TEXT },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
  anulado: { type: DataTypes.BOOLEAN, defaultValue: false },
  motivo_anulacao: { type: DataTypes.TEXT },
  anulado_por: { type: DataTypes.STRING(200) },
  data_anulacao: { type: DataTypes.DATE, allowNull: true },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = Cliente;
