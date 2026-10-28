const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { configAGT } = require("./agtConfig");

function assinarJWS(payload, chavePrivada) {
  return jwt.sign(payload, chavePrivada, { algorithm: "RS256" });
}

function assinarSoftware(detalhe, cfg) {
  return assinarJWS(detalhe, (cfg || configAGT()).softwareKey);
}

function assinarDocumento(payload, cfg) {
  return assinarJWS(payload, (cfg || configAGT()).taxpayerKey);
}

function authHeader(cfg) {
  const c = cfg || configAGT();
  return `Basic ${Buffer.from(`${c.username}:${c.password}`).toString("base64")}`;
}

async function chamarAGT(caminho, corpo, cfg) {
  const c = cfg || configAGT();
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), c.timeoutMs);
  try {
    const resposta = await fetch(`${c.baseUrl}${caminho}`, {
      method: "POST",
      headers: {
        Authorization: authHeader(c),
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

function baseComum(nif, cfg) {
  const c = cfg || configAGT();
  const detalhe = {
    productId: c.productId,
    productVersion: c.productVersion,
    softwareValidationNumber: c.softwareValidationNumber,
  };
  return {
    schemaVersion: "2.0",
    submissionUUID: crypto.randomUUID(),
    taxRegistrationNumber: nif,
    submissionTimeStamp: new Date().toISOString(),
    softwareInfo: {
      softwareInfoDetail: detalhe,
      jwsSoftwareSignature: assinarSoftware(detalhe, c),
    },
  };
}

async function solicitarSerie({ nif, establishment, seriesYear, documentType, contingencyIndicator = "N" }, cfg) {
  const c = cfg || configAGT();
  const corpo = {
    ...baseComum(nif, c),
    seriesYear: String(seriesYear),
    documentType,
    establishmentNumber: establishment || c.establishment,
    seriesContingencyIndicator: contingencyIndicator,
    jwsSignature: assinarDocumento(
      {
        taxRegistrationNumber: nif,
        establishmentNumber: establishment || c.establishment,
        seriesYear: String(seriesYear),
        documentType,
      },
      c
    ),
  };
  return chamarAGT(c.caminhos.solicitarSerie, corpo, c);
}

async function listarSeries({ nif, criterios = {} }, cfg) {
  const c = cfg || configAGT();
  const corpo = {
    ...baseComum(nif, c),
    jwsSignature: assinarDocumento({ taxRegistrationNumber: nif }, c),
    ...criterios,
  };
  return chamarAGT(c.caminhos.listarSeries, corpo, c);
}

async function registarFacturas({ nif, documentos }, cfg) {
  const c = cfg || configAGT();
  const corpo = {
    ...baseComum(nif, c),
    numberOfEntries: documentos.length,
    documents: documentos,
  };
  return chamarAGT(c.caminhos.registarFactura, corpo, c);
}

async function obterEstado({ nif, requestID }, cfg) {
  const c = cfg || configAGT();
  const corpo = {
    ...baseComum(nif, c),
    requestID,
    jwsSignature: assinarDocumento({ taxRegistrationNumber: nif, requestID }, c),
  };
  return chamarAGT(c.caminhos.obterEstado, corpo, c);
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
