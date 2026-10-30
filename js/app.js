/**
 * Orquestrador principal da aplicação MotoRanking (app.js):
 * Coordena inicialização de dados/migração, autenticação compartilhada (auth.js),
 * aba Ranking Geral com BI (ranking.js), aba Painel do Consultor com gráfico individual (Item 2.4),
 * aba Nova Venda, seções recolhíveis em mobile (Item 1.3) e sincronização entre abas (Itens 1.1 e 1.2).
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
  obterMsAteExpirarSessao,
  resetarDadosDemonstracao
} from './storage.js';
import {
  showToast,
  exibirErroCampo,
  limparErroCampo,
  configurarControleSegmentado,
  obterAbaDaURL,
  ativarAbaUI,
  inicializarNavegacaoAbas,
  sincronizarSecoesRecolhiveis
} from './ui.js';
import {
  initAuth,
  atualizarUIEstadoAutenticacao,
  fecharModalLogin,
  verificarEIniciarContagemBloqueio
} from './auth.js';
import {
  initRanking,
  renderRankingGeral,
  sincronizarRankingComURL
} from './ranking.js';
import {
  renderGraficoConsultorPainel,
  exportarGraficoPNG
} from './charts.js';

const appState = {
  abaAtiva: 'ranking',
  consultorAtivoId: null,
  periodoPainel: 'mes',
  tipoGraficoPainel: 'colunas', // 'colunas' | 'pizza' | 'linha' (Item 2.4)
  dimensaoGraficoPainel: 'modelo', // 'modelo' | 'anoModelo' (Item 2.4)
  sortModeloOrdem: 'desc',
  sortAnoOrdem: 'desc',
  vendaParaExcluir: null,
  eraCelular600: typeof window !== 'undefined' ? window.innerWidth <= 600 : false
};

const DOM = {
  selectConsultor: document.getElementById('selectConsultor'),
  labelNomeConsultor: document.getElementById('labelNomeConsultor'),
  badgeModoPainel: document.getElementById('badgeModoPainel'),

  formCadastroVenda: document.getElementById('formCadastroVenda'),
  inputDataVenda: document.getElementById('inputDataVenda'),
  inputPlaca: document.getElementById('inputPlaca'),
  inputContrato: document.getElementById('inputContrato'),
  selectModelo: document.getElementById('selectModelo'),
  selectAnoModelo: document.getElementById('selectAnoModelo'),

  erroDataVenda: document.getElementById('erroDataVenda'),
  erroPlaca: document.getElementById('erroPlaca'),
  erroContrato: document.getElementById('erroContrato'),
  erroModelo: document.getElementById('erroModelo'),
  erroAnoModelo: document.getElementById('erroAnoModelo'),

  botoesPeriodoPainel: document.querySelectorAll('.btn-painel-period'),

  kpiTotalVendas: document.getElementById('kpiTotalVendas'),
  kpiPeriodoTexto: document.getElementById('kpiPeriodoTexto'),
  kpiModeloMaisVendido: document.getElementById('kpiModeloMaisVendido'),
  kpiModeloDetalhe: document.getElementById('kpiModeloDetalhe'),
  kpiAnoMaisVendido: document.getElementById('kpiAnoMaisVendido'),
  kpiAnoDetalhe: document.getElementById('kpiAnoDetalhe'),

  // Controles do Gráfico do Consultor (Item 2.4)
  selectPainelGraficoDimensao: document.getElementById('selectPainelGraficoDimensao'),
  selectPainelGraficoTipo: document.getElementById('selectPainelGraficoTipo'),
  helperPainelGraficoDimensao: document.getElementById('helperPainelGraficoDimensao'),
  btnBaixarPNGPainel: document.getElementById('btnBaixarPNGPainel'),
  canvasGraficoPainel: document.getElementById('canvasGraficoPainel'),
  containerCanvasPainel: document.getElementById('containerCanvasPainel'),
  emptyStateGraficoPainel: document.getElementById('emptyStateGraficoPainel'),
  erroCDNGraficoPainel: document.getElementById('erroCDNGraficoPainel'),
  detailsTabelaDadosPainel: document.getElementById('detailsTabelaDadosPainel'),
  theadTabelaDadosPainel: document.getElementById('theadTabelaDadosPainel'),
  tbodyTabelaDadosPainel: document.getElementById('tbodyTabelaDadosPainel'),

  tbodyVendasPorModelo: document.getElementById('tbodyVendasPorModelo'),
  tbodyVendasPorAno: document.getElementById('tbodyVendasPorAno'),
  thSortModelo: document.getElementById('thSortModelo'),
  thSortAno: document.getElementById('thSortAno'),
  btnSortModeloQtd: document.getElementById('btnSortModeloQtd'),
  btnSortAnoQtd: document.getElementById('btnSortAnoQtd'),
  sortIconModelo: document.getElementById('sortIconModelo'),
  sortIconAno: document.getElementById('sortIconAno'),

  tabelaListaVendas: document.getElementById('tabelaListaVendas'),
  thColunaAcoesPainel: document.getElementById('thColunaAcoesPainel'),
  tbodyListaVendas: document.getElementById('tbodyListaVendas'),
  emptyStateVendas: document.getElementById('emptyStateVendas'),
  emptyStateTextoPainel: document.getElementById('emptyStateTextoPainel'),

  modalConfirmarExclusao: document.getElementById('modalConfirmarExclusao'),
  formConfirmarExclusao: document.getElementById('formConfirmarExclusao'),
  excluirPlacaModal: document.getElementById('excluirPlacaModal'),
  excluirContratoModal: document.getElementById('excluirContratoModal'),
  btnCancelarExclusao: document.getElementById('btnCancelarExclusao'),
  btnConfirmarExclusaoFinal: document.getElementById('btnConfirmarExclusaoFinal'),

  btnRestaurarDemo: document.getElementById('btnRestaurarDemo'),
  modalConfirmarReset: document.getElementById('modalConfirmarReset'),
  formConfirmarReset: document.getElementById('formConfirmarReset'),
  btnCancelarReset: document.getElementById('btnCancelarReset')
};

let timerExpiracaoSessao = null;

function limparTimerExpiracaoSessao() {
  if (timerExpiracaoSessao !== null) {
    clearTimeout(timerExpiracaoSessao);
    timerExpiracaoSessao = null;
  }
}

function handleSessaoExpiradaUI() {
  limparTimerExpiracaoSessao();
  atualizarUIEstadoAutenticacao();
  resetarFormularioVenda();
  carregarListaConsultores(appState.consultorAtivoId);

  if (appState.abaAtiva === 'nova-venda' || window.location.hash === '#nova-venda') {
    selecionarAba('ranking', { atualizarHash: true });
  }

  renderRankingGeral();
  atualizarPainelConsultor();
  showToast('Sua sessão expirou. Faça login novamente.', 'info');
}

function agendarVerificacaoExpiracaoSessao() {
  limparTimerExpiracaoSessao();
  const msRestantes = obterMsAteExpirarSessao();
  if (msRestantes === null) return;

  if (msRestantes <= 0) {
    handleSessaoExpiradaUI();
    return;
  }

  timerExpiracaoSessao = setTimeout(() => {
    const sessao = getSessaoAtiva();
    if (!sessao) {
      handleSessaoExpiradaUI();
    } else {
      agendarVerificacaoExpiracaoSessao();
    }
  }, msRestantes + 50);
}

function initApp() {
  inicializarSeedSeNecessario();
  inicializarCampoDataVenda();
  popularSelectModelosVenda();

  // Item 1.3: Seções Matriz, Vendas gerais e BI abertas no desktop e fechadas no celular
  sincronizarSecoesRecolhiveis('.collapsible-section');

  initAuth({
    onLoginSuccess: (usuarioLogado) => {
      agendarVerificacaoExpiracaoSessao();
      appState.consultorAtivoId = usuarioLogado.consultorId;
      setConsultorAtivoId(usuarioLogado.consultorId);
      carregarListaConsultores(usuarioLogado.consultorId);

      renderRankingGeral();
      atualizarPainelConsultor();
      selecionarAba('nova-venda', { atualizarHash: true });
    },
    onLogoutSuccess: () => {
      limparTimerExpiracaoSessao();
      resetarFormularioVenda();
      atualizarUIEstadoAutenticacao();
      renderRankingGeral();
      atualizarPainelConsultor();
      selecionarAba('ranking', { atualizarHash: true });
    }
  });

  const sessaoInicial = getSessaoAtiva();
  agendarVerificacaoExpiracaoSessao();
  carregarListaConsultores(sessaoInicial ? sessaoInicial.consultorId : null);

  initRanking();
  setupEventListeners();

  const abaInicial = obterAbaDaURL(window.location.hash);
  selecionarAba(abaInicial, { atualizarHash: Boolean(window.location.hash) });

  atualizarPainelConsultor();
}

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

function recalcularLimitesDataVenda() {
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

function resetarFormularioVenda() {
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

  if (!idEscolhido && consultores.length > 0) {
    idEscolhido = consultores[0].id;
    DOM.selectConsultor.value = idEscolhido;
  }

  appState.consultorAtivoId = idEscolhido;
  setConsultorAtivoId(idEscolhido);
}

function atualizarPainelConsultor() {
  const consultores = getConsultores();
  const sessao = getSessaoAtiva();

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

  renderDadosPainelConsultor(ehProprioUsuario, consultorSelecionado.nome);
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

function renderDadosPainelConsultor(ehProprioUsuario, nomeConsultor = 'Consultor') {
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
  renderGraficoDoConsultorNoPainel(vendasPeriodo, nomeConsultor);
  renderTabelaModelosPainel(vendasPeriodo);
  renderTabelaAnosPainel(vendasPeriodo);
  renderListaVendasPainel(vendasPeriodo, podeExcluir);
}

/**
 * Atualiza controles e renderiza o Card "Gráfico do consultor" na aba Painel (Item 2.4).
 */
