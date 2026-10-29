/**
 * ============================================================================
 * AVISO DE SEGURANÇA ARQUITETURAL (Item C7):
 * Este módulo implementa autenticação, hash de senha (SHA-256 via Web Crypto API),
 * controle de sessão (sessionStorage) e regras de permissão EXCLUSIVAMENTE para
 * fins demonstrativos e didáticos em ambiente front-end puro (sem servidor).
 *
 * Por executar 100% no navegador do cliente, qualquer validação ou dado em
 * localStorage/sessionStorage pode ser inspecionado ou contornado via DevTools.
 * Em um ambiente de produção real, a autenticação, o armazenamento de credenciais
 * (com bcrypt/Argon2), o controle de rate-limiting e a autorização de escrita/exclusão
 * DEVEM obrigatoriamente ser processados e validados no BACKEND (servidor/API).
 * ============================================================================
 */

import { MOTOS_CATALOG } from './catalog.js';
import {
  normalizarPlaca,
  validarPlaca,
  normalizarContrato,
  validarContrato,
  validarDataVenda,
  validarDataInput,
  obterDataHojeISO,
  DATA_MINIMA_VENDA,
  normalizarNomeConsultor,
  validarNomeConsultor
} from './utils.js';

export const SCHEMA_VERSION = 2;

export const STORAGE_KEYS = {
  SCHEMA: 'ranking_motos_schema',
  CONSULTORES: 'ranking_motos_consultores',
  VENDAS: 'ranking_motos_vendas',
  USUARIOS: 'ranking_motos_usuarios',
  CONSULTOR_ATIVO: 'ranking_motos_consultor_ativo_id',
  SESSAO: 'ranking_motos_sessao',
  TENTATIVAS_LOGIN: 'ranking_motos_login_tentativas'
};

/**
 * Credenciais públicas do usuário de demonstração (Item C1).
 * A senha nunca é salva em texto puro no storage; apenas o seu hash SHA-256 hexadecimal.
 * Hash SHA-256 de "123456": 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
 */
const DEMO_USER_CONFIG = {
  usuario: 'JoaoVitor',
  nome: 'João Vitor',
  senhaHashPadrao: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
};

const SESSAO_DURACAO_MS = 8 * 60 * 60 * 1000; // 8 horas (Item C3)
const MAX_TENTATIVAS_LOGIN = 5; // Item C5
const BLOQUEIO_LOGIN_MS = 60 * 1000; // 60 segundos (Item C5)

/**
 * Utilitário seguro para gerar UUIDv4 ou fallback.
 * @returns {string}
 */
function gerarUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Lê e faz parse seguro de dados do localStorage.
 * @param {string} key Chave do localStorage
 * @param {*} fallback Valor padrão caso não exista
 * @returns {*}
 */
function getItem(key, fallback = null) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (error) {
    console.error(`Erro ao ler chave ${key} do localStorage:`, error);
    return fallback;
  }
}

/**
 * Grava dados serializados no localStorage.
 * @param {string} key Chave do localStorage
 * @param {*} value Dados a serem gravados
 * @returns {boolean}
 */
function setItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Erro ao gravar chave ${key} no localStorage:`, error);
    throw new Error('Falha ao persistir dados no armazenamento local.');
  }
}

/**
 * Lê dados do sessionStorage com segurança.
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
function getSessionItem(key, fallback = null) {
  try {
    const data = sessionStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch (error) {
    console.error(`Erro ao ler chave ${key} do sessionStorage:`, error);
    return fallback;
  }
}

/**
 * Grava dados no sessionStorage com segurança.
 * @param {string} key
 * @param {*} value
 */
function setSessionItem(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Erro ao gravar chave ${key} no sessionStorage:`, error);
  }
}

/**
 * Calcula o hash SHA-256 em hexadecimal utilizando crypto.subtle.digest (Item C4).
 * @param {string} texto Texto de entrada (case-sensitive)
 * @returns {Promise<string>} Hash SHA-256 em formato hexadecimal minúsculo
 */
export async function gerarHashSHA256(texto) {
  const str = String(texto ?? '');
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const encoder = new TextEncoder();
    const dados = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dados);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback SHA-256 puro caso o navegador bloqueie crypto.subtle em contexto HTTP não-localhost
  return sha256Fallback(str);
}

/**
 * Implementação SHA-256 padrão FIPS 180-4 como fallback apenas quando crypto.subtle não está disponível.
 * @param {string} ascii
 * @returns {string}
 */
