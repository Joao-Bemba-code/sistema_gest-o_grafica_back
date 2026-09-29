const { Op } = require("sequelize");
const { Faturacao } = require("../models");
const { configAGT } = require("./agtConfig");
const { atualizarEstadoAGT } = require("../controllers/FaturacaoController");

async function consultarPendentes() {
  try {
    const cfg = configAGT();
    if (!cfg.ativo) return;
    const pendentes = await Faturacao.findAll({
      where: { agt_status: "pendente", agt_request_id: { [Op.ne]: null } },
    });
    for (const fatura of pendentes) {
      try {
        await atualizarEstadoAGT(fatura);
      } catch (e) {
        console.error("AGT: erro ao consultar estado da fatura", fatura.id, e.detalhes || e.message);
      }
    }
  } catch (e) {
    console.error("AGT: erro no ciclo de consulta de pendentes", e.message);
  }
}

function iniciarPollingAGT() {
  const cfg = configAGT();
  if (!cfg.ativo || cfg.pollSeconds <= 0) return () => {};
  const intervalo = setInterval(consultarPendentes, cfg.pollSeconds * 1000);
  if (intervalo.unref) intervalo.unref();
  return () => clearInterval(intervalo);
}

module.exports = { consultarPendentes, iniciarPollingAGT };