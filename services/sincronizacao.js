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
  orcamento_servico: "OrcamentoServico",
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

// Tabelas filhas não têm organizacao_id. O acesso é validado pelo pai, para
// que um id de outra empresa nunca possa ser lido nem escrito pela sincronização.
const TABELAS_FILHAS = {
  orcamento_item: { tipo: "orcamento", fk: "orcamento_id" },
  orcamento_servico: { tipo: "orcamento", fk: "orcamento_id" },
  orcamento_material: { tipo: "orcamento_item", fk: "orcamento_item_id" },
  pedido_item: { tipo: "pedido", fk: "pedido_id" },
};

async function paiPertenceAOrganizacao(tabela, registo, orgId, usarIdDoRegisto = false) {
  const cfg = TABELAS_FILHAS[tabela];
  if (!cfg) return true;
  if (!registo) return false;
  if (tabela === "orcamento_material") {
    // No insert o material ainda não existe: validamos o orçamento_item pai.
    // No update validamos o material existente (pelo seu id).
    const sql = usarIdDoRegisto
      ? `SELECT 1 FROM orcamento_material m
           JOIN orcamento_item oi ON oi.id = m.orcamento_item_id
           JOIN orcamento o ON o.id = oi.orcamento_id
          WHERE m.id = ? AND o.organizacao_id = ? LIMIT 1`
      : `SELECT 1 FROM orcamento_item oi
           JOIN orcamento o ON o.id = oi.orcamento_id
          WHERE oi.id = ? AND o.organizacao_id = ? LIMIT 1`;
    const valor = usarIdDoRegisto ? registo.id : registo.orcamento_item_id;
    if (valor == null) return false;
    const [linhas] = await sequelize.query(sql, { replacements: [valor, orgId] });
    return linhas.length > 0;
  }
  if (registo[cfg.fk] == null) return false;
  const [linhas] = await sequelize.query(
    `SELECT 1 FROM \`${cfg.tipo}\` p WHERE p.id = ? AND p.organizacao_id = ? LIMIT 1`,
    { replacements: [registo[cfg.fk], orgId] }
  );
  return linhas.length > 0;
}

function colunasReais(Model) {
  return Object.keys(Model.rawAttributes).filter(
    (a) => !["id", "createdAt", "updatedAt", "is_dirty"].includes(a)
  );
}

function normalizarDate(val) {
  if (val === undefined || val === null) return null;
  if (val instanceof Date) return val;
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d)) return d;
  }
  return val;
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
      const v = normalizarDate(reg[c]);
      if (v !== undefined && v !== null) valores[c] = v;
    }
    if (temOrg) valores.organizacao_id = orgId;
    valores.updatedAt = new Date(novoT || Date.now());

    // O registo recebido tem de pertencer à empresa autenticada. Nas tabelas
    // filhas a verificação é feita pelo orçamento/pedido pai.
    if (!(await paiPertenceAOrganizacao(tabela, reg, orgId))) continue;

    // Sempre com filtro de organização. Um findByPk simples permite que a
    // empresa A atualize (e transfira para si) um registo da empresa B.
    const atual = temOrg
      ? await Model.unscoped().findOne({
          where: { id: reg.id, organizacao_id: orgId },
          raw: true,
        })
      : await Model.unscoped().findByPk(reg.id, { raw: true });

    if (!atual) {
      // Um id já existente noutra empresa nunca pode ser reutilizado.
      if (temOrg) {
        const colisao = await Model.unscoped().findByPk(reg.id, {
          attributes: ["id"],
          raw: true,
        });
        if (colisao) continue;
      }
      valores.id = reg.id;
      valores.createdAt = reg.createdAt ? new Date(Date.parse(reg.createdAt)) : new Date();
      const chaves = Object.keys(valores);
      await sequelize.query(
        `INSERT INTO \`${Model.tableName}\` (\`${chaves.join("`, `")}\`) VALUES (${chaves.map(() => "?").join(", ")})`,
        { replacements: chaves.map((k) => valores[k]) }
      );
      n++;
    } else {
      // O registo existente também tem de ter o pai na mesma empresa.
      if (!(await paiPertenceAOrganizacao(tabela, atual, orgId, true))) continue;
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
      let where = "id = ?";
      if (temOrg) {
        where += " AND `organizacao_id` = ?";
        params.push(orgId);
      }
      await sequelize.query(
        `UPDATE \`${Model.tableName}\` SET ${sets.join(", ")} WHERE ${where}`,
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

  // Tabelas filhas: só devolve linhas cujo pai pertence à organização.
  if (!temOrg && TABELAS_FILHAS[tabela]) {
    let sql;
    if (tabela === "orcamento_material") {
      sql = `SELECT m.* FROM orcamento_material m
               JOIN orcamento_item oi ON oi.id = m.orcamento_item_id
               JOIN orcamento o ON o.id = oi.orcamento_id
              WHERE o.organizacao_id = ? AND m.updatedAt > ?
              ORDER BY m.updatedAt ASC`;
    } else {
      const cfg = TABELAS_FILHAS[tabela];
      sql = `SELECT f.* FROM \`${Model.tableName}\` f
               JOIN \`${cfg.tipo}\` p ON p.id = f.\`${cfg.fk}\`
              WHERE p.organizacao_id = ? AND f.updatedAt > ?
              ORDER BY f.updatedAt ASC`;
    }
    const [filhas] = await sequelize.query(sql, { replacements: [orgId, desde] });
    return filhas;
  }

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