function renderGraficoDoConsultorNoPainel(
  vendasPeriodo = getVendasDoPeriodoPainel(),
  nomeConsultor = 'Consultor'
) {
  if (DOM.selectPainelGraficoDimensao && DOM.helperPainelGraficoDimensao) {
    const ehLinha = appState.tipoGraficoPainel === 'linha';
    DOM.selectPainelGraficoDimensao.disabled = ehLinha;
    DOM.helperPainelGraficoDimensao.textContent = ehLinha
      ? 'Na evolução em linha, o gráfico mostra o total de vendas ao longo do período.'
      : 'Agrupamento das vendas do consultor.';
  }

  renderGraficoConsultorPainel({
    vendas: vendasPeriodo,
    tipo: appState.tipoGraficoPainel,
    dimensao: appState.dimensaoGraficoPainel,
    periodo: appState.periodoPainel,
    nomeConsultor,
    elementos: {
      canvas: DOM.canvasGraficoPainel,
      containerCanvas: DOM.containerCanvasPainel,
      boxVazio: DOM.emptyStateGraficoPainel,
      boxErroCDN: DOM.erroCDNGraficoPainel,
      detailsTabela: DOM.detailsTabelaDadosPainel,
      theadTabela: DOM.theadTabelaDadosPainel,
      tbodyTabela: DOM.tbodyTabelaDadosPainel,
      btnDownload: DOM.btnBaixarPNGPainel
    }
  });
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

function renderListaVendasPainel(vendasPeriodo, podeExcluir) {
  DOM.tbodyListaVendas.replaceChildren();

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

    const tdData = document.createElement('td');
    tdData.setAttribute('data-label', 'Data/Hora');
    tdData.textContent = formatarDataHora(venda.dataVenda);

    const tdPlaca = document.createElement('td');
    tdPlaca.setAttribute('data-label', 'Placa');
    const spanPlaca = document.createElement('span');
    spanPlaca.className = 'plate-tag';
    spanPlaca.textContent = formatarPlaca(venda.placa);
    tdPlaca.appendChild(spanPlaca);

    const tdContrato = document.createElement('td');
    tdContrato.setAttribute('data-label', 'Contrato');
    const spanContrato = document.createElement('span');
    spanContrato.className = 'contract-tag';
    spanContrato.textContent = venda.numeroContrato;
    tdContrato.appendChild(spanContrato);

    const tdModelo = document.createElement('td');
    tdModelo.setAttribute('data-label', 'Modelo');
    const strongModelo = document.createElement('strong');
    strongModelo.textContent = venda.modelo;
    tdModelo.appendChild(strongModelo);

    const tdAno = document.createElement('td');
    tdAno.setAttribute('data-label', 'Ano');
    tdAno.textContent = String(venda.anoModelo);

    tr.appendChild(tdData);
    tr.appendChild(tdPlaca);
    tr.appendChild(tdContrato);
    tr.appendChild(tdModelo);
    tr.appendChild(tdAno);

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
    agendarVerificacaoExpiracaoSessao();

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

function setupEventListeners() {
  inicializarNavegacaoAbas((abaEscolhida, opcoes) => {
    selecionarAba(abaEscolhida, opcoes);
  });

  window.addEventListener('hashchange', () => {
    const abaHash = obterAbaDaURL(window.location.hash);
    selecionarAba(abaHash, { atualizarHash: false });
  });

  window.addEventListener('popstate', () => {
    const abaHash = obterAbaDaURL(window.location.hash);
    selecionarAba(abaHash, { atualizarHash: false });
    sincronizarRankingComURL();
  });

  // Atualiza <details> e gráficos ao cruzar o breakpoint 600px (Item 1.3 e 2.5)
  window.addEventListener('resize', () => {
    const agoraCelular = window.innerWidth <= 600;
    if (agoraCelular !== appState.eraCelular600) {
      appState.eraCelular600 = agoraCelular;
      sincronizarSecoesRecolhiveis('.collapsible-section');
      renderRankingGeral();
      atualizarPainelConsultor();
    }
  });

  if (DOM.selectConsultor) {
    DOM.selectConsultor.addEventListener('change', (e) => {
      appState.consultorAtivoId = e.target.value || null;
      setConsultorAtivoId(appState.consultorAtivoId);
      atualizarPainelConsultor();
    });
  }

  configurarControleSegmentado(
    DOM.botoesPeriodoPainel,
    (novoPeriodo) => {
      appState.periodoPainel = novoPeriodo;
      atualizarPainelConsultor();
    },
    'period'
  );

  // Controles do Card "Gráfico do consultor" no Painel (Item 2.4)
  if (DOM.selectPainelGraficoDimensao) {
    DOM.selectPainelGraficoDimensao.addEventListener('change', (e) => {
      appState.dimensaoGraficoPainel = e.target.value === 'anoModelo' ? 'anoModelo' : 'modelo';
      atualizarPainelConsultor();
    });
  }

  if (DOM.selectPainelGraficoTipo) {
    DOM.selectPainelGraficoTipo.addEventListener('change', (e) => {
      const val = e.target.value;
      appState.tipoGraficoPainel = ['colunas', 'pizza', 'linha'].includes(val)
        ? val
        : 'colunas';
      atualizarPainelConsultor();
    });
  }

  if (DOM.btnBaixarPNGPainel) {
    DOM.btnBaixarPNGPainel.addEventListener('click', () => {
      const ok = exportarGraficoPNG('painel-consultor', appState.tipoGraficoPainel);
      if (!ok) {
        showToast('Gráfico indisponível para exportação no momento.', 'error');
      }
    });
  }

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

  // Sincronização entre abas (Itens 1.1, 1.2, 2.3 e F)
  window.addEventListener('storage', (event) => {
    // Item 1.1: Bloqueio de tentativas de login sincronizado entre abas
    if (event.key === STORAGE_KEYS.TENTATIVAS_LOGIN) {
      verificarEIniciarContagemBloqueio();
      return;
    }

    // Item 1.2: Sessão compartilhada entre abas (login/logout em uma aba reflete nas outras)
    if (event.key === STORAGE_KEYS.SESSAO) {
      const sessaoAtual = getSessaoAtiva();
      agendarVerificacaoExpiracaoSessao();
      atualizarUIEstadoAutenticacao();

      if (sessaoAtual) {
        fecharModalLogin();
        appState.consultorAtivoId = sessaoAtual.consultorId;
        carregarListaConsultores(sessaoAtual.consultorId);
      } else {
        resetarFormularioVenda();
        carregarListaConsultores(appState.consultorAtivoId);
        // Se estava em #nova-venda e a sessão acabou, voltar para #ranking
        if (appState.abaAtiva === 'nova-venda' || window.location.hash === '#nova-venda') {
          selecionarAba('ranking', { atualizarHash: true });
        }
      }

      renderRankingGeral();
      atualizarPainelConsultor();
      return;
    }

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

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const msRestantes = obterMsAteExpirarSessao();
      if (msRestantes !== null && msRestantes <= 0) {
        getSessaoAtiva();
        handleSessaoExpiradaUI();
      } else {
        agendarVerificacaoExpiracaoSessao();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', initApp);
