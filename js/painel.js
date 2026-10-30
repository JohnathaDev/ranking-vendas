/**
 * Painel do Consultor (painel.js):
 * Gerencia seletor de consultor, filtro de período, KPIs, gráfico individual (Item 2.4),
 * tabelas por modelo/ano com ordenação e histórico de vendas do consultor.
 */

import {
  formatarPlaca,
  formatarDataHora,
  filtrarPorPeriodo,
  agruparPor,
  calcularLiderComEmpate
} from './utils.js';
import {
  getConsultores,
  getConsultorAtivoId,
  setConsultorAtivoId,
  getVendasPorConsultor,
  getSessaoAtiva
} from './storage.js';
import { showToast, configurarControleSegmentado } from './ui.js';
import { renderGraficoConsultorPainel, exportarGraficoPNG } from './charts.js';
import { appState, DOM } from './state.js';

let callbackSolicitarExclusao = null;

export function carregarListaConsultores(preferenciaConsultorId = null) {
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
    opt.textContent = sessao && sessao.consultorId === c.id ? `${c.nome} (Você)` : c.nome;
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

export function atualizarPainelConsultor() {
  const consultores = getConsultores();
  const sessao = getSessaoAtiva();

  if (DOM.selectConsultor) {
    const idAtual = appState.consultorAtivoId || DOM.selectConsultor.value;
    carregarListaConsultores(idAtual);
  }

  const consultorSelecionado = consultores.find((c) => c && c.id === appState.consultorAtivoId);

  if (!consultorSelecionado) {
    if (DOM.labelNomeConsultor) {
      DOM.labelNomeConsultor.textContent = 'Painel do Consultor';
    }
    limparPainelConsultor();
    return;
  }

  const ehProprioUsuario = Boolean(sessao) && sessao.consultorId === consultorSelecionado.id;

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

  const liderModelo = calcularLiderComEmpate(vendasPeriodo, 'modelo', null, 'unidade', 'unidades');
  DOM.kpiModeloMaisVendido.textContent = liderModelo.valorPrincipal;
  DOM.kpiModeloDetalhe.textContent = liderModelo.detalhe;

  const liderAno = calcularLiderComEmpate(vendasPeriodo, 'anoModelo', null, 'unidade', 'unidades');
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
      appState.sortAnoOrdem === 'desc' ? b.quantidade - a.quantidade : a.quantidade - b.quantidade;
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

      btnExcluir.addEventListener('click', () => {
        if (typeof callbackSolicitarExclusao === 'function') {
          callbackSolicitarExclusao(venda);
        }
      });
      tdAcoes.appendChild(btnExcluir);
      tr.appendChild(tdAcoes);
    }

    DOM.tbodyListaVendas.appendChild(tr);
  });
}

export function initPainel({ onSolicitarExclusao } = {}) {
  callbackSolicitarExclusao =
    typeof onSolicitarExclusao === 'function' ? onSolicitarExclusao : null;

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

  if (DOM.selectPainelGraficoDimensao) {
    DOM.selectPainelGraficoDimensao.addEventListener('change', (e) => {
      appState.dimensaoGraficoPainel = e.target.value === 'anoModelo' ? 'anoModelo' : 'modelo';
      atualizarPainelConsultor();
    });
  }

  if (DOM.selectPainelGraficoTipo) {
    DOM.selectPainelGraficoTipo.addEventListener('change', (e) => {
      const val = e.target.value;
      appState.tipoGraficoPainel = ['colunas', 'pizza', 'linha'].includes(val) ? val : 'colunas';
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
}
