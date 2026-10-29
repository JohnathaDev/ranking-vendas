/**
 * Orquestrador principal da aplicação MotoRanking (Etapa 2 — app.js).
 * Coordena inicialização de dados/migração, autenticação (auth.js),
 * aba Ranking Geral (ranking.js), aba Painel do Consultor, aba Nova Venda,
 * modal de confirmação de exclusão, restauração de demonstração e sincronização entre abas (window storage).
 */

import { getModelos, getAnosPorModelo } from './catalog.js';
import {
  DATA_MINIMA_VENDA,
  validarPlaca,
  formatarPlaca,
  validarContrato,
  formatarDataHora,
  filtrarPorPeriodo,
  agruparPor,
  calcularLiderComEmpate,
  obterDataHojeISO,
  validarDataInput,
  combinarDataComHoraAtual
} from './utils.js';
import {
  STORAGE_KEYS,
  inicializarSeedSeNecessario,
  getConsultores,
  getConsultorAtivoId,
  setConsultorAtivoId,
  getVendasPorConsultor,
  addVenda,
  deleteVenda,
  isContratoExistente,
  getSessaoAtiva,
  resetarDadosDemonstracao
} from './storage.js';
import {
  showToast,
  exibirErroCampo,
  limparErroCampo,
  configurarControleSegmentado,
  atualizarBotoesSegmentados,
  obterAbaDaURL,
  ativarAbaUI,
  inicializarNavegacaoAbas
} from './ui.js';
import {
  initAuth,
  atualizarUIEstadoAutenticacao
} from './auth.js';
import {
  initRanking,
  renderRankingGeral,
  sincronizarRankingComURL
} from './ranking.js';

// ==========================================
// ESTADO GLOBAL DA INTERFACE
// ==========================================
const appState = {
  abaAtiva: 'ranking', // 'ranking' | 'painel' | 'nova-venda'
  consultorAtivoId: null,
  periodoPainel: 'mes', // 'dia' | 'semana' | 'mes'
  sortModeloOrdem: 'desc', // 'asc' | 'desc'
  sortAnoOrdem: 'desc', // 'asc' | 'desc'
  vendaParaExcluir: null
};

// ==========================================
// ELEMENTOS DO DOM
// ==========================================
const DOM = {
  // Painel do Consultor — Seletor "Ver consultor"
  selectConsultor: document.getElementById('selectConsultor'),
  labelNomeConsultor: document.getElementById('labelNomeConsultor'),
  badgeModoPainel: document.getElementById('badgeModoPainel'),

  // Formulário de Cadastro de Venda (Aba Nova Venda)
  formCadastroVenda: document.getElementById('formCadastroVenda'),
  inputDataVenda: document.getElementById('inputDataVenda'),
  inputPlaca: document.getElementById('inputPlaca'),
  inputContrato: document.getElementById('inputContrato'),
  selectModelo: document.getElementById('selectModelo'),
  selectAnoModelo: document.getElementById('selectAnoModelo'),

  // Mensagens de Erro Inline do Formulário de Venda
  erroDataVenda: document.getElementById('erroDataVenda'),
  erroPlaca: document.getElementById('erroPlaca'),
  erroContrato: document.getElementById('erroContrato'),
  erroModelo: document.getElementById('erroModelo'),
  erroAnoModelo: document.getElementById('erroAnoModelo'),

  // Painel do Consultor — Filtros de Período
  botoesPeriodoPainel: document.querySelectorAll('.btn-painel-period'),

  // Painel do Consultor — KPIs
  kpiTotalVendas: document.getElementById('kpiTotalVendas'),
  kpiPeriodoTexto: document.getElementById('kpiPeriodoTexto'),
  kpiModeloMaisVendido: document.getElementById('kpiModeloMaisVendido'),
  kpiModeloDetalhe: document.getElementById('kpiModeloDetalhe'),
  kpiAnoMaisVendido: document.getElementById('kpiAnoMaisVendido'),
  kpiAnoDetalhe: document.getElementById('kpiAnoDetalhe'),

  // Painel do Consultor — Tabelas de Agrupamento
  tbodyVendasPorModelo: document.getElementById('tbodyVendasPorModelo'),
  tbodyVendasPorAno: document.getElementById('tbodyVendasPorAno'),
  thSortModelo: document.getElementById('thSortModelo'),
  thSortAno: document.getElementById('thSortAno'),
  btnSortModeloQtd: document.getElementById('btnSortModeloQtd'),
  btnSortAnoQtd: document.getElementById('btnSortAnoQtd'),
  sortIconModelo: document.getElementById('sortIconModelo'),
  sortIconAno: document.getElementById('sortIconAno'),

  // Painel do Consultor — Lista de Vendas
  tabelaListaVendas: document.getElementById('tabelaListaVendas'),
  thColunaAcoesPainel: document.getElementById('thColunaAcoesPainel'),
  tbodyListaVendas: document.getElementById('tbodyListaVendas'),
  emptyStateVendas: document.getElementById('emptyStateVendas'),
  emptyStateTextoPainel: document.getElementById('emptyStateTextoPainel'),

  // Modal de Confirmação de Exclusão
  modalConfirmarExclusao: document.getElementById('modalConfirmarExclusao'),
  formConfirmarExclusao: document.getElementById('formConfirmarExclusao'),
  excluirPlacaModal: document.getElementById('excluirPlacaModal'),
  excluirContratoModal: document.getElementById('excluirContratoModal'),
  btnCancelarExclusao: document.getElementById('btnCancelarExclusao'),
  btnConfirmarExclusaoFinal: document.getElementById('btnConfirmarExclusaoFinal'),

  // Rodapé & Modal de Restaurar Dados de Demonstração (Item D4)
  btnRestaurarDemo: document.getElementById('btnRestaurarDemo'),
  modalConfirmarReset: document.getElementById('modalConfirmarReset'),
  formConfirmarReset: document.getElementById('formConfirmarReset'),
  btnCancelarReset: document.getElementById('btnCancelarReset')
};

