// Em produção o segredo do JWT é obrigatório: sem ele o app não inicia.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET não definido (obrigatório em produção)');
}

export const SECRET = process.env.JWT_SECRET || 'dev-secret-trocar-em-producao';
export const PAPEIS = ['cliente', 'restaurante', 'entregador'];
export const PAGAMENTOS = ['pix', 'cartao', 'dinheiro'];

// Limites de tamanho dos campos de texto (evitam abuso e tokens gigantes)
export const LIMITES = { nome: 80, email: 160, senha: 72, endereco: 200, categoria: 60, descricao: 200, observacao: 200 };

// Transições de status permitidas por papel: { statusAtual: [novosStatus] }
export const TRANSICOES = {
  restaurante: { recebido: ['preparando', 'cancelado'], preparando: ['pronto'] },
  entregador: { pronto: ['a_caminho'], a_caminho: ['entregue'] },
  cliente: { recebido: ['cancelado'] },
};
