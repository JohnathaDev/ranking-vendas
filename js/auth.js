/**
 * Módulo de Autenticação e UI de Sessão (auth.js):
 * Gerencia o modal de login (<dialog> nativo), botão de mostrar/ocultar senha,
 * contagem regressiva de bloqueio por tentativas (Item C5), cabeçalho logado/deslogado (Item D1)
 * e callbacks de transição após login/logout (Item D4).
 */

import {
  login,
  logout,
  getSessaoAtiva,
  getEstadoBloqueioLogin
} from './storage.js';
import { showToast, exibirErroCampo, limparErroCampo } from './ui.js';

let intervaloContagemBloqueio = null;
let callbacks = {
  onLoginSuccess: null,
  onLogoutSuccess: null
};

/**
 * Inicializa os eventos de autenticação (botões de Entrar/Sair, modal de login e toggle de senha).
 * @param {Object} handlers
 * @param {function(Object): void} handlers.onLoginSuccess
 * @param {function(): void} handlers.onLogoutSuccess
 */
export function initAuth(handlers = {}) {
  callbacks = { ...callbacks, ...handlers };

  const btnAbrirLogin = document.getElementById('btnAbrirLogin');
  const btnEntrarNovaVenda = document.getElementById('btnEntrarNovaVenda');
  const btnLogout = document.getElementById('btnLogout');
  const modalLogin = document.getElementById('modalLogin');
  const formLogin = document.getElementById('formLogin');
  const inputLoginUsuario = document.getElementById('inputLoginUsuario');
  const inputLoginSenha = document.getElementById('inputLoginSenha');
  const btnToggleSenha = document.getElementById('btnToggleSenha');
  const btnCancelarLogin = document.getElementById('btnCancelarLogin');

  if (btnAbrirLogin) {
    btnAbrirLogin.addEventListener('click', abrirModalLogin);
  }

  if (btnEntrarNovaVenda) {
    btnEntrarNovaVenda.addEventListener('click', abrirModalLogin);
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', handleLogout);
  }

  if (btnToggleSenha && inputLoginSenha) {
    btnToggleSenha.addEventListener('click', () => {
      const estaOculta = inputLoginSenha.type === 'password';
      inputLoginSenha.type = estaOculta ? 'text' : 'password';
      btnToggleSenha.setAttribute('aria-pressed', estaOculta ? 'true' : 'false');
      btnToggleSenha.setAttribute(
        'aria-label',
        estaOculta ? 'Ocultar senha' : 'Mostrar senha'
      );
      btnToggleSenha.textContent = estaOculta ? '🙈 Ocultar' : '👁️ Mostrar';
      inputLoginSenha.focus();
    });
  }

  if (inputLoginUsuario) {
    inputLoginUsuario.addEventListener('input', () => {
      limparErrosModalLogin();
    });
  }

  if (inputLoginSenha) {
    inputLoginSenha.addEventListener('input', () => {
      limparErrosModalLogin();
    });
  }

  if (formLogin) {
    formLogin.addEventListener('submit', handleSubmitLogin);
  }

  if (btnCancelarLogin) {
    btnCancelarLogin.addEventListener('click', fecharModalLogin);
  }

  if (modalLogin) {
    modalLogin.addEventListener('cancel', () => {
      pararContagemRegressiva();
    });
    modalLogin.addEventListener('close', () => {
      pararContagemRegressiva();
      if (modalLogin) modalLogin.returnValue = '';
    });
  }

  atualizarUIEstadoAutenticacao();
}

/**
 * Abre o modal de login resetando estados visuais e verificando se há bloqueio ativo.
 */
export function abrirModalLogin() {
  const modalLogin = document.getElementById('modalLogin');
  const inputLoginUsuario = document.getElementById('inputLoginUsuario');
  const inputLoginSenha = document.getElementById('inputLoginSenha');
  const btnToggleSenha = document.getElementById('btnToggleSenha');

  if (!modalLogin) return;

  limparErrosModalLogin();

  if (inputLoginUsuario) inputLoginUsuario.value = '';
  if (inputLoginSenha) {
    inputLoginSenha.value = '';
    inputLoginSenha.type = 'password';
  }
  if (btnToggleSenha) {
    btnToggleSenha.setAttribute('aria-pressed', 'false');
    btnToggleSenha.setAttribute('aria-label', 'Mostrar senha');
    btnToggleSenha.textContent = '👁️ Mostrar';
  }

  verificarEIniciarContagemBloqueio();

  if (!modalLogin.open) {
    modalLogin.showModal();
  }

  const estadoBloqueio = getEstadoBloqueioLogin();
  if (!estadoBloqueio.bloqueado && inputLoginUsuario) {
    inputLoginUsuario.focus();
  }
}