function sha256Fallback(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words = [];
  const encoder = new TextEncoder();
  const bytes = encoder.encode(ascii);
  const asciiBitLength = bytes.length * 8;

  let hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  const padded = new Uint8Array((((bytes.length + 8) >> 6) + 1) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  for (let i = 0; i < padded.length; i++) {
    words[i >> 2] |= padded[i] << ((3 - (i % 4)) * 8);
  }
  words[words.length - 2] = Math.floor(asciiBitLength / maxWord);
  words[words.length - 1] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }
    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

// ==========================================
// OPERAÇÕES DE CONSULTORES
// ==========================================

/**
 * Retorna todos os consultores cadastrados.
 * @returns {Array<{ id: string, nome: string }>}
 */
export function getConsultores() {
  return getItem(STORAGE_KEYS.CONSULTORES, []);
}

/**
 * Adiciona um novo consultor com validação de tamanho e unicidade (mantida para seed/migração — Item D2).
 * @param {string} nome Nome do consultor
 * @returns {{ id: string, nome: string }} Consultor recém-criado
 */
export function addConsultor(nome) {
  if (!nome || typeof nome !== 'string') {
    throw new Error('O nome do consultor é obrigatório.');
  }

  const nomeLimpo = nome.trim();

  if (!validarNomeConsultor(nomeLimpo)) {
    throw new Error('O nome do consultor deve conter entre 3 e 60 caracteres.');
  }

  const consultores = getConsultores();
  const nomeNormalizado = normalizarNomeConsultor(nomeLimpo);

  const jaExiste = consultores.some(
    (c) => c && normalizarNomeConsultor(c.nome) === nomeNormalizado
  );

  if (jaExiste) {
    throw new Error(`Já existe um consultor cadastrado com o nome "${nomeLimpo}".`);
  }

  const novoConsultor = {
    id: gerarUUID(),
    nome: nomeLimpo
  };

  consultores.push(novoConsultor);
  setItem(STORAGE_KEYS.CONSULTORES, consultores);

  return novoConsultor;
}

/**
 * Retorna o ID do consultor selecionado para visualização no painel.
 * @returns {string|null}
 */
export function getConsultorAtivoId() {
  try {
    return localStorage.getItem(STORAGE_KEYS.CONSULTOR_ATIVO) || null;
  } catch {
    return null;
  }
}

/**
 * Salva o ID do consultor selecionado para visualização no painel.
 * @param {string|null} id
 */
export function setConsultorAtivoId(id) {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.CONSULTOR_ATIVO, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CONSULTOR_ATIVO);
    }
  } catch (error) {
    console.error('Erro ao salvar consultor ativo:', error);
  }
}

// ==========================================
// OPERAÇÕES DE USUÁRIOS E SESSÃO (PARTE C)
// ==========================================

/**
 * Retorna todos os usuários cadastrados no storage.
 * Modelo Usuario: { id, usuario, nome, senhaHash, consultorId } (Item C3)
 * @returns {Array<{ id: string, usuario: string, nome: string, senhaHash: string, consultorId: string }>}
 */
export function getUsuarios() {
  return getItem(STORAGE_KEYS.USUARIOS, []);
}

/**
 * Retorna o estado atual de bloqueio de tentativas de login (Item C5).
 * @returns {{ bloqueado: boolean, segundosRestantes: number, falhas: number }}
 */
export function getEstadoBloqueioLogin() {
  const dados = getSessionItem(STORAGE_KEYS.TENTATIVAS_LOGIN, {
    falhas: 0,
    bloqueadoAte: null
  });

  const agora = Date.now();

  if (dados.bloqueadoAte && agora < dados.bloqueadoAte) {
    const segundosRestantes = Math.max(1, Math.ceil((dados.bloqueadoAte - agora) / 1000));
    return {
      bloqueado: true,
      segundosRestantes,
      falhas: dados.falhas || MAX_TENTATIVAS_LOGIN
    };
  }

  // Se o tempo de bloqueio já expirou, limpa o bloqueio e zera a contagem
  if (dados.bloqueadoAte && agora >= dados.bloqueadoAte) {
    limparTentativasLogin();
    return { bloqueado: false, segundosRestantes: 0, falhas: 0 };
  }

  return {
    bloqueado: false,
    segundosRestantes: 0,
    falhas: Number(dados.falhas) || 0
  };
}

/**
 * Registra uma falha de login e ativa o bloqueio de 60s ao atingir 5 erros seguidos (Item C5).
 * @returns {{ bloqueado: boolean, segundosRestantes: number, falhas: number }}
 */
