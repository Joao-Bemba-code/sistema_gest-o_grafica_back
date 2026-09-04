const { Notificacao } = require("../models");

exports.listar = async (req, res) => {
  try {
    const { limite = 30, apenas_nao_lidas } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (apenas_nao_lidas === "true") where.lida = false;
    const notificacoes = await Notificacao.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: Math.min(parseInt(limite, 10) || 30, 100),
    });
    return res.json({ notificacoes });
  } catch (e) {
    console.error("Erro ao listar notificações:", e);
    return res.status(500).json({ erro: "Erro ao listar notificações" });
  }
};

exports.marcarLida = async (req, res) => {
  try {
    const notif = await Notificacao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!notif) return res.status(404).json({ erro: "Notificação não encontrada" });
    if (!notif.lida) await notif.update({ lida: true });
    return res.json(notif);
  } catch (e) {
    console.error("Erro ao marcar notificação como lida:", e);
    return res.status(500).json({ erro: "Erro ao marcar notificação como lida" });
  }
};

exports.marcarTodasLidas = async (req, res) => {
  try {
    await Notificacao.update(
      { lida: true },
      { where: { organizacao_id: req.organizacao_id, lida: false } }
    );
    return res.json({ mensagem: "Todas as notificações marcadas como lidas" });
  } catch (e) {
    console.error("Erro ao marcar notificações como lidas:", e);
    return res.status(500).json({ erro: "Erro ao marcar notificações como lidas" });
  }
};
