module.exports = {
  criar(dados) {
    if (!dados.nome || !dados.nome.trim()) return { erro: "Nome do material é obrigatório" };
    return dados;
  },
};
