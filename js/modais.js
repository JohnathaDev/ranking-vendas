/**
 * Modais de confirmação de exclusão de venda e restauração da demonstração (modais.js).
 */

import { formatarPlaca } from './utils.js';
import {
  deleteVenda,
  getSessaoAtiva,
  limparSessaoInvalida,
  resetarDadosDemonstracao
} from './storage.js';
import { showToast } from './ui.js';
import { atualizarUIEstadoAutenticacao } from './auth.js';
import { appState, DOM } from './state.js';

let callbackVendaExcluida = null;
let callbackDemoResetada = null;

export function abrirModalExclusao(venda) {
  appState.vendaParaExcluir = venda;
  DOM.excluirPlacaModal.textContent = formatarPlaca(venda.placa);
  DOM.excluirContratoModal.textContent = venda.numeroContrato;
  DOM.modalConfirmarExclusao.showModal();
}

export function fecharModalExclusao() {
  if (DOM.modalConfirmarExclusao && DOM.modalConfirmarExclusao.open) {
    DOM.modalConfirmarExclusao.close();
  }
  appState.vendaParaExcluir = null;
}

function handleConfirmarExclusao(e) {
  if (e) e.preventDefault();
  if (!appState.vendaParaExcluir) return;

  const { id, numeroContrato } = appState.vendaParaExcluir;

  try {
    const sucesso = deleteVenda(id);
    fecharModalExclusao();

    if (sucesso) {
      showToast(`Venda do contrato ${numeroContrato} excluída com sucesso.`);
      if (typeof callbackVendaExcluida === 'function') {
        callbackVendaExcluida();
      }
    } else {
      showToast('Não foi possível encontrar a venda selecionada.', 'error');
    }
  } catch (error) {
    limparSessaoInvalida();
    atualizarUIEstadoAutenticacao();
    fecharModalExclusao();
    showToast(error.message, 'error');
  }
}

export function abrirModalResetDemo() {
  if (!getSessaoAtiva()) {
    limparSessaoInvalida();
    atualizarUIEstadoAutenticacao();
    showToast('Faça login para restaurar os dados de demonstração.', 'error');
    return;
  }
  if (DOM.modalConfirmarReset) {
    DOM.modalConfirmarReset.showModal();
  }
}

export function fecharModalResetDemo() {
  if (DOM.modalConfirmarReset && DOM.modalConfirmarReset.open) {
    DOM.modalConfirmarReset.close();
  }
}

function handleConfirmarResetDemo(e) {
  if (e) e.preventDefault();
  try {
    resetarDadosDemonstracao();
    fecharModalResetDemo();

    const sessaoNova = getSessaoAtiva();
    atualizarUIEstadoAutenticacao();

    if (typeof callbackDemoResetada === 'function') {
      callbackDemoResetada(sessaoNova);
    }

    showToast('Dados de demonstração restaurados com sucesso!');
  } catch (error) {
    fecharModalResetDemo();
    showToast(error.message, 'error');
  }
}

export function initModais({ onVendaExcluida, onDemoResetada } = {}) {
  callbackVendaExcluida = typeof onVendaExcluida === 'function' ? onVendaExcluida : null;
  callbackDemoResetada = typeof onDemoResetada === 'function' ? onDemoResetada : null;

  if (DOM.btnCancelarExclusao) {
    DOM.btnCancelarExclusao.addEventListener('click', fecharModalExclusao);
  }
  if (DOM.modalConfirmarExclusao) {
    DOM.modalConfirmarExclusao.addEventListener('cancel', fecharModalExclusao);
  }
  if (DOM.formConfirmarExclusao) {
    DOM.formConfirmarExclusao.addEventListener('submit', handleConfirmarExclusao);
  }

  if (DOM.btnRestaurarDemo) {
    DOM.btnRestaurarDemo.addEventListener('click', abrirModalResetDemo);
  }
  if (DOM.btnCancelarReset) {
    DOM.btnCancelarReset.addEventListener('click', fecharModalResetDemo);
  }
  if (DOM.modalConfirmarReset) {
    DOM.modalConfirmarReset.addEventListener('cancel', fecharModalResetDemo);
  }
  if (DOM.formConfirmarReset) {
    DOM.formConfirmarReset.addEventListener('submit', handleConfirmarResetDemo);
  }
}
