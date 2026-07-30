module.exports = {
  criar(dados) {
    if (!dados.nome || !dados.nome.trim()) return { erro: "Nome é obrigatório" };
    return dados;
  },
};
