/* ============================================================
   Exporta TODOS os dados da base atual (MySQL/MariaDB ou SQLite)
   para um ficheiro SQLite unico e portatil.
   Usado pelo CLI exportar_sqlite.js e pelo backup ZIP.
   ============================================================ */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const sequelize = require("../config");

const ORDEM = [
  "Organizacao", "Usuario", "Sistema", "Seguranca", "Sequencia",
  "Categoria", "Fornecedor", "Cliente", "Material", "MovimentoEstoque",
  "Orcamento", "OrcamentoItem", "OrcamentoMaterial", "OrcamentoServico", "OrdemProducao",
  "PreImpressao", "Impressao", "Acabamento", "Qualidade", "ReservaEstoque",
  "Faturacao", "Pedido", "PedidoItem",
];

function carimbo(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function nomeTabela(modelo) {
  const tn = modelo.getTableName();
  return typeof tn === "string" ? tn : tn.tableName;
}

function prepararValor(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace("T", " ");
  if (Buffer.isBuffer(v)) return v;
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

async function lerDadosRelacionais(log = () => {}) {
  const modelos = require("../models");
  const tabelas = {};
  const colunasPorTabela = {};
  let total = 0;
  for (const nome of ORDEM) {
    const tabela = nomeTabela(modelos[nome]);
    const [linhas] = await sequelize.query(`SELECT * FROM \`${tabela}\``);
    tabelas[tabela] = linhas.map((linha) => {
      const limpa = {};
      for (const [k, v] of Object.entries(linha)) limpa[k] = prepararValor(v);
      return limpa;
    });
    total += linhas.length;
    log(`  ${tabela}: ${linhas.length}`);
    try {
      const [cols] = await sequelize.query(
        `SELECT COLUMN_NAME AS nome, DATA_TYPE AS tipo
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t`,
        { replacements: { t: tabela } }
      );
      colunasPorTabela[tabela] = cols.map((c) => ({ nome: c.nome, tipo: c.tipo }));
    } catch {
      colunasPorTabela[tabela] = [];
    }
  }
  return { tabelas, colunasPorTabela, total };
}

async function exportarSqlite(destinoArg, opcoes = {}) {
  const log = opcoes.log || (() => {});
  const destinoPadrao = path.join(__dirname, "..", "..", "backups", `sgg_sqlite_${carimbo()}.sqlite`);
  const destino = path.resolve(destinoArg || destinoPadrao);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  for (const velho of [destino, destino + "-wal", destino + "-shm"]) {
    if (fs.existsSync(velho)) fs.unlinkSync(velho);
  }

  if ((process.env.Lang || "").toLowerCase() === "sqlite") {
    log("A copiar base SQLite (VACUUM INTO)...");
    await sequelize.query("VACUUM INTO ?", { replacements: [destino.replace(/\\/g, "/")] });
    await sequelize.close();
    const kb = Math.max(1, Math.round(fs.statSync(destino).size / 1024));
    return { destino, kb };
  }

  log("A ler dados da base atual...");
  const { tabelas, colunasPorTabela, total } = await lerDadosRelacionais(log);
  await sequelize.close();

  if (total === 0) throw new Error("A base esta vazia — nada a exportar.");

  const jsonTmp = path.join(os.tmpdir(), `sgg_export_${Date.now()}.json`);
  fs.writeFileSync(jsonTmp, JSON.stringify({ tabelas, colunas: colunasPorTabela }));

  log(`Total: ${total} registos. A criar base SQLite...`);
  const carregar = path.join(__dirname, "..", "sqlite_carregar.js");
  const envFilho = { ...process.env, Lang: "sqlite", Sqlite_File: destino };
  execFileSync(process.execPath, [carregar, jsonTmp], { env: envFilho, stdio: opcoes.herdarStdio ? "inherit" : "pipe" });
  fs.unlinkSync(jsonTmp);

  const kb = Math.max(1, Math.round(fs.statSync(destino).size / 1024));
  return { destino, total, kb };
}

module.exports = { exportarSqlite, carimbo, ORDEM };
