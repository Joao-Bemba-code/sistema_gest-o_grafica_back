const sequelize = require("../config");
const Organizacao = require("./Organizacao");
const Usuario = require("./Usuario");
const Cliente = require("./Cliente");
const Categoria = require("./Categoria");
const Material = require("./Material");
const MovimentoEstoque = require("./MovimentoEstoque");
const Orcamento = require("./Orcamento");
const OrcamentoItem = require("./OrcamentoItem");
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

Organizacao.hasMany(Usuario, { foreignKey: "organizacao_id" });
Usuario.belongsTo(Organizacao, { foreignKey: "organizacao_id" });

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

module.exports = {
  sequelize,
  Organizacao,
  Usuario,
  Cliente,
  Categoria,
  Fornecedor,
  Material,
  MovimentoEstoque,
  Orcamento,
  OrcamentoItem,
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
};
