// Recodificação idempotente: todos os códigos/referências do sistema passam a
// começar com a letra K (ex.: CLI-0001 -> KCLI-0001, ORC-0001 -> KORC-0001).
// Só muda valores fora da regra; conformes ficam intactos. Corre no arranque
// do backend (migrarMysql.js) e pode correr manualmente: node scripts/recodificar_k.js

const RENUMERACOES = [
  { tabela: "cliente", coluna: "codigo", prefixos: ["CLI-", "FOR-"] },
  { tabela: "proposta", coluna: "numero", prefixos: ["PROP-"] },
  { tabela: "orcamento", coluna: "numero", prefixos: ["ORC-"] },
  { tabela: "faturacao", coluna: "numero", prefixos: ["FAT-", "REC-", "PRF-", "FR-", "NC-"] },
  { tabela: "pedido", coluna: "numero", prefixos: ["PED-"] },
  { tabela: "ordem_producao", coluna: "numero", prefixos: ["OP-"] },
  { tabela: "requisicao_material", coluna: "numero", prefixos: ["REQ-"] },
];

async function recodificarCodigosK(sequelize) {
  const existentes = await sequelize.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()",
    { type: sequelize.QueryTypes.SELECT }
  );
  const nomes = new Set(existentes.map((t) => Object.values(t)[0]));
  let alterados = 0;

  for (const { tabela, coluna, prefixos } of RENUMERACOES) {
    if (!nomes.has(tabela)) continue;
    for (const p of prefixos) {
      // LEFT JOIN garante que nunca se gera um código que já existe.
      const [resultado] = await sequelize.query(
        `UPDATE \`${tabela}\` c
         LEFT JOIN \`${tabela}\` k
           ON k.\`${coluna}\` = CONCAT('K', c.\`${coluna}\`)
          AND k.organizacao_id = c.organizacao_id
         SET c.\`${coluna}\` = CONCAT('K', c.\`${coluna}\`)
         WHERE c.\`${coluna}\` LIKE '${p}%' AND k.id IS NULL`
      );
      const n = Number(resultado?.affectedRows || 0);
      if (n) {
        alterados += n;
        console.log(`MIGRAÇÃO K: ${tabela}.${coluna} (${p}%) — ${n} registo(s) recodificado(s)`);
      }
    }
  }
  if (!alterados) console.log("MIGRAÇÃO K: todos os códigos já começam com K");
  return alterados;
}

module.exports = { recodificarCodigosK, RENUMERACOES };
