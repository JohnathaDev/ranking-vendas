/**
 * Monitoramento proativo da expiração da sessão ativa (sessao.js).
 * Gerencia o timer de expiração (8h) e a verificação ao retomar a visibilidade da aba.
 */

import { getSessaoAtiva, limparSessaoInvalida, obterMsAteExpirarSessao } from './storage.js';

const MAX_TIMEOUT_DELAY_MS = 2147483647;
let timerExpiracaoSessao = null;
let callbackSessaoExpirada = null;

function notificarSessaoExpirada() {
  limparTimerExpiracaoSessao();
  limparSessaoInvalida();
  if (typeof callbackSessaoExpirada === 'function') {
    callbackSessaoExpirada();
  }
}

export function limparTimerExpiracaoSessao() {
  if (timerExpiracaoSessao !== null) {
    clearTimeout(timerExpiracaoSessao);
    timerExpiracaoSessao = null;
  }
}

export function agendarVerificacaoExpiracaoSessao() {
  limparTimerExpiracaoSessao();
  const msRestantes = obterMsAteExpirarSessao();
  if (msRestantes === null) return;

  if (msRestantes <= 0) {
    notificarSessaoExpirada();
    return;
  }

  const delayMs = Math.min(msRestantes + 50, MAX_TIMEOUT_DELAY_MS);
  timerExpiracaoSessao = setTimeout(() => {
    const sessao = getSessaoAtiva();
    if (!sessao) {
      notificarSessaoExpirada();
    } else {
      agendarVerificacaoExpiracaoSessao();
    }
  }, delayMs);
}

export function initMonitorSessao({ onSessaoExpirada } = {}) {
  callbackSessaoExpirada = typeof onSessaoExpirada === 'function' ? onSessaoExpirada : null;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const msRestantes = obterMsAteExpirarSessao();
      if (msRestantes !== null && msRestantes <= 0) {
        notificarSessaoExpirada();
      } else {
        agendarVerificacaoExpiracaoSessao();
      }
    }
  });
}