// ==========================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ==========================================
function initApp() {
  // 1. Inicializa o seed ou executa migração segura para schema v2 (Itens A1, C1, C2)
  inicializarSeedSeNecessario();

  // 2. Configura limites e valor inicial do input de data da venda (Itens A2 e A3)
  inicializarCampoDataVenda();

  // 3. Popula modelos do catálogo no formulário de venda
  popularSelectModelosVenda();

  // 4. Inicializa autenticação e callbacks de login/logout (Partes C e D)
  initAuth({
    onLoginSuccess: (usuarioLogado) => {
      // Item D4: Painel mostra por padrão as vendas do próprio consultor
      appState.consultorAtivoId = usuarioLogado.consultorId;
      setConsultorAtivoId(usuarioLogado.consultorId);
      carregarListaConsultores(usuarioLogado.consultorId);

      // Atualiza telas
      renderRankingGeral();
      atualizarPainelConsultor();

      // Item D4: Após login, ir para a aba "Nova venda"
      selecionarAba('nova-venda', { atualizarHash: true });
    },
    onLogoutSuccess: () => {
      // Item D4: Após logout, limpar o formulário e voltar para "Ranking geral"
      resetarFormularioVenda();
      atualizarUIEstadoAutenticacao();
      renderRankingGeral();
      atualizarPainelConsultor();
      selecionarAba('ranking', { atualizarHash: true });
    }
  });

  // 5. Carrega lista de consultores no select "Ver consultor" do Painel
  const sessaoInicial = getSessaoAtiva();
  carregarListaConsultores(sessaoInicial ? sessaoInicial.consultorId : null);

  // 6. Inicializa módulo de Ranking Geral (Parte E)
  initRanking();

  // 7. Registra ouvintes gerais (formulário, painel, modais, abas, storage event)
  setupEventListeners();

  // 8. Define a aba inicial a partir do hash da URL (padrão #ranking — Item D1)
  const abaInicial = obterAbaDaURL(window.location.hash);
  selecionarAba(abaInicial, { atualizarHash: Boolean(window.location.hash) });

  // 9. Renderiza o Painel do Consultor
  atualizarPainelConsultor();
}

