const sequelize = require("../config");
const Organizacao = require("./Organizacao");
const Usuario = require("./Usuario");
const LoginLog = require("./LoginLog");
const Cliente = require("./Cliente");
const Categoria = require("./Categoria");
const Material = require("./Material");
const MovimentoEstoque = require("./MovimentoEstoque");
const Orcamento = require("./Orcamento");
const OrcamentoItem = require("./OrcamentoItem");
const OrcamentoMaterial = require("./OrcamentoMaterial");
const OrdemProducao = require("./OrdemProducao");
const PreImpressao = require("./PreImpressao");
const Impressao = require("./Impressao");
const Acabamento = require("./Acabamento");
const Qualidade = require("./Qualidade");
const ReservaEstoque = require("./ReservaEstoque");
const Faturacao = require("./Faturacao");
const Sistema = require("./Sistema");
const Seguranca = require("./Seguranca");
const Fornecedor = require("./Fornecedor");
const Sequencia = require("./Sequencia");
const Pedido = require("./Pedido");
const PedidoItem = require("./PedidoItem");
const OrcamentoServico = require("./OrcamentoServico");
const Servico = require("./Servico");
const Maquina = require("./Maquina");
const Notificacao = require("./Notificacao");
const ContaBancaria = require("./ContaBancaria");
const TesourariaMovimento = require("./TesourariaMovimento");

Organizacao.hasMany(Usuario, { foreignKey: "organizacao_id" });
Usuario.belongsTo(Organizacao, { foreignKey: "organizacao_id" });

Organizacao.hasMany(LoginLog, { foreignKey: "organizacao_id" });
LoginLog.belongsTo(Organizacao, { foreignKey: "organizacao_id" });
Usuario.hasMany(LoginLog, { foreignKey: "usuario_id" });
LoginLog.belongsTo(Usuario, { foreignKey: "usuario_id" });

Organizacao.hasMany(Cliente, { foreignKey: "organizacao_id" });
Cliente.belongsTo(Organizacao, { foreignKey: "organizacao_id" });

Organizacao.hasMany(Categoria, { foreignKey: "organizacao_id" });
Categoria.belongsTo(Organizacao, { foreignKey: "organizacao_id" });

Organizacao.hasMany(Fornecedor, { foreignKey: "organizacao_id" });
Fornecedor.belongsTo(Organizacao, { foreignKey: "organizacao_id" });

Organizacao.hasMany(Material, { foreignKey: "organizacao_id" });
Material.belongsTo(Organizacao, { foreignKey: "organizacao_id" });
  Categoria.hasMany(Material, { foreignKey: "categoria_id", as: "materiais" });
  Material.belongsTo(Categoria, { foreignKey: "categoria_id", as: "categoria" });

Categoria.hasMany(Maquina, { foreignKey: "categoria_id", as: "maquinas" });
  Maquina.belongsTo(Categoria, { foreignKey: "categoria_id", as: "categoria" });

Organizacao.hasMany(MovimentoEstoque, { foreignKey: "organizacao_id" });
MovimentoEstoque.belongsTo(Organizacao, { foreignKey: "organizacao_id" });
Material.hasMany(MovimentoEstoque, { foreignKey: "material_id" });
MovimentoEstoque.belongsTo(Material, { foreignKey: "material_id" });

Organizacao.hasMany(Orcamento, { foreignKey: "organizacao_id" });
Orcamento.belongsTo(Organizacao, { foreignKey: "organizacao_id" });
Cliente.hasMany(Orcamento, { foreignKey: "cliente_id" });
Orcamento.belongsTo(Cliente, { foreignKey: "cliente_id" });
Orcamento.hasMany(OrcamentoItem, { foreignKey: "orcamento_id" });
OrcamentoItem.belongsTo(Orcamento, { foreignKey: "orcamento_id" });
OrcamentoItem.hasMany(OrcamentoMaterial, { foreignKey: "orcamento_item_id", as: "materiais" });
OrcamentoMaterial.belongsTo(OrcamentoItem, { foreignKey: "orcamento_item_id" });
Orcamento.hasMany(OrcamentoServico, { foreignKey: "orcamento_id", as: "servicos" });
OrcamentoServico.belongsTo(Orcamento, { foreignKey: "orcamento_id" });
Material.hasMany(OrcamentoMaterial, { foreignKey: "material_id" });
OrcamentoMaterial.belongsTo(Material, { foreignKey: "material_id" });