function registrarFalhaLogin() {
  const estadoAtual = getEstadoBloqueioLogin();
  if (estadoAtual.bloqueado) {
    return estadoAtual;
  }

  const novasFalhas = estadoAtual.falhas + 1;
  if (novasFalhas >= MAX_TENTATIVAS_LOGIN) {
    const bloqueadoAte = Date.now() + BLOQUEIO_LOGIN_MS;
    setSessionItem(STORAGE_KEYS.TENTATIVAS_LOGIN, {
      falhas: novasFalhas,
      bloqueadoAte
    });
    return {
      bloqueado: true,
      segundosRestantes: Math.ceil(BLOQUEIO_LOGIN_MS / 1000),
      falhas: novasFalhas
    };
  }

  setSessionItem(STORAGE_KEYS.TENTATIVAS_LOGIN, {
    falhas: novasFalhas,
    bloqueadoAte: null
  });

  return {
    bloqueado: false,
    segundosRestantes: 0,
    falhas: novasFalhas
  };
}

/**
 * Reseta o contador de tentativas de login.
 */
export function limparTentativasLogin() {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.TENTATIVAS_LOGIN);
  } catch (error) {
    console.error('Erro ao limpar tentativas de login:', error);
  }
}

/**
 * Retorna o usuário autenticado na sessão ativa ou null (Item C3).
 * Descarta automaticamente sessões expiradas (8h) ou vinculadas a usuários/consultores inexistentes.
 * @returns {{ id: string, usuario: string, nome: string, consultorId: string } | null}
 */
export function getSessaoAtiva() {
  const sessao = getSessionItem(STORAGE_KEYS.SESSAO, null);
  if (!sessao || typeof sessao !== 'object' || !sessao.usuarioId || !sessao.expiraEm) {
    return null;
  }

  const agora = Date.now();
  const expiraEmMs =
    typeof sessao.expiraEm === 'number'
      ? sessao.expiraEm
      : new Date(sessao.expiraEm).getTime();

  if (isNaN(expiraEmMs) || agora >= expiraEmMs) {
    logout();
    return null;
  }

  const usuarios = getUsuarios();
  const usuarioEncontrado = usuarios.find((u) => u && u.id === sessao.usuarioId);
  if (!usuarioEncontrado) {
    logout();
    return null;
  }

  const consultores = getConsultores();
  const consultorExiste = consultores.some((c) => c && c.id === usuarioEncontrado.consultorId);
  if (!consultorExiste) {
    logout();
    return null;
  }

  return {
    id: usuarioEncontrado.id,
    usuario: usuarioEncontrado.usuario,
    nome: usuarioEncontrado.nome,
    consultorId: usuarioEncontrado.consultorId
  };
}

/**
 * Autentica um usuário verificando hash SHA-256 e limite de tentativas (Itens C3, C4 e C5).
 * Usuário é comparado sem diferenciar maiúsculas/minúsculas; senha diferencia.
 * @param {string} usuarioInput Nome de usuário
 * @param {string} senhaInput Senha em texto puro (case-sensitive)
 * @returns {Promise<{ id: string, usuario: string, nome: string, consultorId: string }>}
 */
export async function login(usuarioInput, senhaInput) {
  const estadoBloqueio = getEstadoBloqueioLogin();
  if (estadoBloqueio.bloqueado) {
    const erroBloqueio = new Error(
      `Muitas tentativas inválidas. Aguarde ${estadoBloqueio.segundosRestantes}s para tentar novamente.`
    );
    erroBloqueio.code = 'AUTH_LOCKED';
    erroBloqueio.segundosRestantes = estadoBloqueio.segundosRestantes;
    throw erroBloqueio;
  }

  const usuarioNormalizado = typeof usuarioInput === 'string' ? usuarioInput.trim().toLowerCase() : '';
  const senhaBruta = typeof senhaInput === 'string' ? senhaInput : '';

  if (!usuarioNormalizado || !senhaBruta) {
    const novoEstado = registrarFalhaLogin();
    const erro = new Error('Usuário ou senha inválidos.');
    erro.estadoBloqueio = novoEstado;
    throw erro;
  }

  const senhaHashDigitada = await gerarHashSHA256(senhaBruta);
  const usuarios = getUsuarios();

  const usuarioValido = usuarios.find(
    (u) =>
      u &&
      typeof u.usuario === 'string' &&
      u.usuario.trim().toLowerCase() === usuarioNormalizado &&
      u.senhaHash === senhaHashDigitada
  );

  if (!usuarioValido) {
    const novoEstado = registrarFalhaLogin();
    const erro = new Error('Usuário ou senha inválidos.');
    erro.estadoBloqueio = novoEstado;
    throw erro;
  }

  limparTentativasLogin();

  const sessao = {
    usuarioId: usuarioValido.id,
    expiraEm: Date.now() + SESSAO_DURACAO_MS
  };

  setSessionItem(STORAGE_KEYS.SESSAO, sessao);
  setConsultorAtivoId(usuarioValido.consultorId);

  return {
    id: usuarioValido.id,
    usuario: usuarioValido.usuario,
    nome: usuarioValido.nome,
    consultorId: usuarioValido.consultorId
  };
}