/**
 * Seleciona e ativa uma aba, sincronizando estado e URL (Itens D1, D3, D4).
 * @param {string} abaId 'ranking' | 'painel' | 'nova-venda'
 * @param {Object} [opcoes={}]
 */
function selecionarAba(abaId, opcoes = {}) {
  atualizarUIEstadoAutenticacao();
  appState.abaAtiva = ativarAbaUI(abaId, opcoes);

  if (appState.abaAtiva === 'ranking') {
    renderRankingGeral();
  } else if (appState.abaAtiva === 'painel') {
    atualizarPainelConsultor();
  } else if (appState.abaAtiva === 'nova-venda') {
    recalcularLimitesDataVenda();
  }
}

// ==========================================
// DATA DA VENDA (ITENS A2 E A3)
// ==========================================

/**
 * Recalcula min="2023-01-01" e max=hoje no input de data da venda (Itens A2 e A3).
 * Executado no foco do campo e antes de validar no submit.
 * @returns {string} Data de hoje em formato YYYY-MM-DD
 */
function recalcularLimitesDataVenda() {
  const hoje = obterDataHojeISO();
  if (DOM.inputDataVenda) {
    DOM.inputDataVenda.min = DATA_MINIMA_VENDA;
    DOM.inputDataVenda.max = hoje;
  }
  return hoje;
}

/**
 * Inicializa o campo de data com a data de hoje e define min e max.
 */
function inicializarCampoDataVenda() {
  const hoje = recalcularLimitesDataVenda();
  if (DOM.inputDataVenda) {
    DOM.inputDataVenda.value = hoje;
  }
}

// ==========================================
// FORMULÁRIO DE NOVA VENDA
// ==========================================

/**
 * Popula o select de modelos com o catálogo oficial sem usar innerHTML.
 */
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

/**
 * Reseta oselect dependente de Ano Modelo para o estado desabilitado inicial.
 */
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

/**
 * Limpa completamente o formulário de venda e seus erros inline (Item D4).
 */
function resetarFormularioVenda() {
  if (DOM.formCadastroVenda) {
    DOM.formCadastroVenda.reset();
  }
  limparTodosErrosFormulario();
  inicializarCampoDataVenda();
  resetarSelectAnoModeloVenda();
}

/**
 * Atualiza o select de Ano Modelo quando o Modelo é alterado no formulário.
 */
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

/**
 * Valida e salva uma nova venda vinculada ao consultor logado (Itens A2, A3, B1, B2, C6).
 * @param {SubmitEvent} e
 */