Organizacao.hasMany(Servico, { foreignKey: "organizacao_id" });
Servico.belongsTo(Organizacao, { foreignKey: "organizacao_id" });
Categoria.hasMany(Servico, { foreignKey: "categoria_id", as: "servicos" });
Servico.belongsTo(Categoria, { foreignKey: "categoria_id", as: "categoria" });
OrcamentoServico.belongsTo(Servico, { foreignKey: "servico_id", as: "servicoCatalogo" });

Organizacao.hasMany(OrdemProducao, { foreignKey: "organizacao_id" });
OrdemProducao.belongsTo(Organizacao, { foreignKey: "organizacao_id" });
Cliente.hasMany(OrdemProducao, { foreignKey: "cliente_id" });
OrdemProducao.belongsTo(Cliente, { foreignKey: "cliente_id" });
Orcamento.hasMany(OrdemProducao, { foreignKey: "orcamento_id" });
OrdemProducao.belongsTo(Orcamento, { foreignKey: "orcamento_id" });

Organizacao.hasMany(PreImpressao, { foreignKey: "organizacao_id" });
PreImpressao.belongsTo(Organizacao, { foreignKey: "organizacao_id" });
OrdemProducao.hasMany(PreImpressao, { foreignKey: "ordem_producao_id" });
PreImpressao.belongsTo(OrdemProducao, { foreignKey: "ordem_producao_id" });

Organizacao.hasMany(Impressao, { foreignKey: "organizacao_id" });
Impressao.belongsTo(Organizacao, { foreignKey: "organizacao_id" });
OrdemProducao.hasMany(Impressao, { foreignKey: "ordem_producao_id" });
Impressao.belongsTo(OrdemProducao, { foreignKey: "ordem_producao_id" });

Organizacao.hasMany(Acabamento, { foreignKey: "organizacao_id" });
Acabamento.belongsTo(Organizacao, { foreignKey: "organizacao_id" });
OrdemProducao.hasMany(Acabamento, { foreignKey: "ordem_producao_id" });
Acabamento.belongsTo(OrdemProducao, { foreignKey: "ordem_producao_id" });

Organizacao.hasMany(Qualidade, { foreignKey: "organizacao_id" });
Qualidade.belongsTo(Organizacao, { foreignKey: "organizacao_id" });
OrdemProducao.hasMany(Qualidade, { foreignKey: "ordem_producao_id" });
Qualidade.belongsTo(OrdemProducao, { foreignKey: "ordem_producao_id" });

Organizacao.hasMany(ReservaEstoque, { foreignKey: "organizacao_id" });
ReservaEstoque.belongsTo(Organizacao, { foreignKey: "organizacao_id" });
OrdemProducao.hasMany(ReservaEstoque, { foreignKey: "ordem_producao_id" });
ReservaEstoque.belongsTo(OrdemProducao, { foreignKey: "ordem_producao_id" });
Material.hasMany(ReservaEstoque, { foreignKey: "material_id" });
ReservaEstoque.belongsTo(Material, { foreignKey: "material_id" });