/**
 * Encerra a sessão ativa no sessionStorage (Item C3).
 */
export function logout() {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.SESSAO);
  } catch (error) {
    console.error('Erro ao encerrar sessão:', error);
  }
}

// ==========================================
// OPERAÇÕES DE VENDAS (COM PERMISSÕES C6)
// ==========================================

/**
 * Retorna todas as vendas cadastradas.
 * @returns {Array<Object>}
 */
export function getVendas() {
  return getItem(STORAGE_KEYS.VENDAS, []);
}

/**
 * Retorna apenas as vendas de um consultor específico.
 * @param {string} consultorId ID do consultor
 * @returns {Array<Object>}
 */
export function getVendasPorConsultor(consultorId) {
  if (!consultorId) return [];
  const todas = getVendas();
  return todas.filter((venda) => venda && venda.consultorId === consultorId);
}

/**
 * Verifica se já existe uma venda com determinada placa.
 * Mantida exportada por compatibilidade, mas NÃO é usada como bloqueio (Item B1).
 * @param {string} placaRaw
 * @param {string} [ignoreVendaId=null]
 * @returns {boolean}
 */
export function isPlacaExistente(placaRaw, ignoreVendaId = null) {
  if (!placaRaw) return false;
  const placa = normalizarPlaca(placaRaw);
  const vendas = getVendas();
  return vendas.some(
    (venda) => venda && normalizarPlaca(venda.placa) === placa && venda.id !== ignoreVendaId
  );
}

/**
 * Verifica se já existe uma venda com determinado número de contrato.
 * Comparação sem diferenciar maiúsculas/minúsculas e ignorando espaços nas pontas (Item B2).
 * @param {string} contrato
 * @param {string} [ignoreVendaId=null]
 * @returns {boolean}
 */
export function isContratoExistente(contrato, ignoreVendaId = null) {
  if (!contrato || typeof contrato !== 'string') return false;
  const contratoNormalizado = normalizarContrato(contrato);
  if (!contratoNormalizado) return false;

  const vendas = getVendas();
  return vendas.some(
    (venda) =>
      venda &&
      typeof venda.numeroContrato === 'string' &&
      normalizarContrato(venda.numeroContrato) === contratoNormalizado &&
      venda.id !== ignoreVendaId
  );
}

/**
 * Adiciona uma nova venda aplicando regras de permissão da sessão ativa (Item C6),
 * permitindo placas repetidas (Item B1), garantindo contrato único (Item B2)
 * e validando data mínima 2023-01-01 e máxima hoje (Item A2).
 * @param {Object} dadosVenda Dados da venda
 * @returns {Object} Venda gravada
 */
