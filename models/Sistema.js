const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Sistema = sequelize.define("sistema", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  idioma: { type: DataTypes.STRING(20), defaultValue: "Português" },
  formato_data: { type: DataTypes.STRING(20), defaultValue: "DD/MM/AAAA" },
  moeda: { type: DataTypes.STRING(20), defaultValue: "Kwanza (AOA)" },
  fuso_horario: { type: DataTypes.STRING(30), defaultValue: "Africa/Luanda (GMT+1)" },
  dias_aviso_ferias: { type: DataTypes.INTEGER, defaultValue: 30 },
  limite_ficheiros: { type: DataTypes.INTEGER, defaultValue: 10 },
  // Limite de dívida permitido por cliente, global para a organização.
  // 0 (por omissão) significa sem bloqueio.
  limite_divida_cliente: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  // Prazo global para dívidas de clientes. Conta a partir da data de emissão
  // da fatura; 30 dias por omissão (o prazo habitual das faturas emitidas).
  prazo_divida_dias: { type: DataTypes.INTEGER, defaultValue: 30 },
  // Juro simples aplicado ao saldo vencido, em percentagem por cada 30 dias
  // de atraso. 0 (por omissão) não acrescenta juro.
  juro_divida_percentual: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  // Desconto por pagamento antecipado: percentagem sobre o saldo e prazo
  // (em dias desde a emissão) dentro do qual o desconto pode ser aplicado.
  desconto_divida_percentual: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  desconto_prazo_dias: { type: DataTypes.INTEGER, defaultValue: 0 },
  // Compras: controlo por alçada — encomendas acima do limiar só podem ser
  // encomendadas (enviadas ao fornecedor) após aprovação.
  compras_exige_aprovacao: { type: DataTypes.BOOLEAN, defaultValue: true },
  compras_alcada_valor: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  compras_alcada_valor_superior: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
});

module.exports = Sistema;