/**
 * Fecha o modal de login e interrompe qualquer timer de contagem regressiva.
 */
export function fecharModalLogin() {
  const modalLogin = document.getElementById('modalLogin');
  pararContagemRegressiva();
  if (modalLogin && modalLogin.open) {
    modalLogin.close();
  }
}

/**
 * Limpa mensagens de erro inline do modal de login.
 */
function limparErrosModalLogin() {
  const inputLoginUsuario = document.getElementById('inputLoginUsuario');
  const inputLoginSenha = document.getElementById('inputLoginSenha');
  const erroLoginUsuario = document.getElementById('erroLoginUsuario');
  const erroLoginSenha = document.getElementById('erroLoginSenha');
  const erroLoginGeral = document.getElementById('erroLoginGeral');

  limparErroCampo(inputLoginUsuario, erroLoginUsuario);
  limparErroCampo(inputLoginSenha, erroLoginSenha);

  if (erroLoginGeral && !getEstadoBloqueioLogin().bloqueado) {
    erroLoginGeral.textContent = '';
    erroLoginGeral.classList.add('hidden');
  }
}

/**
 * Exibe erro geral no modal de login (ex: "Usuário ou senha inválidos." ou contagem regressiva).
 * @param {string} mensagem
 */
function exibirErroGeralLogin(mensagem) {
  const erroLoginGeral = document.getElementById('erroLoginGeral');
  if (!erroLoginGeral) return;
  erroLoginGeral.textContent = String(mensagem ?? '');
  erroLoginGeral.classList.remove('hidden');
}

/**
 * Para o intervalo de contagem regressiva de bloqueio.
 */
function pararContagemRegressiva() {
  if (intervaloContagemBloqueio !== null) {
    clearInterval(intervaloContagemBloqueio);
    intervaloContagemBloqueio = null;
  }
}

/**
 * Verifica se o login está temporariamente bloqueado (Item C5) e inicia a contagem regressiva de 60s.
 */
function verificarEIniciarContagemBloqueio() {
  const inputLoginUsuario = document.getElementById('inputLoginUsuario');
  const inputLoginSenha = document.getElementById('inputLoginSenha');
  const btnSubmeterLogin = document.getElementById('btnSubmeterLogin');
  const erroLoginGeral = document.getElementById('erroLoginGeral');

  function atualizarTick() {
    const estado = getEstadoBloqueioLogin();
    if (estado.bloqueado) {
      if (inputLoginUsuario) inputLoginUsuario.disabled = true;
      if (inputLoginSenha) inputLoginSenha.disabled = true;
      if (btnSubmeterLogin) btnSubmeterLogin.disabled = true;

      exibirErroGeralLogin(
        `Muitas tentativas inválidas (5 erros). Aguarde ${estado.segundosRestantes}s para tentar novamente.`
      );
      return true;
    }

    // Bloqueio expirou
    pararContagemRegressiva();
    if (inputLoginUsuario) inputLoginUsuario.disabled = false;
    if (inputLoginSenha) inputLoginSenha.disabled = false;
    if (btnSubmeterLogin) btnSubmeterLogin.disabled = false;
    if (erroLoginGeral) {
      erroLoginGeral.textContent = '';
      erroLoginGeral.classList.add('hidden');
    }
    if (inputLoginUsuario) inputLoginUsuario.focus();
    return false;
  }

  pararContagemRegressiva();
  const estaBloqueado = atualizarTick();
  if (estaBloqueado) {
    intervaloContagemBloqueio = setInterval(atualizarTick, 1000);
  }
}

/**
 * Trata a submissão do formulário de login (Item A4, C4, C5, D4).
 * @param {SubmitEvent} e
 */
