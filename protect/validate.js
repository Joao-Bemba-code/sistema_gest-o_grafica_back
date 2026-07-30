module.exports = (schema) => {
  return (req, res, next) => {
    const campos = schema(req.method === "GET" ? req.query : req.body);
    if (campos.erro) {
      return res.status(422).json({ erro: campos.erro });
    }
    if (req.body) req.body = { ...req.body, ...campos };
    next();
  };
};

module.exports.camposObrigatorios = (campos) => {
  return (dados) => {
    for (const campo of campos) {
      if (!dados[campo] || (typeof dados[campo] === "string" && !dados[campo].trim())) {
        return { erro: `Campo obrigatório: ${campo}` };
      }
    }
    return dados;
  };
};
