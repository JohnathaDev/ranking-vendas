/**
 * Módulo de Autenticação e UI de Sessão (auth.js):
 * Gerencia o modal de login (<dialog> nativo), botão de mostrar/ocultar senha,
 * contagem regressiva de bloqueio por tentativas compartilhada em localStorage (Item 1.1 / C5),
 * cabeçalho logado/deslogado (Item D1) e callbacks de transição após login/logout (Item D4 / 1.2).
 */

import { login, logout, getSessaoAtiva, getEstadoBloqueioLogin } from './storage.js';
import { showToast, exibirErroCampo, limparErroCampo } from './ui.js';

let intervaloContagemBloqueio = null;
let callbacks = {
  onLoginSuccess: null,
  onLogoutSuccess: null
};

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
      btnToggleSenha.setAttribute('aria-label', estaOculta ? 'Ocultar senha' : 'Mostrar senha');
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

export function fecharModalLogin() {
  const modalLogin = document.getElementById('modalLogin');
  pararContagemRegressiva();
  if (modalLogin && modalLogin.open) {
    modalLogin.close();
  }
}

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

function exibirErroGeralLogin(mensagem) {
  const erroLoginGeral = document.getElementById('erroLoginGeral');
  if (!erroLoginGeral) return;
  erroLoginGeral.textContent = String(mensagem ?? '');
  erroLoginGeral.classList.remove('hidden');
}

function pararContagemRegressiva() {
  if (intervaloContagemBloqueio !== null) {
    clearInterval(intervaloContagemBloqueio);
    intervaloContagemBloqueio = null;
  }
}

/**
 * Verifica se o login está bloqueado no localStorage (Item 1.1) e inicia a contagem regressiva de 60s.
 */
export function verificarEIniciarContagemBloqueio() {
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

    pararContagemRegressiva();
    if (inputLoginUsuario) inputLoginUsuario.disabled = false;
    if (inputLoginSenha) inputLoginSenha.disabled = false;
    if (btnSubmeterLogin) btnSubmeterLogin.disabled = false;
    if (erroLoginGeral) {
      erroLoginGeral.textContent = '';
      erroLoginGeral.classList.add('hidden');
    }
    if (inputLoginUsuario && document.getElementById('modalLogin')?.open) {
      inputLoginUsuario.focus();
    }
    return false;
  }

  pararContagemRegressiva();
  const estaBloqueado = atualizarTick();
  if (estaBloqueado) {
    intervaloContagemBloqueio = setInterval(atualizarTick, 1000);
  }
}

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
  } catch {
    const novoBloqueio = getEstadoBloqueioLogin();
    if (novoBloqueio.bloqueado) {
      verificarEIniciarContagemBloqueio();
    } else {
      if (inputLoginUsuario) inputLoginUsuario.classList.add('is-invalid');
      if (inputLoginSenha) inputLoginSenha.classList.add('is-invalid');
      exibirErroGeralLogin('Usuário ou senha inválidos.');
    }
  }
}

function handleLogout() {
  logout();
  atualizarUIEstadoAutenticacao();
  showToast('Você saiu da sua conta.', 'info');

  if (typeof callbacks.onLogoutSuccess === 'function') {
    callbacks.onLogoutSuccess();
  }
}

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

  if (tabNovaVenda) {
    tabNovaVenda.classList.toggle('hidden', !estaLogado);
  }

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

  if (btnRestaurarDemo) {
    btnRestaurarDemo.classList.toggle('hidden', !estaLogado);
  }

  return usuarioLogado;
}