export function addVenda(dadosVenda) {
  // 1. Regra de permissão (Item C6): exige sessão ativa e força consultorId do usuário logado
  const usuarioLogado = getSessaoAtiva();
  if (!usuarioLogado) {
    throw new Error('Acesso negado: faça login para registrar uma venda.');
  }

  if (!dadosVenda || typeof dadosVenda !== 'object') {
    throw new Error('Dados da venda inválidos.');
  }

  // Ignora qualquer consultorId externo e usa sempre o consultor do usuário autenticado (Item C6)
  const consultorId = usuarioLogado.consultorId;
  const { placa, numeroContrato, modelo, anoModelo, dataVenda } = dadosVenda;

  const consultores = getConsultores();
  const consultorExiste = consultores.some((c) => c && c.id === consultorId);
  if (!consultorExiste) {
    throw new Error('O consultor vinculado ao usuário logado não existe no sistema.');
  }

  // 2. Validação da placa (Item B1: formato obrigatório, mas placas repetidas são permitidas)
  if (!placa || typeof placa !== 'string' || !validarPlaca(placa)) {
    throw new Error('Placa inválida. Utilize o formato Mercosul (ABC1D23) ou antigo (ABC1234/ABC-1234).');
  }
  const placaNormalizada = normalizarPlaca(placa);

  // 3. Validação de formato e unicidade do contrato (Item B2)
  if (!numeroContrato || typeof numeroContrato !== 'string' || !validarContrato(numeroContrato)) {
    throw new Error('Número de contrato inválido. Permitido apenas letras e números, sem espaços.');
  }
  const contratoLimpo = numeroContrato.trim();
  if (isContratoExistente(contratoLimpo)) {
    throw new Error(`O número de contrato "${contratoLimpo}" já está cadastrado no sistema.`);
  }

  // 4. Validação de modelo e ano modelo contra o catálogo
  if (!modelo || typeof modelo !== 'string') {
    throw new Error('O modelo da moto é obrigatório.');
  }
  const modeloLimpo = modelo.trim();
  const itemCatalogo = MOTOS_CATALOG.find((m) => m.modelo === modeloLimpo);
  if (!itemCatalogo) {
    throw new Error(`O modelo "${modeloLimpo}" não pertence ao catálogo oficial.`);
  }

  const anoNumero = Number(anoModelo);
  if (isNaN(anoNumero) || !itemCatalogo.anos.includes(anoNumero)) {
    throw new Error(
      `O ano ${anoModelo} não é válido para o modelo "${modeloLimpo}". Anos válidos: ${itemCatalogo.anos.join(', ')}.`
    );
  }

  // 5. Validação de data da venda (Item A2: entre 2023-01-01 e hoje)
  const dataFinal = dataVenda || new Date().toISOString();
  const dataObj = new Date(dataFinal);
  if (isNaN(dataObj.getTime())) {
    throw new Error('Data de venda inválida.');
  }

  const dataYMD = obterDataHojeISO(dataObj);
  if (dataYMD < DATA_MINIMA_VENDA) {
    throw new Error('A data da venda não pode ser anterior a 01/01/2023.');
  }

  if (!validarDataInput(dataYMD) || !validarDataVenda(dataFinal)) {
    throw new Error('Data de venda inválida ou posterior à data de hoje.');
  }

  const novaVenda = {
    id: gerarUUID(),
    consultorId,
    placa: placaNormalizada,
    numeroContrato: contratoLimpo,
    modelo: modeloLimpo,
    anoModelo: anoNumero,
    dataVenda: dataFinal
  };

  const vendas = getVendas();
  vendas.push(novaVenda);
  setItem(STORAGE_KEYS.VENDAS, vendas);

  return novaVenda;
}

/**
 * Exclui uma venda pelo ID, validando sessão ativa e propriedade da venda (Item C6).
 * @param {string} id ID da venda
 * @returns {boolean} True se a venda foi removida com sucesso
 */
export function deleteVenda(id) {
  const usuarioLogado = getSessaoAtiva();
  if (!usuarioLogado) {
    throw new Error('Acesso negado: faça login para excluir uma venda.');
  }

  if (!id) {
    throw new Error('ID da venda não informado.');
  }

  const vendas = getVendas();
  const index = vendas.findIndex((v) => v && v.id === id);

  if (index === -1) {
    return false;
  }

  const vendaAlvo = vendas[index];
  if (vendaAlvo.consultorId !== usuarioLogado.consultorId) {
    throw new Error('Permissão negada: você só pode excluir vendas registradas por você.');
  }

  vendas.splice(index, 1);
  setItem(STORAGE_KEYS.VENDAS, vendas);
  return true;
}

// ==========================================
// SEED E MIGRAÇÃO DE SCHEMA (ITENS A1, C1, C2, D4)
// ==========================================

/**
 * Gera placa Mercosul fictícia.
 * @param {Set<string>} placasUsadas
 * @returns {string} Placa no formato ABC1D23
 */
function gerarPlacaFicticia(placasUsadas) {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digitos = '0123456789';

  let placa = '';
  let tentativas = 0;
  do {
    const l1 = letras[Math.floor(Math.random() * letras.length)];
    const l2 = letras[Math.floor(Math.random() * letras.length)];
    const l3 = letras[Math.floor(Math.random() * letras.length)];
    const n1 = digitos[Math.floor(Math.random() * digitos.length)];
    const l4 = letras[Math.floor(Math.random() * letras.length)];
    const n2 = digitos[Math.floor(Math.random() * digitos.length)];
    const n3 = digitos[Math.floor(Math.random() * digitos.length)];
    placa = `${l1}${l2}${l3}${n1}${l4}${n2}${n3}`;
    tentativas++;
  } while (placasUsadas.has(placa) && tentativas < 50);

  placasUsadas.add(placa);
  return placa;
}

/**
 * Calcula os marcos temporais seguros para geração de vendas no seed (Item A1).
 * Se rodar exatamente à meia-noite (00:00:00.000), usa agora - 1 segundo.
 * @param {Date} [dataRef=new Date()]
 * @returns {{ agora: Date, inicioHoje: Date, inicioSemana: Date }}
 */
