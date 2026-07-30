/*
 * seed_test.js — apaga todos os dados de negócio (exceto organizações/utilizadores/config)
 * e cria dados de teste completos para as 3 organizações.
 * Uso: node seed_test.js
 */
const { sequelize, Organizacao, Usuario, Cliente, Categoria, Material, MovimentoEstoque, Orcamento, OrcamentoItem, OrdemProducao, PreImpressao, Faturacao } = require("./models");
const estoqueService = require("./services/estoque");

const TABELAS_APAGAR = [
  "faturacao", "reserva_estoque", "qualidade", "acabamento", "impressao",
  "pre_impressao", "ordem_producao", "movimento_estoque", "orcamento_item",
  "orcamento", "material", "fornecedor", "cliente", "categoria", "sequencia",
];

const CATEGORIAS = ["Papel", "Tinta", "Chapas", "Acabamento", "Cartão", "Etiquetas", "Embalagem"];

const FORNECEDORES = [
  { nome: "Papelaria Luanda Lda", nif: "541000111", telefone: "+244 923 111 222" },
  { nome: "Tintas Color SA", nif: "541000222", telefone: "+244 924 222 333" },
  { nome: "Grafite Importadora Lda", nif: "541000333", telefone: "+244 925 333 444" },
  { nome: "Cartonagem Atlântico Lda", nif: "541000444", telefone: "+244 926 444 555" },
];

const CLIENTES = [
  { nome: "Pedro Cassoma", empresa: "", nif: "001234567", telefone: "+244 923 000 111", email: "pedro.cassoma@gmail.com", endereco: "Rua Amílcar Cabral, Luanda" },
  { nome: "Mundo Universitário", empresa: "Mundo Universitário Lda", nif: "541000501", telefone: "+244 222 311 100", email: "geral@mundouniversitario.co.ao", endereco: "Largo da Independência 12, Luanda" },
  { nome: "Rádio Escola", empresa: "Rádio Escola Lda", nif: "541000502", telefone: "+244 222 320 200", email: "info@radioescola.co.ao", endereco: "Rua do Maculusso, Luanda" },
  { nome: "Banco BAI", empresa: "Banco Angolano de Investimentos", nif: "540000123", telefone: "+244 222 600 300", email: "compras@bai.co.ao", endereco: "Av. 4 de Fevereiro, Luanda" },
  { nome: "ONG Criança Feliz", empresa: "Associação Criança Feliz", nif: "541000503", telefone: "+244 923 400 500", email: "geral@criancafeliz.org", endereco: "Talatona, Luanda" },
  { nome: "Supermercado Kero", empresa: "Kero Angola SA", nif: "541000234", telefone: "+244 222 700 400", email: "marketing@kero.co.ao", endereco: "Av. Deolinda Rodrigues, Luanda" },
];

const MATERIAIS = [
  { nome: "Papel Couché 150g A4", cat: "Papel", un: "folha", tipo: "folha", formato: "A4", gramagem: 150, qtd: 8000, min: 1000, quebra: 3, custo: 85, margem: 40 },
  { nome: "Papel Couché 300g A4", cat: "Papel", un: "folha", tipo: "folha", formato: "A4", gramagem: 300, qtd: 5000, min: 500, quebra: 5, custo: 120, margem: 40 },
  { nome: "Papel Offset 80g A4", cat: "Papel", un: "folha", tipo: "folha", formato: "A4", gramagem: 80, qtd: 20000, min: 3000, quebra: 2, custo: 55, margem: 35 },
  { nome: "Papel Cartolina 250g A3", cat: "Papel", un: "folha", tipo: "folha", formato: "A3", gramagem: 250, qtd: 3000, min: 500, quebra: 0, custo: 70, margem: 40 },
  { nome: "Tinta Cyan (Offset)", cat: "Tinta", un: "kg", tipo: "peso", qtd: 12, min: 3, quebra: 0, custo: 3500, margem: 30 },
  { nome: "Tinta Magenta (Offset)", cat: "Tinta", un: "kg", tipo: "peso", qtd: 12, min: 3, quebra: 0, custo: 3500, margem: 30 },
  { nome: "Tinta Preta (Offset)", cat: "Tinta", un: "kg", tipo: "peso", qtd: 25, min: 5, quebra: 0, custo: 3000, margem: 30 },
  { nome: "Chapa Offset", cat: "Chapas", un: "un", tipo: "unidade", qtd: 30, min: 10, quebra: 0, custo: 4500, margem: 25 },
  { nome: "Vinil Auto-adesivo Brilhante", cat: "Etiquetas", un: "m²", tipo: "metro", qtd: 80, min: 20, quebra: 5, custo: 1500, margem: 35 },
  { nome: "Cartão Kraft 3mm", cat: "Cartão", un: "un", tipo: "unidade", qtd: 500, min: 100, quebra: 2, custo: 250, margem: 40 },
  { nome: "Verniz UV", cat: "Acabamento", un: "litro", tipo: "volume", qtd: 10, min: 4, quebra: 0, custo: 2800, margem: 30 },
  { nome: "Etiqueta Branca A4", cat: "Etiquetas", un: "folha", tipo: "folha", formato: "A4", qtd: 25, min: 100, quebra: 0, custo: 180, margem: 30 },
];

