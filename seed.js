const bcrypt = require("bcryptjs");
const { sequelize, Organizacao, Usuario, Categoria } = require("./models");

async function seed() {
  try {
    await sequelize.sync({ alter: true });

    const [org] = await Organizacao.findOrCreate({
      where: { email: "geral@cenffor.co.ao" },
      defaults: {
        nome: "Academia Kamatambu",
        sigla: "Kamatambu",
        nif: "5417279310",
        email: "geral@cenffor.co.ao",
        telefone: "+244 923 456 789",
        endereco: "Luanda, Angola",
        website: "https://front-academia-kamatambu.vercel.app/",
      },
    });

    const hash = await bcrypt.hash("admin123", 10);

    const [user] = await Usuario.findOrCreate({
      where: { email: "admin@cenffor.co.ao" },
      defaults: {
        organizacao_id: org.id,
        nome: "Administrador do Sistema",
        email: "admin@cenffor.co.ao",
        senha: hash,
        funcao: "Administrador Geral",
      },
    });

    const CAMPOS_PADRAO = {
      Papel: [
        { chave: "gramagem", rotulo: "Gramagem", tipo: "numero", unidade: "g/m²" },
        { chave: "cor", rotulo: "Cor", tipo: "selecao", opcoes: ["Branco", "Creme", "Off-white", "Colorido"] },
        { chave: "formato", rotulo: "Formato", tipo: "texto" },
        { chave: "tipo", rotulo: "Tipo", tipo: "selecao", opcoes: ["Couché", "Offset", "Autocopiativo", "Cartolina", "Etiqueta"] },
        { chave: "largura", rotulo: "Largura", tipo: "numero", unidade: "cm" },
        { chave: "altura", rotulo: "Altura", tipo: "numero", unidade: "cm" },
      ],
      Tintas: [
        { chave: "cor", rotulo: "Cor", tipo: "selecao", opcoes: ["Preto", "Ciano", "Magenta", "Amarelo", "Verniz", "Outro"] },
        { chave: "base", rotulo: "Base", tipo: "selecao", opcoes: ["Água", "Solvente", "UV", "Óleo"] },
        { chave: "marca", rotulo: "Marca", tipo: "texto" },
        { chave: "secagem", rotulo: "Secagem", tipo: "texto" },
      ],
      Lonas: [
        { chave: "largura", rotulo: "Largura", tipo: "numero", unidade: "m" },
        { chave: "gramagem", rotulo: "Gramagem", tipo: "numero", unidade: "g/m²" },
        { chave: "acabamento", rotulo: "Acabamento", tipo: "selecao", opcoes: ["Brilhante", "Fosca", "Backlit", "Frontlit"] },
      ],
      Vinil: [
        { chave: "largura", rotulo: "Largura", tipo: "numero", unidade: "m" },
        { chave: "adesivo", rotulo: "Adesivo", tipo: "selecao", opcoes: ["Permanente", "Removível", "Cast"] },
        { chave: "espessura", rotulo: "Espessura", tipo: "numero", unidade: "µm" },
      ],
      Cola: [
        { chave: "tipo", rotulo: "Tipo", tipo: "texto" },
        { chave: "secagem", rotulo: "Secagem", tipo: "texto" },
        { chave: "embalagem", rotulo: "Embalagem", tipo: "texto" },
      ],
      Chapas: [
        { chave: "tipo", rotulo: "Tipo", tipo: "selecao", opcoes: ["CTP", "PS", "Química"] },
        { chave: "espessura", rotulo: "Espessura", tipo: "numero", unidade: "mm" },
        { chave: "tamanho", rotulo: "Tamanho", tipo: "texto" },
      ],
      "Papéis e Mídias": [
        { chave: "gramagem", rotulo: "Gramagem", tipo: "numero", unidade: "g/m²" },
        { chave: "cor", rotulo: "Cor", tipo: "selecao", opcoes: ["Branco", "Creme", "Off-white", "Colorido"] },
        { chave: "formato", rotulo: "Formato", tipo: "texto" },
        { chave: "tipo", rotulo: "Tipo", tipo: "selecao", opcoes: ["Couché", "Offset", "Autocopiativo", "Cartolina", "Etiqueta"] },
        { chave: "largura", rotulo: "Largura", tipo: "numero", unidade: "cm" },
        { chave: "altura", rotulo: "Altura", tipo: "numero", unidade: "cm" },
      ],
      "Insumos e Consumíveis": [
        { chave: "marca", rotulo: "Marca", tipo: "texto" },
        { chave: "tipo", rotulo: "Tipo", tipo: "texto" },
      ],
      "Acabamento e Logística": [
        { chave: "tipo", rotulo: "Tipo", tipo: "texto" },
      ],
      "Produtos Prontos": [
        { chave: "descricao_tecnica", rotulo: "Descrição técnica", tipo: "area" },
      ],
    };

    async function criarCategoria(dados) {
      const campos = CAMPOS_PADRAO[dados.nome] || [];
      const [categoria] = await Categoria.findOrCreate({
        where: { organizacao_id: org.id, nome: dados.nome },
        defaults: { organizacao_id: org.id, ...dados, campos_especificacao: campos },
      });
      const atuais = categoria.campos_especificacao;
      if (!Array.isArray(atuais) || atuais.length === 0) {
        await categoria.update({ campos_especificacao: campos });
      }
      return categoria;
    }

    const categoriasSeed = [
      { nome: "Papel Couché", familia: "papeis", subfamilia: "Couché", tipo: "materia_prima" },
      { nome: "Papel Offset", familia: "papeis", subfamilia: "Offset", tipo: "materia_prima" },
      { nome: "Tinta Solvente", familia: "tintas", subfamilia: "Solvente", tipo: "materia_prima" },
      { nome: "Tinta UV", familia: "tintas", subfamilia: "UV", tipo: "materia_prima" },
      { nome: "Chapa CTP", familia: "chapas", subfamilia: "CTP", tipo: "materia_prima" },
      { nome: "Cola", familia: "material_acabamento", subfamilia: "", tipo: "materia_prima" },
      { nome: "Lona", familia: "suporte_especial", subfamilia: "", tipo: "materia_prima" },
      { nome: "Vinil", familia: "suporte_especial", subfamilia: "", tipo: "materia_prima" },
      { nome: "Produto Pronto", familia: "consumiveis", subfamilia: "", tipo: "produto_acabado" },
    ];
    for (const cat of categoriasSeed) {
      await criarCategoria(cat);
    }

    console.log("✅ Seed concluído!");
    console.log("📧 Email: admin@cenffor.co.ao");
    console.log("🔑 Senha: admin123");
    console.log("🏢 Organização:", org.nome);

    await sequelize.close();
  } catch (e) {
    console.error("❌ Erro no seed:", e);
    await sequelize.close();
  }
}

seed();