function handleSalvarVenda(e) {
  e.preventDefault();

  const usuarioLogado = getSessaoAtiva();
  if (!usuarioLogado) {
    atualizarUIEstadoAutenticacao();
    showToast('Sessão expirada ou inexistente. Faça login para registrar vendas.', 'error');
    return;
  }

  // Item A3: Recalcula o max (hoje) antes de validar no submit
  recalcularLimitesDataVenda();
  limparTodosErrosFormulario();

  const dataVendaStr = DOM.inputDataVenda.value.trim();
  const placaRaw = DOM.inputPlaca.value.trim();
  const contratoRaw = DOM.inputContrato.value.trim();
  const modelo = DOM.selectModelo.value;
  const anoModelo = DOM.selectAnoModelo.value;

  let hasError = false;

  // 1. Validação de Data da Venda (Item A2: min 2023-01-01 e max hoje)
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

  // 2. Validação de Placa (Item B1: placas repetidas são permitidas!)
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

  // 3. Validação de Contrato (Item B2: único no sistema, case-insensitive e ignorando espaços nas pontas)
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

  // 4. Validação de Modelo
  if (!modelo) {
    exibirErroCampo(DOM.selectModelo, DOM.erroModelo, 'Selecione o modelo da motocicleta.');
    hasError = true;
  }

  // 5. Validação de Ano Modelo
  if (!anoModelo) {
    exibirErroCampo(DOM.selectAnoModelo, DOM.erroAnoModelo, 'Selecione o ano modelo.');
    hasError = true;
  }

  if (hasError) return;

  try {
    const dataIsoFinal = combinarDataComHoraAtual(dataVendaStr);

    // Item C6: storage.js grava sempre consultorId = consultor do usuário logado
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

    // Garante que o Painel mostre o consultor logado e atualiza tanto Ranking quanto Painel
    appState.consultorAtivoId = usuarioLogado.consultorId;
    setConsultorAtivoId(usuarioLogado.consultorId);
    if (DOM.selectConsultor) {
      DOM.selectConsultor.value = usuarioLogado.consultorId;
    }

    renderRankingGeral();
    atualizarPainelConsultor();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function limparTodosErrosFormulario() {
  limparErroCampo(DOM.inputDataVenda, DOM.erroDataVenda);
  limparErroCampo(DOM.inputPlaca, DOM.erroPlaca);
  limparErroCampo(DOM.inputContrato, DOM.erroContrato);
  limparErroCampo(DOM.selectModelo, DOM.erroModelo);
  limparErroCampo(DOM.selectAnoModelo, DOM.erroAnoModelo);
}

// ==========================================
// SELETOR "VER CONSULTOR" E PAINEL DO CONSULTOR (ITENS D2, D3, D4)
// ==========================================

/**
 * Carrega todos os consultores no select "Ver consultor" da aba Painel do Consultor (sem "+ Novo consultor" — Item D2).
 * @param {string|null} [preferenciaConsultorId=null]
 */
function carregarListaConsultores(preferenciaConsultorId = null) {
  const consultores = getConsultores();
  const sessao = getSessaoAtiva();
  const salvoId = preferenciaConsultorId || (sessao ? sessao.consultorId : getConsultorAtivoId());

  if (!DOM.selectConsultor) return;
  DOM.selectConsultor.replaceChildren();

  let idEscolhido = null;

  consultores.forEach((c) => {
    if (!c) return;
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent =
      sessao && sessao.consultorId === c.id ? `${c.nome} (Você)` : c.nome;
    if (c.id === salvoId) {
      opt.selected = true;
      idEscolhido = c.id;
    }
    DOM.selectConsultor.appendChild(opt);
  });

  // Se nenhum estava selecionado, seleciona o primeiro consultor disponível
  if (!idEscolhido && consultores.length > 0) {
    idEscolhido = consultores[0].id;
    DOM.selectConsultor.value = idEscolhido;
  }

  appState.consultorAtivoId = idEscolhido;
  setConsultorAtivoId(idEscolhido);
}

/**
 * Atualiza toda a aba "Painel do consultor".
 */
function atualizarPainelConsultor() {
  const consultores = getConsultores();
  const sessao = getSessaoAtiva();

  // Atualiza rótulo "(Você)" no select caso o status de login tenha mudado
  if (DOM.selectConsultor) {
    const idAtual = appState.consultorAtivoId || DOM.selectConsultor.value;
    carregarListaConsultores(idAtual);
  }

  const consultorSelecionado = consultores.find(
    (c) => c && c.id === appState.consultorAtivoId
  );

  if (!consultorSelecionado) {
    if (DOM.labelNomeConsultor) {
      DOM.labelNomeConsultor.textContent = 'Painel do Consultor';
    }
    limparPainelConsultor();
    return;
  }

  const ehProprioUsuario =
    Boolean(sessao) && sessao.consultorId === consultorSelecionado.id;

  if (DOM.labelNomeConsultor) {
    DOM.labelNomeConsultor.textContent = `Painel de Vendas: ${consultorSelecionado.nome}`;
  }

  if (DOM.badgeModoPainel) {
    if (ehProprioUsuario) {
      DOM.badgeModoPainel.textContent = 'Seu painel · exclusão habilitada';
      DOM.badgeModoPainel.className = 'panel-mode-badge mode-owner';
    } else if (sessao) {
      DOM.badgeModoPainel.textContent = 'Consultando colega · somente leitura';
      DOM.badgeModoPainel.className = 'panel-mode-badge mode-readonly';
    } else {
      DOM.badgeModoPainel.textContent = 'Modo visitante · somente leitura';
      DOM.badgeModoPainel.className = 'panel-mode-badge mode-readonly';
    }
  }

  renderDadosPainelConsultor(ehProprioUsuario);
}

function limparPainelConsultor() {
  DOM.kpiTotalVendas.textContent = '0';
  DOM.kpiModeloMaisVendido.textContent = '-';
  DOM.kpiModeloDetalhe.textContent = '0 unidades';
  DOM.kpiAnoMaisVendido.textContent = '-';
  DOM.kpiAnoDetalhe.textContent = '0 unidades';
  DOM.tbodyVendasPorModelo.replaceChildren();
  DOM.tbodyVendasPorAno.replaceChildren();
  DOM.tbodyListaVendas.replaceChildren();
  DOM.emptyStateVendas.classList.remove('hidden');
  DOM.tabelaListaVendas.classList.add('hidden');
}

function getVendasDoPeriodoPainel() {
  if (!appState.consultorAtivoId) return [];
  const todasVendasConsultor = getVendasPorConsultor(appState.consultorAtivoId);
  return filtrarPorPeriodo(todasVendasConsultor, appState.periodoPainel);
}

/**
 * Renderiza KPIs, tabelas de agrupamento e lista de vendas do consultor selecionado.
 * @param {boolean} [ehProprioUsuario]
 */
function renderDadosPainelConsultor(ehProprioUsuario) {
  if (!appState.consultorAtivoId) return;

  const sessao = getSessaoAtiva();
  const podeExcluir =
    ehProprioUsuario !== undefined
      ? ehProprioUsuario
      : Boolean(sessao && sessao.consultorId === appState.consultorAtivoId);

  const vendasPeriodo = getVendasDoPeriodoPainel();

  const rotulosPeriodo = {
    dia: 'Hoje',
    semana: 'Nesta semana',
    mes: 'Neste mês'
  };
  DOM.kpiPeriodoTexto.textContent = rotulosPeriodo[appState.periodoPainel] || 'No período';

  renderKPIsPainel(vendasPeriodo);
  renderTabelaModelosPainel(vendasPeriodo);
  renderTabelaAnosPainel(vendasPeriodo);
  renderListaVendasPainel(vendasPeriodo, podeExcluir);
}

function renderKPIsPainel(vendasPeriodo) {
  DOM.kpiTotalVendas.textContent = String(vendasPeriodo.length);

  const liderModelo = calcularLiderComEmpate(
    vendasPeriodo,
    'modelo',
    null,
    'unidade',
    'unidades'
  );
  DOM.kpiModeloMaisVendido.textContent = liderModelo.valorPrincipal;
  DOM.kpiModeloDetalhe.textContent = liderModelo.detalhe;

  const liderAno = calcularLiderComEmpate(
    vendasPeriodo,
    'anoModelo',
    null,
    'unidade',
    'unidades'
  );
  DOM.kpiAnoMaisVendido.textContent = liderAno.valorPrincipal;
  DOM.kpiAnoDetalhe.textContent = liderAno.detalhe;
}

function renderTabelaModelosPainel(vendasPeriodo = getVendasDoPeriodoPainel()) {
  const agrupado = agruparPor(vendasPeriodo, 'modelo');

  agrupado.sort((a, b) => {
    const diffQtd =
      appState.sortModeloOrdem === 'desc'
        ? b.quantidade - a.quantidade
        : a.quantidade - b.quantidade;
    if (diffQtd !== 0) return diffQtd;
    return String(a.chave).localeCompare(String(b.chave), 'pt-BR');
  });

  DOM.tbodyVendasPorModelo.replaceChildren();

  if (agrupado.length === 0) {
    const trVazio = document.createElement('tr');
    const tdVazio = document.createElement('td');
    tdVazio.colSpan = 2;
    tdVazio.className = 'table-empty-cell';
    tdVazio.textContent = 'Sem vendas no período';
    trVazio.appendChild(tdVazio);
    DOM.tbodyVendasPorModelo.appendChild(trVazio);
    return;
  }

  const maxQtd = Math.max(...agrupado.map((i) => i.quantidade));

  agrupado.forEach((item) => {
    const tr = document.createElement('tr');
    const tdModelo = document.createElement('td');
    const strongModelo = document.createElement('strong');
    strongModelo.textContent = String(item.chave);
    tdModelo.appendChild(strongModelo);

    const tdQtd = document.createElement('td');
    tdQtd.className = 'text-right';

    const spanBadge = document.createElement('span');
    spanBadge.className = `badge-count ${item.quantidade === maxQtd ? 'top' : ''}`;
    spanBadge.textContent = String(item.quantidade);

    tdQtd.appendChild(spanBadge);
    tr.appendChild(tdModelo);
    tr.appendChild(tdQtd);

    DOM.tbodyVendasPorModelo.appendChild(tr);
  });
}

function renderTabelaAnosPainel(vendasPeriodo = getVendasDoPeriodoPainel()) {
  const agrupado = agruparPor(vendasPeriodo, 'anoModelo');

  agrupado.sort((a, b) => {
    const diffQtd =
      appState.sortAnoOrdem === 'desc'
        ? b.quantidade - a.quantidade
        : a.quantidade - b.quantidade;
    if (diffQtd !== 0) return diffQtd;
    return Number(b.chave) - Number(a.chave);
  });

  DOM.tbodyVendasPorAno.replaceChildren();

  if (agrupado.length === 0) {
    const trVazio = document.createElement('tr');
    const tdVazio = document.createElement('td');
    tdVazio.colSpan = 2;
    tdVazio.className = 'table-empty-cell';
    tdVazio.textContent = 'Sem vendas no período';
    trVazio.appendChild(tdVazio);
    DOM.tbodyVendasPorAno.appendChild(trVazio);
    return;
  }

  const maxQtd = Math.max(...agrupado.map((i) => i.quantidade));

  agrupado.forEach((item) => {
    const tr = document.createElement('tr');
    const tdAno = document.createElement('td');
    const strongAno = document.createElement('strong');
    strongAno.textContent = String(item.chave);
    tdAno.appendChild(strongAno);

    const tdQtd = document.createElement('td');
    tdQtd.className = 'text-right';

    const spanBadge = document.createElement('span');
    spanBadge.className = `badge-count ${item.quantidade === maxQtd ? 'top' : ''}`;
    spanBadge.textContent = String(item.quantidade);

    tdQtd.appendChild(spanBadge);
    tr.appendChild(tdAno);
    tr.appendChild(tdQtd);

    DOM.tbodyVendasPorAno.appendChild(tr);
  });
}

/**
 * Renderiza a lista detalhada de vendas do consultor no período.
 * O botão Excluir aparece APENAS nas vendas do próprio usuário logado (Itens D3 e D4).
 * @param {Array<Object>} vendasPeriodo
 * @param {boolean} podeExcluir
 */
function renderListaVendasPainel(vendasPeriodo, podeExcluir) {
  DOM.tbodyListaVendas.replaceChildren();

  // Oculta o cabeçalho "Ações" se não estiver visualizando as próprias vendas logado
  if (DOM.thColunaAcoesPainel) {
    DOM.thColunaAcoesPainel.classList.toggle('hidden', !podeExcluir);
  }

  if (vendasPeriodo.length === 0) {
    DOM.tabelaListaVendas.classList.add('hidden');
    DOM.emptyStateVendas.classList.remove('hidden');
    if (DOM.emptyStateTextoPainel) {
      DOM.emptyStateTextoPainel.textContent = podeExcluir
        ? 'Não há vendas registradas para você neste período. Acesse a aba "Nova venda" para cadastrar.'
        : 'Não há vendas registradas para este consultor no período selecionado.';
    }
    return;
  }

  DOM.tabelaListaVendas.classList.remove('hidden');
  DOM.emptyStateVendas.classList.add('hidden');

  const vendasOrdenadas = [...vendasPeriodo].sort(
    (a, b) => new Date(b.dataVenda) - new Date(a.dataVenda)
  );

  const sessao = getSessaoAtiva();

  vendasOrdenadas.forEach((venda) => {
    const tr = document.createElement('tr');

    // 1. Data/Hora
    const tdData = document.createElement('td');
    tdData.setAttribute('data-label', 'Data/Hora');
    tdData.textContent = formatarDataHora(venda.dataVenda);

    // 2. Placa
    const tdPlaca = document.createElement('td');
    tdPlaca.setAttribute('data-label', 'Placa');
    const spanPlaca = document.createElement('span');
    spanPlaca.className = 'plate-tag';
    spanPlaca.textContent = formatarPlaca(venda.placa);
    tdPlaca.appendChild(spanPlaca);

    // 3. Contrato
    const tdContrato = document.createElement('td');
    tdContrato.setAttribute('data-label', 'Contrato');
    const spanContrato = document.createElement('span');
    spanContrato.className = 'contract-tag';
    spanContrato.textContent = venda.numeroContrato;
    tdContrato.appendChild(spanContrato);

    // 4. Modelo
    const tdModelo = document.createElement('td');
    tdModelo.setAttribute('data-label', 'Modelo');
    const strongModelo = document.createElement('strong');
    strongModelo.textContent = venda.modelo;
    tdModelo.appendChild(strongModelo);

    // 5. Ano
    const tdAno = document.createElement('td');
    tdAno.setAttribute('data-label', 'Ano');
    tdAno.textContent = String(venda.anoModelo);

    tr.appendChild(tdData);
    tr.appendChild(tdPlaca);
    tr.appendChild(tdContrato);
    tr.appendChild(tdModelo);
    tr.appendChild(tdAno);

    // 6. Ações: botão Excluir APENAS se logado e a venda pertencer ao próprio usuário (Itens D3 e D4)
    if (podeExcluir && sessao && venda.consultorId === sessao.consultorId) {
      const tdAcoes = document.createElement('td');
      tdAcoes.className = 'text-right';
      tdAcoes.setAttribute('data-label', 'Ações');

      const btnExcluir = document.createElement('button');
      btnExcluir.type = 'button';
      btnExcluir.className = 'btn-delete';
      btnExcluir.title = 'Excluir venda';

      const iconeLixeira = document.createElement('span');
      iconeLixeira.setAttribute('aria-hidden', 'true');
      iconeLixeira.textContent = '🗑️';

      const textoExcluir = document.createTextNode(' Excluir');
      btnExcluir.appendChild(iconeLixeira);
      btnExcluir.appendChild(textoExcluir);

      btnExcluir.addEventListener('click', () => abrirModalExclusao(venda));
      tdAcoes.appendChild(btnExcluir);
      tr.appendChild(tdAcoes);
    }

    DOM.tbodyListaVendas.appendChild(tr);
  });
}

// ==========================================
// EXCLUSÃO DE VENDA COM MODAL NATIVO
// ==========================================
function abrirModalExclusao(venda) {
  appState.vendaParaExcluir = venda;
  DOM.excluirPlacaModal.textContent = formatarPlaca(venda.placa);
  DOM.excluirContratoModal.textContent = venda.numeroContrato;
  DOM.modalConfirmarExclusao.showModal();
}

function fecharModalExclusao() {
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
      renderRankingGeral();
      atualizarPainelConsultor();
    } else {
      showToast('Não foi possível encontrar a venda selecionada.', 'error');
    }
  } catch (error) {
    fecharModalExclusao();
    showToast(error.message, 'error');
  }
}

