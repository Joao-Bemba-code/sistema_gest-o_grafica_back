const fs = require("fs");
const path = require("path");

function lerChave(caminho) {
  if (!caminho) return null;
  const resolvido = path.isAbsolute(String(caminho).trim())
    ? String(caminho).trim()
    : path.join(__dirname, "..", String(caminho).trim());
  if (!fs.existsSync(resolvido)) return null;
  return fs.readFileSync(resolvido, "utf8");
}

function configAGT() {
  const ativo = String(process.env.AGT_ATIVO || "false").toLowerCase() === "true";
  const ambiente = String(process.env.AGT_AMBIENTE || "homologacao").toLowerCase();
  const baseUrl =
    ambiente === "producao"
      ? process.env.AGT_BASE_URL_PROD || "https://sifp.minfin.gov.ao"
      : process.env.AGT_BASE_URL_HML || "https://sifphml.minfin.gov.ao";
  return {
    ativo,
    ambiente,
    baseUrl,
    username: process.env.AGT_USERNAME || "",
    password: process.env.AGT_PASSWORD || "",
    nif: process.env.AGT_NIF || "",
    establishment: process.env.AGT_ESTABLISHMENT || "SEDE",
    productId: process.env.AGT_SOFTWARE_PRODUCT_ID || "",
    productVersion: process.env.AGT_SOFTWARE_VERSION || "",
    softwareValidationNumber: process.env.AGT_SOFTWARE_VALIDATION_NUMBER || "",
    softwareKey: lerChave(process.env.AGT_SOFTWARE_KEY),
    taxpayerKey: lerChave(process.env.AGT_TAXPAYER_KEY),
    eacCode: process.env.AGT_EAC_CODE || "",
    ivaDefault: parseFloat(process.env.AGT_IVA) || 14,
    pollSeconds: parseInt(process.env.AGT_POLL_SECONDS, 10) || 60,
    timeoutMs: parseInt(process.env.AGT_TIMEOUT_MS, 10) || 30000,
    caminhos: {
      solicitarSerie: process.env.AGT_PATH_SOLICITAR_SERIE || "/sigt/fe/v1/solicitarSerie",
      listarSeries: process.env.AGT_PATH_LISTAR_SERIES || "/sigt/fe/v1/listarSeries",
      registarFactura: process.env.AGT_PATH_REGISTAR || "/sigt/fe/v1/registarFactura",
      obterEstado: process.env.AGT_PATH_ESTADO || "/sigt/fe/v1/obterEstado",
    },
  };
}

function agtPronto() {
  const c = configAGT();
  return (
    c.ativo &&
    c.username &&
    c.password &&
    c.nif &&
    c.softwareKey &&
    c.taxpayerKey &&
    c.softwareValidationNumber &&
    c.productId
  );
}

module.exports = { configAGT, agtPronto };