export function obterLimitesTemporaisSeed(dataRef = new Date()) {
  let agora = new Date(dataRef.getTime());
  const meiaNoiteAtual = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
    0,
    0,
    0,
    0
  );

  // Item A1: Se o seed rodar exatamente à meia-noite, usar agora - 1 segundo
  if (agora.getTime() === meiaNoiteAtual.getTime()) {
    agora = new Date(agora.getTime() - 1000);
  }

  const inicioHoje = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate(),
    0,
    0,
    0,
    0
  );

  const diaSemana = agora.getDay(); // 0 = Domingo, 1 = Segunda...
  const diffSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  const inicioSemana = new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate() + diffSegunda,
    0,
    0,
    0,
    0
  );

  return { agora, inicioHoje, inicioSemana };
}

/**
 * Sorteia um instante (Date) estritamente dentro do intervalo [inicio, fim] (Item A1).
 * Nunca retorna horário antes de `inicio` nem depois de `fim`.
 * @param {Date} inicio
 * @param {Date} fim
 * @returns {Date}
 */
export function sortearDataNoIntervalo(inicio, fim) {
  const minMs = inicio.getTime();
  const maxMs = Math.max(minMs, fim.getTime());
  const delta = maxMs - minMs;
  const sorteadoMs = minMs + Math.floor(Math.random() * (delta + 1));
  return new Date(Math.min(sorteadoMs, maxMs));
}

/**
 * Descobre o maior número sequencial de contrato existente (ex: CT1040 -> 1040)
 * para evitar colisões em migrações ou seeds.
 * @param {Array<Object>} vendas
 * @returns {number}
 */
