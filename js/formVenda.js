/**
 * Formulário de cadastro de nova venda (formVenda.js):
 * Gerencia limites de data, catálogo de modelos/anos dependentes, validação de campos e envio.
 */

import { getModelos, getAnosPorModelo } from './catalog.js';
import {
  DATA_MINIMA_VENDA,
  validarPlaca,
  validarContrato,
  obterDataHojeISO,
  validarDataInput,
  combinarDataComHoraAtual
} from './utils.js';
import {
  addVenda,
  isContratoExistente,
  getSessaoAtiva,
  limparSessaoInvalida,
  setConsultorAtivoId
} from './storage.js';
import { showToast, exibirErroCampo, limparErroCampo } from './ui.js';
import { atualizarUIEstadoAutenticacao } from './auth.js';
import { appState, DOM } from './state.js';

let callbackVendaSalva = null;

export function recalcularLimitesDataVenda() {
  const hoje = obterDataHojeISO();
  if (DOM.inputDataVenda) {
    DOM.inputDataVenda.min = DATA_MINIMA_VENDA;
    DOM.inputDataVenda.max = hoje;
  }
  return hoje;
}

function inicializarCampoDataVenda() {
  const hoje = recalcularLimitesDataVenda();
  if (DOM.inputDataVenda) {
    DOM.inputDataVenda.value = hoje;
  }
}

function popularSelectModelosVenda() {
  if (!DOM.selectModelo) return;
  DOM.selectModelo.replaceChildren();

  const optPadrao = document.createElement('option');
  optPadrao.value = '';
  optPadrao.textContent = 'Selecione um modelo...';
  DOM.selectModelo.appendChild(optPadrao);

  getModelos().forEach((modelo) => {
    const opt = document.createElement('option');
    opt.value = modelo;
    opt.textContent = modelo;
    DOM.selectModelo.appendChild(opt);
  });
}

function resetarSelectAnoModeloVenda() {
  if (!DOM.selectAnoModelo) return;
  DOM.selectAnoModelo.replaceChildren();

  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = 'Selecione o modelo primeiro...';
  DOM.selectAnoModelo.appendChild(opt);
  DOM.selectAnoModelo.disabled = true;
  DOM.selectAnoModelo.value = '';
}

function limparTodosErrosFormulario() {
  limparErroCampo(DOM.inputDataVenda, DOM.erroDataVenda);
  limparErroCampo(DOM.inputPlaca, DOM.erroPlaca);
  limparErroCampo(DOM.inputContrato, DOM.erroContrato);
  limparErroCampo(DOM.selectModelo, DOM.erroModelo);
  limparErroCampo(DOM.selectAnoModelo, DOM.erroAnoModelo);
}

export function resetarFormularioVenda() {
  if (DOM.formCadastroVenda) {
    DOM.formCadastroVenda.reset();
  }
  limparTodosErrosFormulario();
  inicializarCampoDataVenda();
  resetarSelectAnoModeloVenda();
}

function handleTrocaModeloVenda() {
  const modelo = DOM.selectModelo.value;
  limparErroCampo(DOM.selectModelo, DOM.erroModelo);
  limparErroCampo(DOM.selectAnoModelo, DOM.erroAnoModelo);

  if (!modelo) {
    resetarSelectAnoModeloVenda();
    return;
  }

  const anosDisponiveis = getAnosPorModelo(modelo);
  DOM.selectAnoModelo.replaceChildren();

  const optInicial = document.createElement('option');
  optInicial.value = '';
  optInicial.textContent = 'Selecione o ano modelo...';
  DOM.selectAnoModelo.appendChild(optInicial);

  anosDisponiveis.forEach((ano) => {
    const opt = document.createElement('option');
    opt.value = String(ano);
    opt.textContent = String(ano);
    DOM.selectAnoModelo.appendChild(opt);
  });

  DOM.selectAnoModelo.disabled = false;
}

