const xss = require("xss");

// Sanitização por lista branca para HTML rico fornecido pelo utilizador
// (ex.: template de contrato). O `xss()` por omissão é demasiado permissivo
// para conteúdo guardado e depois renderizado noutros clientes; aqui só
// sobrevivem as etiquetas/atributos estritamente necessários à formatação.
const TAGS_PERMITIDAS = [
  "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "sub", "sup",
  "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "span", "div", "font", "center",
];

const ATRIBUTOS_PERMITIDOS = [
  "style", "align", "colspan", "rowspan", "width", "height", "class",
];

const opcoes = {
  whiteList: Object.fromEntries(TAGS_PERMITIDAS.map((t) => [t, ATRIBUTOS_PERMITIDOS])),
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style", "iframe", "object", "embed"],
  allowCommentTag: false,
  onTagAttr(tag, name, value) {
    if (name !== "style") return undefined;
    // Estilos inline limitados a propriedades de formatação. Remove
    // expressões/url() que permitiriam carregar recursos externos.
    const limpo = String(value)
      .replace(/expression\s*\(/gi, "")
      .replace(/url\s*\(/gi, "")
      .replace(/javascript\s*:/gi, "")
      .slice(0, 1000);
    return `${name}="${limpo}"`;
  },
};

function sanitizarHtml(valor) {
  if (valor === undefined || valor === null) return valor;
  if (typeof valor !== "string") return valor;
  return xss(valor, opcoes);
}

module.exports = { sanitizarHtml };
