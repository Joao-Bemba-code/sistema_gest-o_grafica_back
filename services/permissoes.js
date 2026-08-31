// ===== Definições de papéis (perfis) e permissões =====
// Módulos disponíveis no sistema
const MODULOS = [
  "comercial",   // orçamentos, clientes, faturação
  "producao",    // ordens de produção, processos
  "estoque",     // provisionamento / materiais
  "maquinas",    // maquinária
  "categorias",  // recursos / categorias
  "relatorios",  // relatórios
  "configuracao",// configurações da organização
  "utilizadores",// gestão de utilizadores e permissões
];

const ACOES = ["ver", "criar", "editar", "eliminar", "aprovar"];

function perfilAdmin() {
  const obj = {};
  MODULOS.forEach((m) => {
    obj[m] = {};
    ACOES.forEach((a) => { obj[m][a] = true; });
  });
  return obj;
}

// Perfis predefinidos. Quando `permissoes` no utilizador é null,
// usa-se o perfil por defeito através destas definições.
const PERFIS = {
  admin: { label: "Administrador", permissoes: perfilAdmin() },
  gestao: {
    label: "Gestão",
    permissoes: {
      comercial: { ver: true, criar: true, editar: true, eliminar: true, aprovar: true },
      faturacao: { ver: true, criar: true, editar: true, eliminar: true, aprovar: true },
      estoque: { ver: true, criar: true, editar: true, eliminar: true, aprovar: true },
      maquinas: { ver: true, criar: true, editar: true, eliminar: true, aprovar: true },
      categorias: { ver: true, criar: true, editar: true, eliminar: true, aprovar: true },
      producao: { ver: false, criar: false, editar: false, eliminar: false, aprovar: false },
      relatorios: { ver: false, criar: false, editar: false, eliminar: false, aprovar: false },
      configuracao: { ver: false, criar: false, editar: false, eliminar: false, aprovar: false },
      utilizadores: { ver: false, criar: false, editar: false, eliminar: false, aprovar: false },
    },
  },
  producao: {
    label: "Produção",
    permissoes: {
      producao: { ver: true, criar: true, editar: true, eliminar: false, aprovar: false },
      maquinas: { ver: false, criar: false, editar: true, eliminar: false, aprovar: false },
      comercial: { ver: false, criar: false, editar: false, eliminar: false, aprovar: false },
      faturacao: { ver: false, criar: false, editar: false, eliminar: false, aprovar: false },
      estoque: { ver: false, criar: false, editar: false, eliminar: false, aprovar: false },
      categorias: { ver: false, criar: false, editar: false, eliminar: false, aprovar: false },
      relatorios: { ver: false, criar: false, editar: false, eliminar: false, aprovar: false },
      configuracao: { ver: false, criar: false, editar: false, eliminar: false, aprovar: false },
      utilizadores: { ver: false, criar: false, editar: false, eliminar: false, aprovar: false },
    },
  },
  leitura: {
    label: "Consulta",
    permissoes: {
      comercial: { ver: true, criar: false, editar: false, eliminar: false, aprovar: false },
      faturacao: { ver: true, criar: false, editar: false, eliminar: false, aprovar: false },
      producao: { ver: true, criar: false, editar: false, eliminar: false, aprovar: false },
      estoque: { ver: true, criar: false, editar: false, eliminar: false, aprovar: false },
      maquinas: { ver: true, criar: false, editar: false, eliminar: false, aprovar: false },
      categorias: { ver: true, criar: false, editar: false, eliminar: false, aprovar: false },
      relatorios: { ver: true, criar: false, editar: false, eliminar: false, aprovar: false },
      configuracao: { ver: true, criar: false, editar: false, eliminar: false, aprovar: false },
      utilizadores: { ver: true, criar: false, editar: false, eliminar: false, aprovar: false },
    },
  },
};

// Resolve as permissões efetivas de um utilizador.
// Prioridade: campo `permissoes` (se definido) > perfil por defeito.
function permissoesDoUsuario(usuario) {
  if (!usuario) return {};
  if (usuario.perfil === "admin") return perfilAdmin();
  if (usuario.permissoes) return usuario.permissoes;
  const perfil = PERFIS[usuario.perfil] || PERFIS.producao;
  return perfil.permissoes;
}

// Verifica se o utilizador tem uma ação num módulo.
function pode(usuario, modulo, acao) {
  if (!usuario) return false;
  if (usuario.perfil === "admin") return true;
  const permissoes = permissoesDoUsuario(usuario);
  return !!(permissoes && permissoes[modulo] && permissoes[modulo][acao]);
}

module.exports = { MODULOS, ACOES, PERFIS, permissoesDoUsuario, pode };