function handleSalvarVenda(e) {
  e.preventDefault();

  const usuarioLogado = getSessaoAtiva();
  if (!usuarioLogado) {
    limparSessaoInvalida();
    atualizarUIEstadoAutenticacao();
    showToast('Sessão expirada ou inexistente. Faça login para registrar vendas.', 'error');
    return;
  }

  recalcularLimitesDataVenda();
  limparTodosErrosFormulario();

  const dataVendaStr = DOM.inputDataVenda.value.trim();
  const placaRaw = DOM.inputPlaca.value.trim();
  const contratoRaw = DOM.inputContrato.value.trim();
  const modelo = DOM.selectModelo.value;
  const anoModelo = DOM.selectAnoModelo.value;

  let hasError = false;

  if (!dataVendaStr) {
    exibirErroCampo(DOM.inputDataVenda, DOM.erroDataVenda, 'A data da venda é obrigatória.');
    hasError = true;
  } else if (dataVendaStr < DATA_MINIMA_VENDA) {
    exibirErroCampo(
      DOM.inputDataVenda,
      DOM.erroDataVenda,
      'A data da venda não pode ser anterior a 01/01/2023.'
    );
    hasError = true;
  } else if (!validarDataInput(dataVendaStr)) {
    exibirErroCampo(
      DOM.inputDataVenda,
      DOM.erroDataVenda,
      'Data de venda inválida ou posterior à data de hoje.'
    );
    hasError = true;
  }

  if (!placaRaw) {
    exibirErroCampo(DOM.inputPlaca, DOM.erroPlaca, 'A placa do veículo é obrigatória.');
    hasError = true;
  } else if (!validarPlaca(placaRaw)) {
    exibirErroCampo(
      DOM.inputPlaca,
      DOM.erroPlaca,
      'Placa inválida. Use o formato Mercosul (ABC1D23) ou antigo (ABC1234/ABC-1234).'
    );
    hasError = true;
  }

  if (!contratoRaw) {
    exibirErroCampo(DOM.inputContrato, DOM.erroContrato, 'O número do contrato é obrigatório.');
    hasError = true;
  } else if (!validarContrato(contratoRaw)) {
    exibirErroCampo(
      DOM.inputContrato,
      DOM.erroContrato,
      'Contrato inválido. Permitido apenas letras e números, sem espaços.'
    );
    hasError = true;
  } else if (isContratoExistente(contratoRaw)) {
    exibirErroCampo(
      DOM.inputContrato,
      DOM.erroContrato,
      `O contrato "${contratoRaw.toUpperCase()}" já está cadastrado no sistema.`
    );
    hasError = true;
  }

  if (!modelo) {
    exibirErroCampo(DOM.selectModelo, DOM.erroModelo, 'Selecione o modelo da motocicleta.');
    hasError = true;
  }

  if (!anoModelo) {
    exibirErroCampo(DOM.selectAnoModelo, DOM.erroAnoModelo, 'Selecione o ano modelo.');
    hasError = true;
  }

  if (hasError) return;

  try {
    const dataIsoFinal = combinarDataComHoraAtual(dataVendaStr);
    if (!dataIsoFinal) {
      exibirErroCampo(DOM.inputDataVenda, DOM.erroDataVenda, 'Data de venda inválida.');
      return;
    }

    const novaVenda = addVenda({
      consultorId: usuarioLogado.consultorId,
      placa: placaRaw,
      numeroContrato: contratoRaw,
      modelo,
      anoModelo: Number(anoModelo),
      dataVenda: dataIsoFinal
    });

    resetarFormularioVenda();
    showToast(`Venda do contrato ${novaVenda.numeroContrato} registrada com sucesso!`);

    appState.consultorAtivoId = usuarioLogado.consultorId;
    setConsultorAtivoId(usuarioLogado.consultorId);
    if (DOM.selectConsultor) {
      DOM.selectConsultor.value = usuarioLogado.consultorId;
    }

    if (typeof callbackVendaSalva === 'function') {
      callbackVendaSalva(novaVenda, usuarioLogado);
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
}

export function initFormVenda({ onVendaSalva } = {}) {
  callbackVendaSalva = typeof onVendaSalva === 'function' ? onVendaSalva : null;

  inicializarCampoDataVenda();
  popularSelectModelosVenda();

  if (DOM.selectModelo) {
    DOM.selectModelo.addEventListener('change', handleTrocaModeloVenda);
  }

  if (DOM.inputDataVenda) {
    DOM.inputDataVenda.addEventListener('focus', recalcularLimitesDataVenda);
    DOM.inputDataVenda.addEventListener('change', () => {
      limparErroCampo(DOM.inputDataVenda, DOM.erroDataVenda);
    });
  }

  if (DOM.inputPlaca) {
    DOM.inputPlaca.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
      limparErroCampo(DOM.inputPlaca, DOM.erroPlaca);
    });
  }

  if (DOM.inputContrato) {
    DOM.inputContrato.addEventListener('input', () => {
      limparErroCampo(DOM.inputContrato, DOM.erroContrato);
    });
  }

  if (DOM.selectAnoModelo) {
    DOM.selectAnoModelo.addEventListener('change', () => {
      limparErroCampo(DOM.selectAnoModelo, DOM.erroAnoModelo);
    });
  }

  if (DOM.formCadastroVenda) {
    DOM.formCadastroVenda.addEventListener('submit', handleSalvarVenda);
  }
}