async function handleSubmitLogin(e) {
  e.preventDefault();

  const estadoBloqueio = getEstadoBloqueioLogin();
  if (estadoBloqueio.bloqueado) {
    verificarEIniciarContagemBloqueio();
    return;
  }

  limparErrosModalLogin();

  const inputLoginUsuario = document.getElementById('inputLoginUsuario');
  const inputLoginSenha = document.getElementById('inputLoginSenha');
  const erroLoginUsuario = document.getElementById('erroLoginUsuario');
  const erroLoginSenha = document.getElementById('erroLoginSenha');

  const usuarioVal = inputLoginUsuario ? inputLoginUsuario.value.trim() : '';
  const senhaVal = inputLoginSenha ? inputLoginSenha.value : '';

  let hasFieldError = false;
  if (!usuarioVal) {
    exibirErroCampo(inputLoginUsuario, erroLoginUsuario, 'Informe o nome de usuário.');
    hasFieldError = true;
  }
  if (!senhaVal) {
    exibirErroCampo(inputLoginSenha, erroLoginSenha, 'Informe a senha.');
    hasFieldError = true;
  }

  if (hasFieldError) return;

  try {
    const usuarioLogado = await login(usuarioVal, senhaVal);
    fecharModalLogin();
    atualizarUIEstadoAutenticacao();
    showToast(`Bem-vindo, ${usuarioLogado.nome}! Sessão iniciada.`);

    if (typeof callbacks.onLoginSuccess === 'function') {
      callbacks.onLoginSuccess(usuarioLogado);
    }
  } catch (error) {
    const novoBloqueio = getEstadoBloqueioLogin();
    if (novoBloqueio.bloqueado) {
      verificarEIniciarContagemBloqueio();
    } else {
      if (inputLoginUsuario) inputLoginUsuario.classList.add('is-invalid');
      if (inputLoginSenha) inputLoginSenha.classList.add('is-invalid');
      // Mensagem genérica exigida pelo Item C5
      exibirErroGeralLogin('Usuário ou senha inválidos.');
    }
  }
}

/**
 * Encerra a sessão do usuário, atualiza cabeçalho e dispara callback para limpar form e ir ao Ranking (Item D4).
 */
function handleLogout() {
  logout();
  atualizarUIEstadoAutenticacao();
  showToast('Você saiu da sua conta.', 'info');

  if (typeof callbacks.onLogoutSuccess === 'function') {
    callbacks.onLogoutSuccess();
  }
}

/**
 * Sincroniza todos os elementos visuais que dependem do estado logado/deslogado (Itens D1, D3, D4).
 * @returns {{ id: string, usuario: string, nome: string, consultorId: string } | null}
 */
export function atualizarUIEstadoAutenticacao() {
  const usuarioLogado = getSessaoAtiva();
  const estaLogado = Boolean(usuarioLogado);

  const boxDeslogado = document.getElementById('authDeslogadoBox');
  const boxLogado = document.getElementById('authLogadoBox');
  const saudacaoUsuario = document.getElementById('saudacaoUsuario');
  const tabNovaVenda = document.getElementById('tabNovaVenda');
  const cardLoginNecessario = document.getElementById('cardLoginNecessario');
  const cardFormularioVenda = document.getElementById('cardFormularioVenda');
  const labelConsultorLogadoForm = document.getElementById('labelConsultorLogadoForm');
  const btnRestaurarDemo = document.getElementById('btnRestaurarDemo');

  if (boxDeslogado) {
    boxDeslogado.classList.toggle('hidden', estaLogado);
  }

  if (boxLogado) {
    boxLogado.classList.toggle('hidden', !estaLogado);
  }

  if (saudacaoUsuario) {
    saudacaoUsuario.textContent = estaLogado ? `Olá, ${usuarioLogado.nome}` : '';
  }

  // Item D1: Aba "Nova venda" só aparece no menu quando logado
  if (tabNovaVenda) {
    tabNovaVenda.classList.toggle('hidden', !estaLogado);
  }

  // Item D3: Na seção #nova-venda, visitante vê card "Faça login para cadastrar vendas"
  // e não vê o formulário de venda
  if (cardLoginNecessario) {
    cardLoginNecessario.classList.toggle('hidden', estaLogado);
  }

  if (cardFormularioVenda) {
    cardFormularioVenda.classList.toggle('hidden', !estaLogado);
    if (estaLogado) {
      cardFormularioVenda.removeAttribute('inert');
    } else {
      cardFormularioVenda.setAttribute('inert', '');
    }
  }

  if (labelConsultorLogadoForm) {
    labelConsultorLogadoForm.textContent = estaLogado ? usuarioLogado.nome : '-';
  }

  // Item D4: Botão "Restaurar dados de demonstração" no rodapé aparece somente logado
  if (btnRestaurarDemo) {
    btnRestaurarDemo.classList.toggle('hidden', !estaLogado);
  }

  return usuarioLogado;
}