const ORCAMENTOS = [
  {
    estado: "aprovado",
    cliente: "Pedro Cassoma",
    produto: "Cartões de Visita",
    formato: "A4 (4 por folha)", papel: "Papel Couché 300g", impressao: "Offset 4/4", acabamento: "Corte e dobra",
    prazo: "3 dias úteis", condicoes: "50% de sinal + 50% na entrega", ivaPct: 14,
    itens: [{ descricao: "Design e impressão de 5000 cartões de visita", quantidade: 5000, preco_unit: 15, total: 75000 }],
  },
  {
    estado: "aprovado",
    cliente: "Mundo Universitário",
    produto: "Catálogo Institucional",
    formato: "A4 (32 págs)", papel: "Papel Couché 150g", impressao: "Offset 4/4", acabamento: "Verniz localizado, costura",
    prazo: "5 dias úteis", condicoes: "100% antecipado", ivaPct: 14,
    itens: [
      { descricao: "Design gráfico do catálogo", quantidade: 1, preco_unit: 85000, total: 85000 },
      { descricao: "Impressão de 200 catálogos A4 (32 páginas)", quantidade: 200, preco_unit: 3500, total: 700000 },
    ],
  },
  {
    estado: "aprovado",
    cliente: "Supermercado Kero",
    produto: "Panfletos A5",
    formato: "A5", papel: "Papel Offset 80g", impressao: "Offset 4/0", acabamento: "Corte",
    prazo: "2 dias úteis", condicoes: "100% antecipado", ivaPct: 14,
    itens: [{ descricao: "Impressão de 10000 panfletos A5 (4 cores, uma face)", quantidade: 10000, preco_unit: 4.5, total: 45000 }],
  },
  {
    estado: "pendente",
    cliente: "Banco BAI",
    produto: "Brochuras Institucionais",
    formato: "A5 (8 págs)", papel: "Papel Couché 150g", impressao: "Offset 4/4", acabamento: "Dobragem e corte",
    prazo: "4 dias úteis", condicoes: "50% de sinal + 50% na entrega", ivaPct: 14,
    itens: [{ descricao: "Impressão de 3000 brochuras A5 (8 páginas)", quantidade: 3000, preco_unit: 20, total: 60000 }],
  },
  {
    estado: "rejeitado",
    cliente: "Rádio Escola",
    produto: "Poster A2",
    formato: "A2", papel: "Papel Couché 200g", impressao: "Offset 4/0", acabamento: "Corte",
    prazo: "2 dias úteis", condicoes: "100% antecipado", ivaPct: 14,
    itens: [{ descricao: "Impressão de 500 posters A2", quantidade: 500, preco_unit: 300, total: 150000 }],
  },
];

async function limpar() {
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const tabela of TABELAS_APAGAR) {
    await sequelize.query(`TRUNCATE TABLE \`${tabela}\``);
  }
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
  console.log("> Dados apagados (13 tabelas truncadas)");
}

