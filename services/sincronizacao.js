const { DataTypes, Op } = require("sequelize");
const sequelize = require("../config");
const modelosReais = require("../models");
const { Organizacao } = modelosReais;

// Tabelas sincronizaveis no servidor (MySQL) e respetivas colunas de negocio.
// Convencao partilhada com o local:
//   - id = UUID (texto) -> sem colisoes entre computadores offline
//   - updated_at = timestamp -> usado no Last-Write-Wins
//   - Nao existe is_dirty no servidor: esse sinal so existe no SQLite local.
const COLUNAS = {
  clientes: ["nome", "nif", "telefone", "email"],
};

// A organização é um registo único por org (não tem UUID): sincroniza-se na
// tabela real (Organizacao) com Last-Write-Wins pelo updatedAt.
const COLUNAS_ORG = [
  "nome",
  "sigla",
  "nif",
  "email",
  "telefone",
  "endereco",
  "website",
  "template_contrato",
  "logo_url",
];

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

// Upsert da organização (registo único) na tabela real, com LWW.
// O updatedAt guardado é o timestamp recebido (não a hora do servidor),
// para que dois computadores decidam sempre pelo mesmo critério.
async function sincronizarOrganizacao(orgId, dados) {
  const org = await Organizacao.findByPk(orgId);
  if (!org) throw new Error("Organização não encontrada");
  const novoT = Date.parse((dados && (dados.updated_at || dados.updatedAt)) || "") || 0;
  const atualT = Date.parse(org.updatedAt) || 0;
  if (novoT && novoT <= atualT) return { ok: true, atualizado: false, updated_at: org.updatedAt };
  const campos = {};
  for (const c of COLUNAS_ORG) {
    if (dados && dados[c] !== undefined && dados[c] !== null) campos[c] = String(dados[c]);
  }
  if (novoT) campos.updatedAt = new Date(novoT);
  let atualizado = false;
  if (Object.keys(campos).length) {
    // Sequelize ignora updatedAt em update() e mete a hora atual: guardamos
    // via SQL direto para o LWW ser determinístico entre computadores.
    const sets = Object.keys(campos)
      .map((c) => `\`${c}\` = ?`)
      .join(", ");
    await sequelize.query(`UPDATE \`organizacao\` SET ${sets} WHERE id = ?`, {
      replacements: [...Object.values(campos), orgId],
    });
    atualizado = true;
  }
  return { ok: true, atualizado, updated_at: novoT ? new Date(novoT) : org.updatedAt };
}

async function organizacaoAtual(orgId) {
  const org = await Organizacao.findByPk(orgId);
  if (!org) throw new Error("Organização não encontrada");
  return { ...org.toJSON(), updated_at: org.updatedAt };
}

// ---------------------------------------------------------------------------
// Sincronização das TABELAS REAIS por ID numérico + Last-Write-Wins.
// Cada computador usa uma faixa de IDs própria (seed local), por isso os
// novos registos não colidem entre PCs nem com os IDs existentes na nuvem.
// As tabelas reais usam organizacao_id (não org_id) e não têm is_dirty.
// ---------------------------------------------------------------------------
const TABELAS_SINC = {
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  categoria: "Categoria",
  material: "Material",
  movimento_estoque: "MovimentoEstoque",
  orcamento: "Orcamento",
  orcamento_item: "OrcamentoItem",
  orcamento_material: "OrcamentoMaterial",
  ordem_producao: "OrdemProducao",
  pre_impressao: "PreImpressao",
  impressao: "Impressao",
  acabamento: "Acabamento",
  qualidade: "Qualidade",
  reserva_estoque: "ReservaEstoque",
  faturacao: "Faturacao",
  pedido: "Pedido",
  pedido_item: "PedidoItem",
};

function colunasReais(Model) {
  return Object.keys(Model.rawAttributes).filter(
    (a) => !["id", "createdAt", "updatedAt", "is_dirty"].includes(a)
  );
}

async function upsertReal(tabela, orgId, registos) {
  const Model = modelosReais[TABELAS_SINC[tabela]];
  if (!Model) throw new Error("Tabela não suportada: " + tabela);
  const colunas = colunasReais(Model);
  const temOrg = colunas.includes("organizacao_id");
  const cols = ["id", ...colunas, "updatedAt"];
  let n = 0;
  for (const reg of registos || []) {
    if (!reg || reg.id == null) continue;
    const novoT = Date.parse(reg.updated_at || reg.updatedAt) || 0;
    const valores = {};
    for (const c of colunas) {
      if (reg[c] !== undefined && reg[c] !== null) valores[c] = reg[c];
    }
    if (temOrg && reg.organizacao_id != null) valores.organizacao_id = reg.organizacao_id;
    if (temOrg && reg.organizacao_id == null && orgId != null) valores.organizacao_id = orgId;
    valores.updatedAt = new Date(novoT || Date.now());

    const atual = await Model.findByPk(reg.id, { raw: true });
    if (!atual) {
      valores.id = reg.id;
      valores.createdAt = reg.createdAt ? new Date(Date.parse(reg.createdAt) || Date.now()) : new Date();
      const chaves = Object.keys(valores);
      await sequelize.query(
        `INSERT INTO \`${Model.tableName}\` (\`${chaves.join("`, `")}\`) VALUES (${chaves.map(() => "?").join(", ")})`,
        { replacements: chaves.map((k) => valores[k]) }
      );
      n++;
    } else {
      const atualT = Date.parse(atual.updatedAt) || 0;
      if (!novoT || novoT <= atualT) continue;
      const sets = [];
      const params = [];
      for (const c of colunas) {
        if (valores[c] !== undefined) {
          sets.push(`\`${c}\` = ?`);
          params.push(valores[c]);
        }
      }
      sets.push("`updatedAt` = ?");
      params.push(valores.updatedAt);
      params.push(reg.id);
      await sequelize.query(
        `UPDATE \`${Model.tableName}\` SET ${sets.join(", ")} WHERE id = ?`,
        { replacements: params }
      );
      n++;
    }
  }
  return n;
}

async function alteracoesReal(tabela, orgId, since) {
  const Model = modelosReais[TABELAS_SINC[tabela]];
  if (!Model) throw new Error("Tabela não suportada: " + tabela);
  const temOrg = colunasReais(Model).includes("organizacao_id");
  const desde = new Date(since || "1970-01-01T00:00:00.000Z");
  let sql = `SELECT * FROM \`${Model.tableName}\``;
  const params = [];
  const onde = [];
  if (temOrg) {
    onde.push("`organizacao_id` = ?");
    params.push(orgId);
  }
  onde.push("`updatedAt` > ?");
  params.push(desde);
  sql += " WHERE " + onde.join(" AND ") + " ORDER BY `updatedAt` ASC";
  const [linhas] = await sequelize.query(sql, { replacements: params });
  return linhas;
}

module.exports = {
  upsert,
  alteracoes,
  inicializarSincronizacao,
  COLUNAS,
  COLUNAS_ORG,
  sincronizarOrganizacao,
  organizacaoAtual,
  upsertReal,
  alteracoesReal,
  TABELAS_SINC,
};