function obterMaiorSequenciaContrato(vendas) {
  let maxSeq = 1000;
  if (!Array.isArray(vendas)) return maxSeq;

  vendas.forEach((v) => {
    if (!v || typeof v.numeroContrato !== 'string') return;
    const match = v.numeroContrato.trim().toUpperCase().match(/^CT(\d+)$/);
    if (match) {
      const num = Number(match[1]);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });

  return maxSeq;
}

/**
 * Gera um conjunto de vendas fictícias para uma lista de consultores seguindo a regra A1:
 * - Pelo menos 1 venda "de hoje" sorteada entre 00:00 de hoje e agora
 * - Pelo menos 2 vendas "da semana" (1 hoje + pelo menos 1 entre segunda-feira 00:00 e agora)
 * - Demais vendas distribuídas nos últimos 45 dias.
 * @param {Array<{ id: string, nome: string }>} consultores
 * @param {number} totalVendasPorConsultor
 * @param {number} contratoSeqInicial
 * @param {Set<string>} contratosUsados
 * @param {Date} [dataRef=new Date()]
 * @returns {Array<Object>}
 */
function gerarVendasParaConsultores(
  consultores,
  totalVendasPorConsultor,
  contratoSeqInicial,
  contratosUsados,
  dataRef = new Date()
) {
  const { agora, inicioHoje, inicioSemana } = obterLimitesTemporaisSeed(dataRef);
  const vendasGeradas = [];
  const placasUsadas = new Set();
  let seq = contratoSeqInicial;

  function proximoContratoUnico() {
    let codigo = '';
    do {
      seq++;
      codigo = `CT${seq}`;
    } while (contratosUsados.has(codigo));
    contratosUsados.add(codigo);
    return codigo;
  }

  function montarVenda(consultorId, dataObj) {
    const itemCatalogo = MOTOS_CATALOG[Math.floor(Math.random() * MOTOS_CATALOG.length)];
    const modelo = itemCatalogo.modelo;
    const anoModelo = itemCatalogo.anos[Math.floor(Math.random() * itemCatalogo.anos.length)];
    return {
      id: gerarUUID(),
      consultorId,
      placa: gerarPlacaFicticia(placasUsadas),
      numeroContrato: proximoContratoUnico(),
      modelo,
      anoModelo,
      dataVenda: dataObj.toISOString()
    };
  }

  consultores.forEach((consultor) => {
    // 1. Venda de HOJE: sorteada estritamente entre 00:00 de hoje e agora (Item A1)
    const dataHoje = sortearDataNoIntervalo(inicioHoje, agora);
    vendasGeradas.push(montarVenda(consultor.id, dataHoje));

    // 2. Segunda venda da SEMANA: sorteada estritamente entre segunda-feira 00:00 e agora (Item A1)
    const dataSemana = sortearDataNoIntervalo(inicioSemana, agora);
    vendasGeradas.push(montarVenda(consultor.id, dataSemana));

    // 3. Terceira venda também na semana atual para enriquecer os dados semanais
    const dataSemanaExtra = sortearDataNoIntervalo(inicioSemana, agora);
    vendasGeradas.push(montarVenda(consultor.id, dataSemanaExtra));

    // 4. Vendas restantes distribuídas nos últimos 45 dias (entre 44 dias atrás e agora)
    const restantes = Math.max(0, totalVendasPorConsultor - 3);
    const limitePassado = new Date(
      inicioHoje.getFullYear(),
      inicioHoje.getMonth(),
      inicioHoje.getDate() - 44,
      8,
      0,
      0,
      0
    );

    for (let i = 0; i < restantes; i++) {
      const dataHistorica = sortearDataNoIntervalo(limitePassado, agora);
      vendasGeradas.push(montarVenda(consultor.id, dataHistorica));
    }
  });

  return vendasGeradas;
}

/**
 * Executa o seed completo do sistema (5 consultores incluindo João Vitor, ~40 vendas + 8 de João Vitor,
 * usuário JoaoVitor com senha hash SHA-256 e schema = 2).
 * @param {Date} [dataRef=new Date()]
 */
function executarSeedCompleto(dataRef = new Date()) {
  const consultoresIniciais = [
    { id: gerarUUID(), nome: DEMO_USER_CONFIG.nome },
    { id: gerarUUID(), nome: 'Carlos Silva' },
    { id: gerarUUID(), nome: 'Mariana Souza' },
    { id: gerarUUID(), nome: 'Roberto Almeida' },
    { id: gerarUUID(), nome: 'Juliana Ferreira' }
  ];

  const consultorJoao = consultoresIniciais[0];
  setItem(STORAGE_KEYS.CONSULTORES, consultoresIniciais);

  // Cria usuário de demonstração vinculado ao consultor João Vitor (Item C1)
  const usuariosIniciais = [
    {
      id: gerarUUID(),
      usuario: DEMO_USER_CONFIG.usuario,
      nome: DEMO_USER_CONFIG.nome,
      senhaHash: DEMO_USER_CONFIG.senhaHashPadrao,
      consultorId: consultorJoao.id
    }
  ];
  setItem(STORAGE_KEYS.USUARIOS, usuariosIniciais);

  // Gera ~8 vendas para cada um dos 5 consultores (total 40 vendas, sendo 8 de João Vitor)
  const contratosUsados = new Set();
  const vendasSeed = gerarVendasParaConsultores(
    consultoresIniciais,
    8,
    1000,
    contratosUsados,
    dataRef
  );

  // Ordena por data decrescente
  vendasSeed.sort((a, b) => new Date(b.dataVenda) - new Date(a.dataVenda));
  setItem(STORAGE_KEYS.VENDAS, vendasSeed);
  setItem(STORAGE_KEYS.SCHEMA, SCHEMA_VERSION);

  setConsultorAtivoId(consultorJoao.id);
}

/**
 * Migra dados da Etapa 1 (sem schema v2 ou sem usuário JoaoVitor) para o schema v2
 * SEM apagar consultores ou vendas existentes (Item C2).
 * @param {Date} [dataRef=new Date()]
 */
function migrarParaSchemaV2(dataRef = new Date()) {
  const consultores = getConsultores();
  const vendas = getVendas();
  const usuarios = getUsuarios();

  const nomeJoaoNorm = normalizarNomeConsultor(DEMO_USER_CONFIG.nome);
  let consultorJoao = consultores.find(
    (c) => c && normalizarNomeConsultor(c.nome) === nomeJoaoNorm
  );

  let consultorCriadoAgora = false;
  if (!consultorJoao) {
    consultorJoao = {
      id: gerarUUID(),
      nome: DEMO_USER_CONFIG.nome
    };
    consultores.unshift(consultorJoao);
    setItem(STORAGE_KEYS.CONSULTORES, consultores);
    consultorCriadoAgora = true;
  }

  // Garante que o usuário JoaoVitor exista e aponte para o consultor João Vitor
  const loginNorm = DEMO_USER_CONFIG.usuario.toLowerCase();
  const idxUsuario = usuarios.findIndex(
    (u) => u && typeof u.usuario === 'string' && u.usuario.trim().toLowerCase() === loginNorm
  );

  if (idxUsuario === -1) {
    usuarios.push({
      id: gerarUUID(),
      usuario: DEMO_USER_CONFIG.usuario,
      nome: DEMO_USER_CONFIG.nome,
      senhaHash: DEMO_USER_CONFIG.senhaHashPadrao,
      consultorId: consultorJoao.id
    });
    setItem(STORAGE_KEYS.USUARIOS, usuarios);
  } else if (usuarios[idxUsuario].consultorId !== consultorJoao.id) {
    usuarios[idxUsuario].consultorId = consultorJoao.id;
    setItem(STORAGE_KEYS.USUARIOS, usuarios);
  }

  // Se o consultor João Vitor acabou de ser criado na migração e não possui vendas,
  // adiciona as ~8 vendas demonstrativas dele preservando 100% das vendas existentes
  const vendasJoao = vendas.filter((v) => v && v.consultorId === consultorJoao.id);
  if (consultorCriadoAgora && vendasJoao.length === 0) {
    const contratosUsados = new Set(
      vendas
        .filter((v) => v && typeof v.numeroContrato === 'string')
        .map((v) => normalizarContrato(v.numeroContrato))
    );
    const maiorSeq = obterMaiorSequenciaContrato(vendas);
    const novasVendasJoao = gerarVendasParaConsultores(
      [consultorJoao],
      8,
      maiorSeq,
      contratosUsados,
      dataRef
    );
    const todasVendas = [...vendas, ...novasVendasJoao].sort(
      (a, b) => new Date(b.dataVenda) - new Date(a.dataVenda)
    );
    setItem(STORAGE_KEYS.VENDAS, todasVendas);
  }

  if (!getConsultorAtivoId() && consultores.length > 0) {
    setConsultorAtivoId(consultorJoao.id);
  }

  setItem(STORAGE_KEYS.SCHEMA, SCHEMA_VERSION);
}

/**
 * Inicializa o seed se o localStorage estiver vazio OU executa a migração não-destrutiva
 * caso já existam dados de versões anteriores (Itens A1, C1 e C2).
 * @param {Date} [dataRef=new Date()]
 */
export function inicializarSeedSeNecessario(dataRef = new Date()) {
  const consultoresExistentes = getConsultores();
  const vendasExistentes = getVendas();
  const schemaAtual = getItem(STORAGE_KEYS.SCHEMA, null);
  const usuariosExistentes = getUsuarios();

  // Caso 1: Armazenamento vazio -> roda seed completo da Etapa 2
  if (consultoresExistentes.length === 0 && vendasExistentes.length === 0) {
    executarSeedCompleto(dataRef);
    return;
  }

  // Caso 2: Já existem dados no storage -> nunca roda o seed completo de novo!
  // Verifica se precisa migrar para o schema 2 ou recriar o vínculo do usuário JoaoVitor
  const temJoaoUsuario = usuariosExistentes.some(
    (u) =>
      u &&
      typeof u.usuario === 'string' &&
      u.usuario.trim().toLowerCase() === DEMO_USER_CONFIG.usuario.toLowerCase()
  );
  const temJoaoConsultor = consultoresExistentes.some(
    (c) => c && normalizarNomeConsultor(c.nome) === normalizarNomeConsultor(DEMO_USER_CONFIG.nome)
  );

  if (schemaAtual !== SCHEMA_VERSION || !temJoaoUsuario || !temJoaoConsultor) {
    migrarParaSchemaV2(dataRef);
  }
}

/**
 * Restaura os dados de demonstração apagando os registros atuais e recriando
 * o seed inicial + usuário JoaoVitor (Item D4).
 * Requer sessão ativa; após recriar, renova a sessão para o novo ID do usuário JoaoVitor.
 * @param {Date} [dataRef=new Date()]
 */
export function resetarDadosDemonstracao(dataRef = new Date()) {
  const sessaoAntes = getSessaoAtiva();
  if (!sessaoAntes) {
    throw new Error('Acesso negado: apenas usuários autenticados podem restaurar os dados de demonstração.');
  }

  localStorage.removeItem(STORAGE_KEYS.CONSULTORES);
  localStorage.removeItem(STORAGE_KEYS.VENDAS);
  localStorage.removeItem(STORAGE_KEYS.USUARIOS);
  localStorage.removeItem(STORAGE_KEYS.SCHEMA);
  localStorage.removeItem(STORAGE_KEYS.CONSULTOR_ATIVO);

  executarSeedCompleto(dataRef);

  // Mantém o usuário JoaoVitor logado atualizando o usuarioId da sessão para o novo registro
  const usuariosNovos = getUsuarios();
  const novoJoao = usuariosNovos.find(
    (u) => u.usuario.toLowerCase() === DEMO_USER_CONFIG.usuario.toLowerCase()
  );

  if (novoJoao) {
    setSessionItem(STORAGE_KEYS.SESSAO, {
      usuarioId: novoJoao.id,
      expiraEm: Date.now() + SESSAO_DURACAO_MS
    });
    setConsultorAtivoId(novoJoao.consultorId);
  }
}
