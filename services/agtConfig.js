const fs = require("fs");
const path = require("path");
const { AgtConfiguracao } = require("../models");
const { decifrar } = require("./agtSegredos");

function lerChave(caminho) {
  if (!caminho) return null;
  const resolvido = path.isAbsolute(String(caminho).trim())
    ? String(caminho).trim()
    : path.join(__dirname, "..", String(caminho).trim());
  if (!fs.existsSync(resolvido)) return null;
  return fs.readFileSync(resolvido, "utf8");
}

function baseUrlPara(ambiente) {
  return ambiente === "producao"
    ? process.env.AGT_BASE_URL_PROD || "https://sifp.minfin.gov.ao"
    : process.env.AGT_BASE_URL_HML || "https://sifphml.minfin.gov.ao";
}

// Parte da configuração que vem da certificação do software (SAVES):
// é a mesma para todas as empresas e vive no .env.
function configSoftwareAGT() {
  return {
    productId: process.env.AGT_SOFTWARE_PRODUCT_ID || "",
    productVersion: process.env.AGT_SOFTWARE_VERSION || "",
    softwareValidationNumber: process.env.AGT_SOFTWARE_VALIDATION_NUMBER || "",
    softwareKey: lerChave(process.env.AGT_SOFTWARE_KEY),
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

// Dados de contribuinte vindos do .env — comportamento antigo, usado apenas
// quando a empresa ainda não tem linha própria em agt_configuracao.
function contribuinteEnv() {
  return {
    ativo: String(process.env.AGT_ATIVO || "false").toLowerCase() === "true",
    ambiente: String(process.env.AGT_AMBIENTE || "homologacao").toLowerCase(),
    username: process.env.AGT_USERNAME || "",
    password: process.env.AGT_PASSWORD || "",
    nif: process.env.AGT_NIF || "",
    establishment: process.env.AGT_ESTABLISHMENT || "SEDE",
    taxpayerKey: lerChave(process.env.AGT_TAXPAYER_KEY),
    eacCode: process.env.AGT_EAC_CODE || "",
  };
}

// Configuração completa para uma empresa: software (env) + contribuinte
// (linha própria na BD ou fallback do .env).
async function obterConfigAGT(organizacaoId) {
  const software = configSoftwareAGT();
  const linha = organizacaoId
    ? await AgtConfiguracao.findOne({ where: { organizacao_id: organizacaoId } })
    : null;
  const contribuinte = linha
    ? {
        ativo: !!linha.ativo,
        ambiente: String(linha.ambiente || "homologacao").toLowerCase(),
        username: linha.username || "",
        password: decifrar(linha.senha_cifrada) || "",
        nif: String(linha.nif || "").trim(),
        establishment: linha.establishment || "SEDE",
        taxpayerKey: decifrar(linha.taxpayer_key_cifrada) || null,
        eacCode: linha.eac_code || process.env.AGT_EAC_CODE || "",
        ivaDefault: linha.iva_default != null ? Number(linha.iva_default) : software.ivaDefault,
      }
    : { ...contribuinteEnv(), ivaDefault: software.ivaDefault };
  return {
    ...software,
    baseUrl: baseUrlPara(contribuinte.ambiente),
    ...contribuinte,
  };
}

// Config global do .env (uma empresa só) — mantida para compatibilidade.
function configAGT() {
  const software = configSoftwareAGT();
  const contribuinte = contribuinteEnv();
  return {
    ...software,
    baseUrl: baseUrlPara(contribuinte.ambiente),
    ...contribuinte,
    ivaDefault: software.ivaDefault,
  };
}

function agtPronto(cfg) {
  const c = cfg || configAGT();
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

module.exports = { configAGT, configSoftwareAGT, obterConfigAGT, agtPronto };
