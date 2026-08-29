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
  await adicionar("categoria", "validade_dias", "INT NULL");
  await adicionar("categoria", "data_validade", "DATE NULL");
  await adicionar("material", "especificacoes", "JSON NULL");
  await adicionar("material", "localizacao", "VARCHAR(100) NULL");
  await adicionar("material", "lucro", "DECIMAL(5,2) NULL DEFAULT 0");
  await adicionar("material", "mover_estoque", "TINYINT(1) NOT NULL DEFAULT 1");

  // Histórico de mudanças de estado das máquinas (JSON: [{estado,data,motivo}])
  await adicionar("maquina", "historico_estados", "JSON NULL");

  // Equipamentos por defeito não movimentam estoque (permanecem como registo/máquina).
  await sequelize.query(
    `UPDATE material m
     JOIN categoria c ON c.id = m.categoria_id
     SET m.mover_estoque = 0
     WHERE c.familia = 'equipamentos' OR c.tipo = 'equipamentos'`
  );
  console.log("MIGRAÇÃO: equipamentos passaram a não mover estoque");
  await adicionar("orcamento", "desconto", "DECIMAL(12,2) NULL DEFAULT 0");
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
    "orcamento_servico",
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

  await adicionar("orcamento_servico", "servico_id", "INT NULL");

  // Cobrança proporcional de folha por encaixe no orçamento (ex.: usar A7 numa A4).
  await adicionar("orcamento_material", "usar_parcial", "TINYINT(1) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "formato_final", "VARCHAR(50) NULL");
  await adicionar("orcamento_material", "largura_final", "DECIMAL(8,2) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "altura_final", "DECIMAL(8,2) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "pecas_por_folha", "INT NOT NULL DEFAULT 1");
  await adicionar("orcamento_material", "preco_folha", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "formato", "VARCHAR(50) NULL");
  await adicionar("orcamento_material", "largura_mm", "DECIMAL(8,2) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "altura_mm", "DECIMAL(8,2) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "quantidade_folhas", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "tipo_material", "VARCHAR(20) NOT NULL DEFAULT 'material'");

  // Impressão / toner: nº de folhas a imprimir e o material de toner usado.
  await adicionar("orcamento_item", "folhas_impressao", "INT NOT NULL DEFAULT 0");
  await adicionar("orcamento_item", "toner_material_id", "INT NULL");
  await adicionar("orcamento_item", "toner_custo_unit", "DECIMAL(8,4) NOT NULL DEFAULT 0");

  const catFamRef = await sequelize.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categoria' AND COLUMN_NAME = 'familia'`,
    { type: sequelize.QueryTypes.SELECT }
  );
  if (catFamRef.length && !catFamRef[0].COLUMN_TYPE.includes("impressao")) {
    await sequelize.query(
      `UPDATE categoria SET familia = 'papeis' WHERE familia IS NULL OR familia = ''`
    );
    try {
      await sequelize.query(`SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'`);
      await sequelize.query(
        `ALTER TABLE \`categoria\` MODIFY \`familia\`
         ENUM('papeis','tintas','chapas','produto_quimico','equipamentos','ferramentas','suporte_especial','material_acabamento','consumiveis','impressao','acabamento','pre_impressao','design','montagem','logistica','consultoria','manutencao','servicos_gerais') NOT NULL DEFAULT 'papeis'`
      );
      console.log("MIGRAÇÃO: categoria.familia inclui famílias de serviços");
    } catch (e) {
      if (e.code === "WARN_DATA_TRUNCATED" || e.parent?.code === "WARN_DATA_TRUNCATED") {
        console.log("MIGRAÇÃO: categoria.familia actualizado (warnings ignorados)");
      } else {
        throw e;
      }
    }
  }

  // Campo Família do Novo Recurso passou a ser editável (permite criar novas
  // famílias em texto livre). Deixa de ser ENUM de valores fixos para aceitar
  // qualquer família nova escrita pelo utilizador em produção.
  const catFamEnum = await sequelize.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categoria' AND COLUMN_NAME = 'familia'",
    { type: sequelize.QueryTypes.SELECT }
  );
  if (catFamEnum.length) {
    console.log("MIGRAÇÃO: categoria.familia é actualmente:", catFamEnum[0].COLUMN_TYPE);
  }
  if (catFamEnum.length && catFamEnum[0].COLUMN_TYPE.includes("ENUM")) {
    try {
      await sequelize.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
      await sequelize.query("ALTER TABLE `categoria` MODIFY `familia` VARCHAR(50) NOT NULL DEFAULT 'papeis'");
      console.log("MIGRAÇÃO: categoria.familia alterado de ENUM para VARCHAR(50)");
    } catch (e) {
      console.error("MIGRAÇÃO: erro ao alterar categoria.familia", e.message);
    }
  } else {
    console.log("MIGRAÇÃO: categoria.familia já é VARCHAR (nada a fazer)");
  }

  await adicionar("movimento_estoque", "material_destino_id", "INT NULL");

  const catTipoRef = await sequelize.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categoria' AND COLUMN_NAME = 'tipo'",
    { type: sequelize.QueryTypes.SELECT }
  );
  if (catTipoRef.length && catTipoRef[0].COLUMN_TYPE.includes("ENUM")) {
    try {
      await sequelize.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
      await sequelize.query("ALTER TABLE `categoria` MODIFY `tipo` VARCHAR(50) NOT NULL DEFAULT 'materia_prima'");
      console.log("MIGRAÇÃO: categoria.tipo alterado de ENUM para VARCHAR(50)");
    } catch (e) {
      console.error("MIGRAÇÃO: erro ao alterar categoria.tipo", e.message);
    }
  }

  const movTipoRef = await sequelize.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'movimento_estoque' AND COLUMN_NAME = 'tipo'",
    { type: sequelize.QueryTypes.SELECT }
  );
  if (movTipoRef.length && !movTipoRef[0].COLUMN_TYPE.includes("transferencia")) {
    try {
      await sequelize.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
      await sequelize.query(
        "ALTER TABLE `movimento_estoque` MODIFY `tipo` ENUM('entrada','saida','transferencia','perda','desperdicio') NOT NULL DEFAULT 'entrada'"
      );
      console.log("MIGRAÇÃO: movimento_estoque.tipo inclui transferencia, perda, desperdicio");
    } catch (e) {
      if (e.code === "WARN_DATA_TRUNCATED" || e.parent?.code === "WARN_DATA_TRUNCATED") {
        console.log("MIGRAÇÃO: movimento_estoque.tipo actualizado");
      } else throw e;
    }
  }
}

module.exports = { aplicarMigracoesMysql };