async function semearOrg(org) {
  const user = await Usuario.findOne({ where: { organizacao_id: org.id }, order: [["id", "ASC"]] });
  const uid = user ? user.id : null;
  console.log(`\n=== Organização: ${org.nome} (id ${org.id}) ===`);

  const catMap = {};
  for (const nome of CATEGORIAS) {
    const c = await Categoria.create({ organizacao_id: org.id, nome });
    catMap[nome] = c.id;
  }

  let nForn = 0;
  for (const f of FORNECEDORES) {
    nForn += 1;
    await Cliente.create({ ...f, organizacao_id: org.id, tipo: "fornecedor", codigo: `FOR-${String(nForn).padStart(4, "0")}` });
  }
  const fornecedorNome = FORNECEDORES[0].nome;

  const cliMap = {};
  let nCli = 0;
  for (const c of CLIENTES) {
    nCli += 1;
    const criado = await Cliente.create({ ...c, organizacao_id: org.id, tipo: "cliente", codigo: `CLI-${String(nCli).padStart(4, "0")}` });
    cliMap[c.nome] = criado.id;
  }

  const matMap = {};
  let i = 0;
  for (const m of MATERIAIS) {
    i += 1;
    const material = await Material.create({
      organizacao_id: org.id,
      categoria_id: catMap[m.cat],
      codigo: `MAT-${String(i).padStart(4, "0")}`,
      nome: m.nome,
      fornecedor: fornecedorNome,
      unidade: m.un,
      formato: m.formato || null,
      gramagem: m.gramagem || 0,
      tipo_estoque: m.tipo,
      percentual_quebra: m.quebra,
      quantidade: m.qtd,
      estoque_reservado: 0,
      estoque_min: m.min,
      estoque_max: m.qtd * 3,
      ponto_ressuprimento: m.min * 2,
      custo_unit: m.custo,
      margem: m.margem,
      descricao: `${m.nome} — material para indústria gráfica`,
      condicao_armazenagem: "Local seco e arejado, longe da luz direta",
      ativo: true,
    });
    await MovimentoEstoque.create({
      organizacao_id: org.id,
      material_id: material.id,
      tipo: "entrada",
      quantidade: m.qtd,
      referencia_tipo: "manual",
      motivo: "Stock inicial",
      fornecedor_nome: fornecedorNome,
      usuario_id: uid,
    });
    matMap[m.nome] = material.id;
  }

  const orcIds = {};
  let nOrc = 0;
  for (const o of ORCAMENTOS) {
    nOrc += 1;
    const subtotal = o.itens.reduce((s, it) => s + it.total, 0);
    const totalIva = subtotal * (o.ivaPct / 100);
    const orcamento = await Orcamento.create({
      organizacao_id: org.id,
      cliente_id: cliMap[o.cliente],
      numero: `ORC-${String(nOrc).padStart(4, "0")}`,
      data_emissao: new Date(),
      validade: 30,
      estado: o.estado,
      produto: o.produto,
      formato: o.formato,
      papel: o.papel,
      impressao: o.impressao,
      acabamento: o.acabamento,
      prazo_execucao: o.prazo,
      condicoes_pagamento: o.condicoes,
      iva: o.ivaPct,
      total_sem_iva: subtotal,
      total_iva: Number(totalIva.toFixed(2)),
      total_com_iva: Number((subtotal + totalIva).toFixed(2)),
      observacoes: `Orçamento de exemplo — ${o.produto}`,
      usuario_id: uid,
    });
    await OrcamentoItem.bulkCreate(
      o.itens.map((it) => ({ orcamento_id: orcamento.id, ...it }))
    );
    orcIds[o.cliente] = orcamento.id;
  }
  await sequelize.query(
    "INSERT INTO sequencia (organizacao_id, numero) VALUES (?, ?) ON DUPLICATE KEY UPDATE numero = VALUES(numero)",
    { replacements: [org.id, nOrc] }
  );

  const op = await OrdemProducao.create({
    organizacao_id: org.id,
    cliente_id: cliMap["Pedro Cassoma"],
    numero: `OP-2026-0001`,
    produto: "Cartões de Visita",
    quantidade: 5000,
    data_entrada: new Date(),
    data_entrega: new Date(Date.now() + 3 * 86400000),
    estado: "aguardando",
    requisicao_estado: "pendente",
    progresso: 0,
    observacoes: "OP de teste criada pelo seed — aguardando saída de materiais",
    usuario_id: uid,
  });
  await PreImpressao.create({ organizacao_id: org.id, ordem_producao_id: op.id });
  await estoqueService.reservarMateriais({
    organizacaoId: org.id,
    ordemProducaoId: op.id,
    usuarioId: uid,
    itens: [
      { material_id: matMap["Papel Couché 300g A4"], quantidade: 1250 },
      { material_id: matMap["Tinta Preta (Offset)"], quantidade: 1 },
    ],
  });

  const hoje = new Date();
  const hojeStr = hoje.toISOString().split("T")[0];
  const venc = new Date(hoje.getTime() + 30 * 86400000).toISOString().split("T")[0];
  const itemsCat = ORCAMENTOS[1].itens.map((it) => ({ descricao: it.descricao, quantidade: it.quantidade, preco_unit: it.preco_unit, total: it.total }));
  const subCat = itemsCat.reduce((s, it) => s + it.total, 0);
  const ivaCat = subCat * 0.14;
  await Faturacao.create({
    organizacao_id: org.id,
    orcamento_id: orcIds["Mundo Universitário"],
    cliente_id: cliMap["Mundo Universitário"],
    tipo: "fatura",
    numero: "FAT-2026-0001",
    data_emissao: hojeStr,
    data_vencimento: venc,
    itens: itemsCat,
    subtotal: subCat,
    iva: 14,
    valor_iva: Number(ivaCat.toFixed(2)),
    total: Number((subCat + ivaCat).toFixed(2)),
    valor: Number((subCat + ivaCat).toFixed(2)),
    valor_pago: 0,
    estado: "emitida",
    observacoes: "Fatura de exemplo (emitida)",
    usuario_id: uid,
  });

  const itemsCart = ORCAMENTOS[0].itens.map((it) => ({ descricao: it.descricao, quantidade: it.quantidade, preco_unit: it.preco_unit, total: it.total }));
  const subCart = itemsCart.reduce((s, it) => s + it.total, 0);
  const ivaCart = subCart * 0.14;
  await Faturacao.create({
    organizacao_id: org.id,
    orcamento_id: orcIds["Pedro Cassoma"],
    cliente_id: cliMap["Pedro Cassoma"],
    tipo: "fatura",
    numero: "FAT-2026-0002",
    data_emissao: hojeStr,
    data_vencimento: venc,
    itens: itemsCart,
    subtotal: subCart,
    iva: 14,
    valor_iva: Number(ivaCart.toFixed(2)),
    total: Number((subCart + ivaCart).toFixed(2)),
    valor: Number((subCart + ivaCart).toFixed(2)),
    valor_pago: 0,
    estado: "emitida",
    observacoes: "Fatura do orçamento aprovado (emitida, a receber)",
    usuario_id: uid,
  });

  const itemsPan = [{ descricao: "Impressão de 10000 panfletos A5", quantidade: 10000, preco_unit: 4.5, total: 45000 }];
  const totalPan = 51300;
  await Faturacao.create({
    organizacao_id: org.id,
    orcamento_id: orcIds["Supermercado Kero"],
    cliente_id: cliMap["Supermercado Kero"],
    tipo: "factura_recibo",
    numero: "FR-2026-0001",
    data_emissao: hojeStr,
    data_pagamento: hojeStr,
    itens: itemsPan,
    subtotal: 45000,
    iva: 14,
    valor_iva: 6300,
    total: totalPan,
    valor: totalPan,
    valor_pago: totalPan,
    estado: "paga",
    metodo_pagamento: "multicaixa",
    observacoes: "Factura recibo de exemplo (paga na emissão)",
    usuario_id: uid,
  });

  return {
    categorias: CATEGORIAS.length,
    clientes: CLIENTES.length,
    fornecedores: FORNECEDORES.length,
    materiais: MATERIAIS.length,
    orcamentos: nOrc,
    ops: 1,
    faturas: 3,
  };
}

async function main() {
  await limpar();
  const orgs = await Organizacao.findAll({ order: [["id", "ASC"]] });
  const resumo = {};
  for (const org of orgs) {
    resumo[org.nome] = await semearOrg(org);
  }
  console.log("\n=== RESUMO ===");
  for (const [nome, r] of Object.entries(resumo)) {
    console.log(`${nome}: ${JSON.stringify(r)}`);
  }
  await sequelize.close();
  console.log("\nSeed concluído com sucesso.");
}

main().catch(async (e) => {
  console.error("ERRO no seed:", e);
  await sequelize.close();
  process.exit(1);
});
