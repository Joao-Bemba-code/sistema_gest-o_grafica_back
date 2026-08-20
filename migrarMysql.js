async function aplicarMigracoesMysql(sequelize) {
  const adicionar = async (tabela, coluna, definicao) => {
    const existentes = await sequelize.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tabela}'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    if (!existentes.some((c) => c.COLUMN_NAME === coluna)) {
      await sequelize.query(
        `ALTER TABLE \`${tabela}\` ADD COLUMN \`${coluna}\` ${definicao}`
      );
      console.log(`MIGRAÇÃO: ${tabela}.${coluna} adicionada`);
    }
  };

  await adicionar("categoria", "familia", "VARCHAR(100) NULL");
  await adicionar("categoria", "subfamilia", "VARCHAR(100) NULL");
  await adicionar("categoria", "tipo", "VARCHAR(100) NULL");
  await adicionar("categoria", "campos_especificacao", "JSON NULL");
  await adicionar("material", "especificacoes", "JSON NULL");
  await adicionar("material", "localizacao", "VARCHAR(100) NULL");
  await adicionar("orcamento", "especificacao_json", "JSON NULL");
  await adicionar("orcamento_item", "composto", "TINYINT(1) NOT NULL DEFAULT 0");
  await adicionar("orcamento_item", "margem", "DECIMAL(12,2) NOT NULL DEFAULT 0");

  // Tombstones (soft-delete) para a sincronização de eliminações entre
  // computadores: as tabelas reais sincronizáveis ganham deleted/deletedAt.
  const tabelasTomb = [
    "cliente",
    "fornecedor",
    "categoria",
    "material",
    "movimento_estoque",
    "orcamento",
    "orcamento_item",
    "orcamento_material",
    "ordem_producao",
    "pre_impressao",
    "impressao",
    "acabamento",
    "qualidade",
    "reserva_estoque",
    "faturacao",
    "pedido",
    "pedido_item",
  ];
  for (const t of tabelasTomb) {
    await adicionar(t, "deleted", "TINYINT(1) NOT NULL DEFAULT 0");
    await adicionar(t, "deletedAt", "DATETIME NULL");
  }

  const refs = await sequelize.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'movimento_estoque' AND COLUMN_NAME = 'referencia_tipo'`,
    { type: sequelize.QueryTypes.SELECT }
  );
  if (refs.length && !refs[0].COLUMN_TYPE.includes("pedido")) {
    await sequelize.query(
      `ALTER TABLE \`movimento_estoque\` MODIFY \`referencia_tipo\`
       ENUM('manual','op','ajuste','nf_e','reserva','devolucao','pedido') NOT NULL DEFAULT 'manual'`
    );
    console.log("MIGRAÇÃO: movimento_estoque.referencia_tipo inclui 'pedido'");
  }
}

module.exports = { aplicarMigracoesMysql };
