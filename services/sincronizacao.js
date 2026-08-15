const { DataTypes, Op } = require("sequelize");
const sequelize = require("../config");

// Tabelas sincronizaveis no servidor (MySQL) e respetivas colunas de negocio.
// Convencao partilhada com o local:
//   - id = UUID (texto) -> sem colisoes entre computadores offline
//   - updated_at = timestamp -> usado no Last-Write-Wins
//   - Nao existe is_dirty no servidor: esse sinal so existe no SQLite local.
const COLUNAS = {
  clientes: ["nome", "nif", "telefone", "email"],
};

const modelos = {};
for (const [nome, cols] of Object.entries(COLUNAS)) {
  const atributos = {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    org_id: { type: DataTypes.INTEGER, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  };
  for (const c of cols) {
    atributos[c] = { type: DataTypes.STRING, allowNull: true };
  }
  modelos[nome] = sequelize.define(nome, atributos, {
    tableName: nome,
    freezeTableName: true,
    timestamps: false,
  });
}

function dadosDoRegisto(tabela, reg, orgId, incluirId = false) {
  const dados = {
    org_id: orgId,
    updated_at: new Date(Date.parse(reg.updated_at) || Date.now()),
  };
  for (const c of COLUNAS[tabela]) {
    dados[c] = reg[c] != null ? String(reg[c]) : null;
  }
  if (incluirId) dados.id = reg.id;
  return dados;
}

async function upsert(tabela, orgId, registos) {
  const Model = modelos[tabela];
  if (!Model) throw new Error("Tabela não suportada: " + tabela);
  let n = 0;
  for (const reg of registos || []) {
    if (!reg || reg.id == null) continue;
    const novoT = Date.parse(reg.updated_at) || 0;
    const existe = await Model.findOne({ where: { id: reg.id, org_id: orgId } });
    if (!existe) {
      await Model.create({ id: reg.id, ...dadosDoRegisto(tabela, reg, orgId) });
      n++;
    } else if (novoT >= Date.parse(existe.updated_at) || 0) {
      await existe.update(dadosDoRegisto(tabela, reg, orgId, true));
      n++;
    }
  }
  return n;
}

async function alteracoes(tabela, orgId, since) {
  const Model = modelos[tabela];
  if (!Model) throw new Error("Tabela não suportada: " + tabela);
  const registos = await Model.findAll({
    where: {
      org_id: orgId,
      updated_at: { [Op.gt]: new Date(since || "1970-01-01T00:00:00.000Z") },
    },
    order: [["updated_at", "ASC"]],
    raw: true,
  });
  return registos;
}

async function inicializarSincronizacao() {
  for (const Model of Object.values(modelos)) {
    await Model.sync();
  }
}

module.exports = { upsert, alteracoes, inicializarSincronizacao, COLUNAS };
