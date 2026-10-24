#!/usr/bin/env node
/**
 * Gera o pedido de registo de facturas no formato da AGT, já assinado, para
 * colar no portal de certificação (cenário C1 — Factura/Recibo).
 *
 * O corpo segue exactamente o que o backend envia em
 * `agtClient.registarFacturas` e o documento é montado como em
 * `FaturacaoController.montarDocumentoAGT`, para que o JSON validado no portal
 * seja o mesmo que o sistema produz em produção.
 *
 * Uso:
 *   node scripts/gerar_payload_agt.js --product-id=XXXX --validacao=YYYY
 *
 * Os valores em falta são lidos do .env: AGT_NIF, AGT_SOFTWARE_PRODUCT_ID,
 * AGT_SOFTWARE_VERSION, AGT_SOFTWARE_VALIDATION_NUMBER. As chaves privadas
 * vêm de certificados/ (ou de AGT_SOFTWARE_KEY / AGT_TAXPAYER_KEY).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
require("dotenv").config({ quiet: true });

const RAIZ_BACKEND = path.join(__dirname, "..");
const RAIZ_PROJETO = path.join(RAIZ_BACKEND, "..");

function lerArgumentos(argv) {
  const args = {};
  for (const item of argv.slice(2)) {
    const m = item.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] === undefined ? "true" : m[2];
  }
  return args;
}

function lerPem(caminho) {
  const resolvido = path.isAbsolute(caminho) ? caminho : path.join(RAIZ_BACKEND, caminho);
  if (!fs.existsSync(resolvido)) return null;
  return fs.readFileSync(resolvido, "utf8");
}

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function arredondar(v) {
  return Number(Number(v).toFixed(2));
}

const args = lerArgumentos(process.argv);

const nif = args.nif || process.env.AGT_NIF || "";
const productId = args["product-id"] || process.env.AGT_SOFTWARE_PRODUCT_ID || "";
const productVersion = args.versao || process.env.AGT_SOFTWARE_VERSION || "1.0";
const validationNumber = args.validacao || process.env.AGT_SOFTWARE_VALIDATION_NUMBER || "";
const tipo = String(args.tipo || "FR").toUpperCase();
const serie = args.serie || String(new Date().getFullYear());
const numero = args.numero || "1";
// 999999999 é o NIF de consumidor final aceite pela AGT — evita depender de
// um NIF de cliente que tenha de estar previamente registado no sistema.
const identificador = args["cliente-nif"] || "999999999";
const clienteNome = args.cliente || "Consumidor Final";
const clientePais = args["cliente-pais"] || "AO";
const eacCode = args.eac || process.env.AGT_EAC_CODE || "";
const percentual = Number(args.iva ?? process.env.AGT_IVA ?? 14);
const dataDocumento = args.data || isoLocal(new Date());
// A AGT exige referenceInfo em cada linha das notas de crédito, a apontar para
// o documento de origem (o FT validado no passo anterior, por omissão). Os
// recibos (RC/RG) também referenciam o documento de origem, mas em paymentReceipt.
const referenciaOrigem = args.referencia || "FT 2026/1";
const motivoNC = args.motivo || "Devolução dos artigos facturados";
const dataOrigem = args["data-origem"] || dataDocumento;
const valorRecibo = Number(args.valor ?? 324900);
const out = args.out || path.join(RAIZ_PROJETO, "documentacao", "agt_payload_c1.json");

const chaveSoftware = lerPem(args["chave-software"] || process.env.AGT_SOFTWARE_KEY || "certificados/software_kamatambu_privada.pem");
const chaveEmitente = lerPem(args["chave-emitente"] || process.env.AGT_TAXPAYER_KEY || "certificados/emitente_kamatambu_privada.pem");

const faltam = [];
if (!nif) faltam.push("NIF do emitente (--nif ou AGT_NIF)");
if (!productId) faltam.push("Product ID do Kamgest (--product-id ou AGT_SOFTWARE_PRODUCT_ID)");
if (!validationNumber) faltam.push("Número de validação AGT (--validacao ou AGT_SOFTWARE_VALIDATION_NUMBER)");
if (!chaveSoftware) faltam.push("chave privada do software (certificados/software_kamatambu_privada.pem)");
if (!chaveEmitente) faltam.push("chave privada do emitente (certificados/emitente_kamatambu_privada.pem)");

if (faltam.length) {
  console.error("Faltam dados para assinar o pedido:");
  for (const f of faltam) console.error(`  - ${f}`);
  console.error("\nExemplo:");
  console.error("  node scripts/gerar_payload_agt.js --product-id=XXXX --validacao=YYYY");
  process.exit(1);
}

const linhasBase = [
  { descricao: "Impressão de 500 desdobráveis A5, 4/4 cores", quantidade: 500, preco: 450, unidade: "UN" },
  { descricao: "Acabamento com verniz localizado", quantidade: 500, preco: 120, unidade: "UN" },
];

// A AGT exige que, fora das notas de crédito, o somatório dos valores a
// crédito das linhas seja superior ao dos valores a débito. Vendas (FT, FR,
// VD) levam creditAmount; só a nota de crédito (NC) usa debitAmount.
const usaCredito = tipo !== "NC";

const linhas = linhasBase.map((l, idx) => {
  const total = arredondar(l.quantidade * l.preco);
  const contribuicao = arredondar(total * (percentual / 100));
  return {
    lineNumber: idx + 1,
    operationType: "TB",
    productCode: `SRV${String(idx + 1).padStart(3, "0")}`,
    productDescription: l.descricao.slice(0, 200),
    quantity: l.quantidade,
    unitOfMeasure: l.unidade,
    unitPriceBase: l.preco,
    unitPrice: l.preco,
    creditAmount: usaCredito ? total : 0,
    debitAmount: usaCredito ? 0 : total,
    settlementAmount: 0,
    taxes:
      percentual > 0
        ? [{ taxType: "IVA", taxCountryRegion: "AO", taxCode: "NOR", taxPercentage: percentual, taxContribution: contribuicao }]
        : [{ taxType: "NS", taxCountryRegion: "AO", taxPercentage: 0 }],
    ...(usaCredito
      ? {}
      : { referenceInfo: { reference: referenciaOrigem, referenceItemLineNo: idx + 1, reason: motivoNC } }),
  };
});

// O total líquido é sempre positivo: nas vendas soma-se o crédito, na nota de
// crédito soma-se o débito (os valores da NC são indicados em módulo).
const netTotal = arredondar(
  linhas.reduce((s, l) => s + (usaCredito ? l.creditAmount - l.debitAmount : l.debitAmount - l.creditAmount), 0)
);
const taxPayable = arredondar(
  linhas.reduce((s, l) => s + (l.taxes[0].taxContribution || 0), 0)
);
const grossTotal = arredondar(netTotal + taxPayable);

const documentNo = `${tipo} ${serie}/${numero}`;
// RC/RG são recibos: não levam lines, levam paymentReceipt com o documento de
// origem. Os totais representam o valor recebido, sem IVA a pagar.
const ehRecibo = tipo === "RC" || tipo === "RG";
const totaisRecibo = { taxPayable: 0, netTotal: arredondar(valorRecibo), grossTotal: arredondar(valorRecibo) };
const documento = {
  documentNo,
  documentStatus: "N",
  documentDate: dataDocumento,
  documentType: tipo,
  systemEntryDate: new Date().toISOString().slice(0, 19),
  customerTaxID: identificador,
  customerCountry: clientePais,
  companyName: clienteNome.slice(0, 200),
  ...(ehRecibo
    ? {
        paymentReceipt: {
          sourceDocuments: [
            {
              lineNo: 1,
              sourceDocumentID: { originatingON: referenciaOrigem, documentDate: dataOrigem },
              debitAmount: arredondar(valorRecibo),
            },
          ],
        },
        documentTotals: totaisRecibo,
      }
    : { lines: linhas, documentTotals: { taxPayable, netTotal, grossTotal } }),
};

documento.jwsDocumentSignature = jwt.sign(
  {
    documentNo,
    taxRegistrationNumber: nif,
    documentType: tipo,
    documentDate: dataDocumento,
    customerTaxID: identificador,
    customerCountry: clientePais,
    companyName: clienteNome.slice(0, 200),
    documentTotals: documento.documentTotals,
  },
  chaveEmitente,
  { algorithm: "RS256" }
);

if (eacCode) documento.eacCode = eacCode;

const softwareInfoDetail = {
  productId,
  productVersion,
  softwareValidationNumber: validationNumber,
};

const pedido = {
  schemaVersion: "2.0",
  submissionUUID: crypto.randomUUID(),
  taxRegistrationNumber: nif,
  submissionTimeStamp: new Date().toISOString(),
  softwareInfo: {
    softwareInfoDetail,
    jwsSoftwareSignature: jwt.sign(softwareInfoDetail, chaveSoftware, { algorithm: "RS256" }),
  },
  numberOfEntries: 1,
  documents: [documento],
};

const json = JSON.stringify(pedido, null, 2);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, json, "utf8");

if (args.stdout === "true") {
  process.stdout.write(json + "\n");
} else {
  console.log(`JSON gerado: ${path.relative(RAIZ_PROJETO, out)}`);
  const totalResumo = ehRecibo ? valorRecibo : grossTotal;
  console.log(`Documento: ${documentNo} · ${clienteNome} · ${totalResumo.toLocaleString("pt-PT")} Kz (IVA ${percentual}%)`);
  console.log(`NIF emitente: ${nif} · Product ID: ${productId} · Validação: ${validationNumber}`);
  console.log("Para copiar do terminal: acrescenta --stdout");
}