Organizacao.hasMany(Faturacao, { foreignKey: "organizacao_id" });
Faturacao.belongsTo(Organizacao, { foreignKey: "organizacao_id" });
Orcamento.hasMany(Faturacao, { foreignKey: "orcamento_id" });
Faturacao.belongsTo(Orcamento, { foreignKey: "orcamento_id" });
Cliente.hasMany(Faturacao, { foreignKey: "cliente_id" });
Faturacao.belongsTo(Cliente, { foreignKey: "cliente_id" });
OrdemProducao.hasMany(Faturacao, { foreignKey: "ordem_producao_id" });
Faturacao.belongsTo(OrdemProducao, { foreignKey: "ordem_producao_id" });

Organizacao.hasOne(Sistema, { foreignKey: "organizacao_id" });
Sistema.belongsTo(Organizacao, { foreignKey: "organizacao_id" });

Organizacao.hasOne(Seguranca, { foreignKey: "organizacao_id" });
Seguranca.belongsTo(Organizacao, { foreignKey: "organizacao_id" });

Organizacao.hasOne(Sequencia, { foreignKey: "organizacao_id" });
Sequencia.belongsTo(Organizacao, { foreignKey: "organizacao_id" });

Organizacao.hasMany(Pedido, { foreignKey: "organizacao_id" });
Pedido.belongsTo(Organizacao, { foreignKey: "organizacao_id" });
Pedido.hasMany(PedidoItem, { foreignKey: "pedido_id" });
PedidoItem.belongsTo(Pedido, { foreignKey: "pedido_id" });
Material.hasMany(PedidoItem, { foreignKey: "material_id" });
PedidoItem.belongsTo(Material, { foreignKey: "material_id" });

Organizacao.hasMany(Notificacao, { foreignKey: "organizacao_id" });
Notificacao.belongsTo(Organizacao, { foreignKey: "organizacao_id" });

Organizacao.hasMany(ContaBancaria, { foreignKey: "organizacao_id" });
ContaBancaria.belongsTo(Organizacao, { foreignKey: "organizacao_id" });

Organizacao.hasMany(TesourariaMovimento, { foreignKey: "organizacao_id" });
TesourariaMovimento.belongsTo(Organizacao, { foreignKey: "organizacao_id" });
ContaBancaria.hasMany(TesourariaMovimento, { foreignKey: "conta_bancaria_id", as: "movimentos" });
TesourariaMovimento.belongsTo(ContaBancaria, { foreignKey: "conta_bancaria_id", as: "conta" });
Cliente.hasMany(TesourariaMovimento, { foreignKey: "cliente_id" });
TesourariaMovimento.belongsTo(Cliente, { foreignKey: "cliente_id", as: "cliente" });
Faturacao.hasMany(TesourariaMovimento, { foreignKey: "fatura_id" });
TesourariaMovimento.belongsTo(Faturacao, { foreignKey: "fatura_id", as: "fatura" });
TesourariaMovimento.belongsTo(ContaBancaria, { foreignKey: "conta_destino_id", as: "contaDestino" });
Usuario.hasMany(TesourariaMovimento, { foreignKey: "usuario_id" });
TesourariaMovimento.belongsTo(Usuario, { foreignKey: "usuario_id", as: "usuario" });
Usuario.hasMany(TesourariaMovimento, { foreignKey: "aprovado_por", as: "aprovacoes" });
TesourariaMovimento.belongsTo(Usuario, { foreignKey: "aprovado_por", as: "aprovador" });

module.exports = {
  sequelize,
  Organizacao,
  Usuario,
  LoginLog,
  Cliente,
  Categoria,
  Fornecedor,
  Material,
  MovimentoEstoque,
  Orcamento,
  OrcamentoItem,
  OrcamentoMaterial,
  OrcamentoServico,
  Servico,
  OrdemProducao,
  PreImpressao,
  Impressao,
  Acabamento,
  Qualidade,
  ReservaEstoque,
  Faturacao,
  Sistema,
  Seguranca,
  Sequencia,
  Pedido,
  PedidoItem,
  Maquina,
  Notificacao,
  ContaBancaria,
  TesourariaMovimento,
};
