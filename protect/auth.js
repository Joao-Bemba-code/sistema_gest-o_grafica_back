const jwt = require("jsonwebtoken");
const { Usuario } = require("../models");

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token não fornecido" });
  }
  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.SECRET);
    const usuario = await Usuario.findByPk(decoded.id, { attributes: { exclude: ["senha"] } });
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: "Usuário inválido ou inativo" });
    }
    req.usuario = usuario;
    req.organizacao_id = usuario.organizacao_id;
    next();
  } catch (e) {
    return res.status(401).json({ erro: "Token inválido ou expirado" });
  }
};
