const { Op } = require("sequelize");
const { Faturacao } = require("../models");
const { obterConfigAGT, agtPronto } = require("./agtConfig");
const { atualizarEstadoAGT } = require("../controllers/FaturacaoController");

async function consultarPendentes() {
  try {
    const pendentes = await Faturacao.findAll({
      where: { agt_status: "pendente", agt_request_id: { [Op.ne]: null } },
    });
    const porOrg = new Map();
    for (const fatura of pendentes) {
      if (!porOrg.has(fatura.organizacao_id)) porOrg.set(fatura.organizacao_id, []);
      porOrg.get(fatura.organizacao_id).push(fatura);
    }
    for (const [organizacaoId, faturas] of porOrg) {
      const cfg = await obterConfigAGT(organizacaoId);
      if (!agtPronto(cfg)) continue;
      for (const fatura of faturas) {
        try {
          await atualizarEstadoAGT(fatura, cfg);
        } catch (e) {
          console.error("AGT: erro ao consultar estado da fatura", fatura.id, e.detalhes || e.message);
        }
      }
    }
  } catch (e) {
    console.error("AGT: erro no ciclo de consulta de pendentes", e.message);
  }
}

function iniciarPollingAGT() {
  const cfg = require("./agtConfig").configAGT();
  if (cfg.pollSeconds <= 0) return () => {};
  const intervalo = setInterval(consultarPendentes, cfg.pollSeconds * 1000);
  if (intervalo.unref) intervalo.unref();
  return () => clearInterval(intervalo);
}

module.exports = { consultarPendentes, iniciarPollingAGT };
