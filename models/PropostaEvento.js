const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Histórico do ciclo da proposta: cada mudança de estado fica registada com
// data e utilizador, para se saber o que aconteceu e quando.
const PropostaEvento = sequelize.define("proposta_evento", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  proposta_id: { type: DataTypes.INTEGER, allowNull: false },
  estado: { type: DataTypes.STRING(20), allowNull: false },
  observacao: { type: DataTypes.TEXT },
  usuario_id: { type: DataTypes.INTEGER },
});

module.exports = PropostaEvento;
