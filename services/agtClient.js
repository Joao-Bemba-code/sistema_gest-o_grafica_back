const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { configAGT } = require("./agtConfig");

function assinarJWS(payload, chavePrivada) {
  return jwt.sign(payload, chavePrivada, { algorithm: "RS256" });
}

function assinarSoftware(detalhe, cfg) {
  return assinarJWS(detalhe, cfg.softwareKey);
}

function assinarDocumento(payload, cfg) {
  return assinarJWS(payload, cfg.taxpayerKey);
}

function authHeader(cfg) {
  return `Basic ${Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64")}`;
}

async function chamarAGT(caminho, corpo) {
  const cfg = configAGT();
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), cfg.timeoutMs);
  try {
    const resposta = await fetch(`${cfg.baseUrl}${caminho}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(cfg),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(corpo),
      signal: controlador.signal,
    });
    const texto = await resposta.text();
    let dados = null;
    try {
      dados = texto ? JSON.parse(texto) : null;
    } catch {
      dados = texto;
    }
    return { status: resposta.status, dados };
  } finally {
    clearTimeout(timer);
  }
}

function baseComum(nif) {
  const cfg = configAGT();
  const detalhe = {
    productId: cfg.productId,
    productVersion: cfg.productVersion,
    softwareValidationNumber: cfg.softwareValidationNumber,
  };
  return {
    schemaVersion: "2.0",
    submissionUUID: crypto.randomUUID(),
    taxRegistrationNumber: nif,
    submissionTimeStamp: new Date().toISOString(),
    softwareInfo: {
      softwareInfoDetail: detalhe,
      jwsSoftwareSignature: assinarSoftware(detalhe, cfg),
    },
  };
}

async function solicitarSerie({ nif, establishment, seriesYear, documentType, contingencyIndicator = "N" }) {
  const cfg = configAGT();
  const corpo = {
    ...baseComum(nif),
    seriesYear: String(seriesYear),
    documentType,
    establishmentNumber: establishment || cfg.establishment,
    seriesContingencyIndicator: contingencyIndicator,
    jwsSignature: assinarDocumento(
      {
        taxRegistrationNumber: nif,
        establishmentNumber: establishment || cfg.establishment,
        seriesYear: String(seriesYear),
        documentType,
      },
      cfg
    ),
  };
  return chamarAGT(cfg.caminhos.solicitarSerie, corpo);
}

async function listarSeries({ nif, criterios = {} }) {
  const cfg = configAGT();
  const corpo = {
    ...baseComum(nif),
    jwsSignature: assinarDocumento({ taxRegistrationNumber: nif }, cfg),
    ...criterios,
  };
  return chamarAGT(cfg.caminhos.listarSeries, corpo);
}

async function registarFacturas({ nif, documentos }) {
  const cfg = configAGT();
  const corpo = {
    ...baseComum(nif),
    numberOfEntries: documentos.length,
    documents: documentos,
  };
  return chamarAGT(cfg.caminhos.registarFactura, corpo);
}

async function obterEstado({ nif, requestID }) {
  const cfg = configAGT();
  const corpo = {
    ...baseComum(nif),
    requestID,
    jwsSignature: assinarDocumento({ taxRegistrationNumber: nif, requestID }, cfg),
  };
  return chamarAGT(cfg.caminhos.obterEstado, corpo);
}

module.exports = {
  assinarJWS,
  assinarSoftware,
  assinarDocumento,
  chamarAGT,
  solicitarSerie,
  listarSeries,
  registarFacturas,
  obterEstado,
};