const { Bem } = require("../models");

const PARAVRAS_IGNORADAS = new Set(["e", "de", "da", "do", "das", "dos", "para"]);

// Extrai as iniciais da categoria para o código do bem (KPAT-MEI, KPAT-EI, KPAT-MEA, ...).
function iniciaisDaCategoria(categoria) {
  const palavras = String(categoria || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[\s/]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const relevantes = palavras.filter((p) => !PARAVRAS_IGNORADAS.has(p.toLowerCase()));
  const base = (relevantes.length ? relevantes : palavras)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
  return base || "GEN";
}

async function gerarCodigoBem(organizacao_id, categoria) {
  const prefixo = `KPAT-${iniciaisDaCategoria(categoria)}`;
  const bens = await Bem.findAll({ where: { organizacao_id }, attributes: ["codigo"] });
  let maximo = 0;
  const re = new RegExp(`^${prefixo}-(\\d+)$`);
  bens.forEach((b) => {
    const m = re.exec(String(b.codigo || ""));
    if (m) maximo = Math.max(maximo, parseInt(m[1], 10));
  });
  return `${prefixo}-${String(maximo + 1).padStart(4, "0")}`;
}

exports.listar = async (req, res) => {
  try {
    const bens = await Bem.findAll({
      where: { organizacao_id: req.organizacao_id },
      order: [["nome", "ASC"]],
    });
    return res.json(bens);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar bens" });
  }
};

exports.buscarPorId = async (req, res) => {
  try {
    const bem = await Bem.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!bem) return res.status(404).json({ erro: "Bem não encontrado" });
    return res.json(bem);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao buscar bem" });
  }
};

exports.criar = async (req, res) => {
  try {
    const dados = { ...req.body, organizacao_id: req.organizacao_id };
    if (!dados.codigo || !String(dados.codigo).trim()) {
      dados.codigo = await gerarCodigoBem(req.organizacao_id, dados.categoria);
    }
    const bem = await Bem.create(dados);
    return res.status(201).json(bem);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao criar bem" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const bem = await Bem.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!bem) return res.status(404).json({ erro: "Bem não encontrado" });
    await bem.update({ ...req.body });
    return res.json(bem);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao atualizar bem" });
  }
};

exports.remover = async (req, res) => {
  try {
    const bem = await Bem.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!bem) return res.status(404).json({ erro: "Bem não encontrado" });
    await bem.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Bem removido com sucesso" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao remover bem" });
  }
};
