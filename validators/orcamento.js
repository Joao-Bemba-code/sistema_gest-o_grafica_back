module.exports = {
  criar(dados) {
    if (!dados.cliente_id) return { erro: "Cliente é obrigatório" };
    if (!dados.itens || !dados.itens.length) return { erro: "Adicione pelo menos um item" };
    return dados;
  },
};