// ==========================================
// RESTAURAR DADOS DE DEMONSTRAÇÃO (ITEM D4)
// ==========================================
function abrirModalResetDemo() {
  if (!getSessaoAtiva()) {
    showToast('Faça login para restaurar os dados de demonstração.', 'error');
    return;
  }
  if (DOM.modalConfirmarReset) {
    DOM.modalConfirmarReset.showModal();
  }
}

function fecharModalResetDemo() {
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
    carregarListaConsultores(sessaoNova ? sessaoNova.consultorId : null);
    resetarFormularioVenda();
    renderRankingGeral();
    atualizarPainelConsultor();

    showToast('Dados de demonstração restaurados com sucesso!');
  } catch (error) {
    fecharModalResetDemo();
    showToast(error.message, 'error');
  }
}

// ==========================================
// CONFIGURAÇÃO DE EVENTOS GERAIS
// ==========================================
function setupEventListeners() {
  // Navegação por abas (role="tablist")
  inicializarNavegacaoAbas((abaEscolhida, opcoes) => {
    selecionarAba(abaEscolhida, opcoes);
  });

  // Mudança manual do hash na URL (ex: digitar #nova-venda na barra de endereços — Item D3)
  window.addEventListener('hashchange', () => {
    const abaHash = obterAbaDaURL(window.location.hash);
    selecionarAba(abaHash, { atualizarHash: false });
  });

  window.addEventListener('popstate', () => {
    const abaHash = obterAbaDaURL(window.location.hash);
    selecionarAba(abaHash, { atualizarHash: false });
    sincronizarRankingComURL();
  });

  // Seletor "Ver consultor" no Painel do Consultor
  if (DOM.selectConsultor) {
    DOM.selectConsultor.addEventListener('change', (e) => {
      appState.consultorAtivoId = e.target.value || null;
      setConsultorAtivoId(appState.consultorAtivoId);
      atualizarPainelConsultor();
    });
  }

  // Controle segmentado de período do Painel do Consultor
  configurarControleSegmentado(
    DOM.botoesPeriodoPainel,
    (novoPeriodo) => {
      appState.periodoPainel = novoPeriodo;
      atualizarPainelConsultor();
    },
    'period'
  );

  // Ordenação das tabelas de agrupamento do Painel
  if (DOM.btnSortModeloQtd) {
    DOM.btnSortModeloQtd.addEventListener('click', () => {
      appState.sortModeloOrdem = appState.sortModeloOrdem === 'desc' ? 'asc' : 'desc';
      DOM.thSortModelo.setAttribute(
        'aria-sort',
        appState.sortModeloOrdem === 'desc' ? 'descending' : 'ascending'
      );
      DOM.sortIconModelo.textContent = appState.sortModeloOrdem === 'desc' ? '▼' : '▲';
      renderTabelaModelosPainel();
    });
  }

  if (DOM.btnSortAnoQtd) {
    DOM.btnSortAnoQtd.addEventListener('click', () => {
      appState.sortAnoOrdem = appState.sortAnoOrdem === 'desc' ? 'asc' : 'desc';
      DOM.thSortAno.setAttribute(
        'aria-sort',
        appState.sortAnoOrdem === 'desc' ? 'descending' : 'ascending'
      );
      DOM.sortIconAno.textContent = appState.sortAnoOrdem === 'desc' ? '▼' : '▲';
      renderTabelaAnosPainel();
    });
  }

  // Formulário de Nova Venda
  if (DOM.selectModelo) {
    DOM.selectModelo.addEventListener('change', handleTrocaModeloVenda);
  }

  // Item A3: Recalcular max (hoje) no foco do campo de data
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

  // Modal de Confirmação de Exclusão
  if (DOM.btnCancelarExclusao) {
    DOM.btnCancelarExclusao.addEventListener('click', fecharModalExclusao);
  }
  if (DOM.modalConfirmarExclusao) {
    DOM.modalConfirmarExclusao.addEventListener('cancel', fecharModalExclusao);
  }
  if (DOM.formConfirmarExclusao) {
    DOM.formConfirmarExclusao.addEventListener('submit', handleConfirmarExclusao);
  }
  if (DOM.btnConfirmarExclusaoFinal) {
    DOM.btnConfirmarExclusaoFinal.addEventListener('click', handleConfirmarExclusao);
  }

  // Modal de Restaurar Dados de Demonstração (Item D4)
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

  // Item F: Ouvir o evento `storage` do window para atualizar ranking/painel quando outra aba alterar as vendas
  window.addEventListener('storage', (event) => {
    if (
      !event.key ||
      event.key === STORAGE_KEYS.VENDAS ||
      event.key === STORAGE_KEYS.CONSULTORES ||
      event.key === STORAGE_KEYS.USUARIOS ||
      event.key === STORAGE_KEYS.SCHEMA
    ) {
      atualizarUIEstadoAutenticacao();
      carregarListaConsultores(appState.consultorAtivoId);
      renderRankingGeral();
      atualizarPainelConsultor();
    }
  });
}

document.addEventListener('DOMContentLoaded', initApp);
