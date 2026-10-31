/**
 * Módulo da Aba "Ranking geral" (ranking.js — Parte E + Ajustes 1.3 e BI 2.3):
 * Gerencia filtros combinados e parâmetros de BI na URL (?periodo=...&modelo=...&ano=...&grafico=...&dim=...#ranking),
 * KPIs do recorte, seção "BI · Análise visual", tabela de Ranking de Competição (1, 1, 3),
 * Matriz cruzada com coluna Consultor fixa e listagem de Vendas Gerais paginada (10 no celular / 20 no desktop).
 */

import { getModelos, getAnosPorModelo, getTodosAnos } from './catalog.js';
import { getConsultores, getVendas, getSessaoAtiva } from './storage.js';
import {
  filtrarVendas,
  gerarRanking,
  gerarMatriz,
  calcularLiderComEmpate,
  formatarDataHora,
  formatarPlaca
} from './utils.js';
import { atualizarBotoesSegmentados, configurarControleSegmentado, showToast } from './ui.js';
import { renderGraficoRankingBI, exportarGraficoPNG } from './charts.js';

const PERIODOS_VALIDOS = ['dia', 'semana', 'mes'];
export const TIPOS_GRAFICO_BI = ['colunas', 'pizza', 'empilhadas', 'linha', 'dispersao'];
export const DIMENSOES_BI = ['consultor', 'modelo', 'anoModelo'];

function obterPassoPaginacaoVendasGerais() {
  if (typeof window !== 'undefined' && window.innerWidth <= 600) {
    return 10;
  }
  return 20;
}

const rankingState = {
  periodo: 'mes',
  modelo: '',
  ano: '',
  graficoBI: 'colunas',
  dimensaoBI: 'modelo',
  dicaEmpilhadoPorModelo: false,
  consultorVendasGerais: '',
  sortColuna: 'vendas',
  sortDirecao: 'desc',
  dimensaoMatriz: 'modelo',
  limiteVendasGerais: 20
};

export function initRanking() {
  rankingState.limiteVendasGerais = obterPassoPaginacaoVendasGerais();
  popularSelectModeloFiltro();
  lerFiltrosDaURL();
  popularSelectAnoFiltro();
  popularSelectConsultorVendasGerais();
  sincronizarControlesComEstado();
  setupRankingListeners();
  renderRankingGeral();
}

/**
 * Lê e valida os parâmetros de filtro e BI da URL (?periodo=...&modelo=...&ano=...&grafico=...&dim=...),
 * aplicando padrões seguros para valores inválidos (Itens E1 e 2.3).
 */
export function lerFiltrosDaURL() {
  const params = new URLSearchParams(window.location.search);

  const periodoParam = (params.get('periodo') || '').trim().toLowerCase();
  rankingState.periodo = PERIODOS_VALIDOS.includes(periodoParam) ? periodoParam : 'mes';

  const modelosValidos = getModelos();
  const modeloParam = (params.get('modelo') || '').trim();
  rankingState.modelo = modelosValidos.includes(modeloParam) ? modeloParam : '';

  const anosPermitidos = rankingState.modelo
    ? getAnosPorModelo(rankingState.modelo)
    : getTodosAnos();

  const anoParamRaw = (params.get('ano') || '').trim();
  const anoNum = Number(anoParamRaw);
  if (anoParamRaw && !isNaN(anoNum) && anosPermitidos.includes(anoNum)) {
    rankingState.ano = String(anoNum);
  } else {
    rankingState.ano = '';
  }

  const graficoParam = (params.get('grafico') || '').trim().toLowerCase();
  rankingState.graficoBI = TIPOS_GRAFICO_BI.includes(graficoParam) ? graficoParam : 'colunas';

  const dimParam = (params.get('dim') || '').trim();
  rankingState.dimensaoBI = DIMENSOES_BI.includes(dimParam) ? dimParam : 'modelo';

  aplicarRegrasCompatibilidadeBI();
}

/**
 * Aplica regras de compatibilidade entre Tipo de Gráfico e Dimensão no BI (Item 2.3):
 * Em "Colunas empilhadas", o eixo X já é Consultores; se "Consultor" estiver selecionado em "Agrupar por",
 * muda automaticamente para "Modelo" e ativa a dica "Empilhado por modelo".
 */
function aplicarRegrasCompatibilidadeBI() {
  const selectDim = document.getElementById('selectBIDimensao');
  const helperDim = document.getElementById('helperBIDimensao');

  if (rankingState.graficoBI === 'empilhadas') {
    if (rankingState.dimensaoBI === 'consultor') {
      rankingState.dimensaoBI = 'modelo';
      rankingState.dicaEmpilhadoPorModelo = true;
    }
  } else {
    rankingState.dicaEmpilhadoPorModelo = false;
  }

  if (selectDim) {
    const optConsultor = selectDim.querySelector('option[value="consultor"]');
    if (optConsultor) {
      optConsultor.disabled = rankingState.graficoBI === 'empilhadas';
    }
    selectDim.value = rankingState.dimensaoBI;
  }

  if (helperDim) {
    if (rankingState.graficoBI === 'empilhadas') {
      helperDim.textContent = rankingState.dicaEmpilhadoPorModelo
        ? 'Empilhado por modelo (eixo X exibe os consultores).'
        : 'Eixo X fixo em consultores; escolha a dimensão das pilhas.';
    } else if (rankingState.graficoBI === 'linha') {
      helperDim.textContent =
        'Exibe linha Total + até 5 maiores itens da dimensão (restante em Outros).';
    } else if (rankingState.graficoBI === 'dispersao') {
      helperDim.textContent = 'Cor de cada venda (ponto) agrupada pela dimensão escolhida.';
    } else {
      helperDim.textContent = 'Dimensão usada para agrupar as vendas no gráfico.';
    }
  }
}

/**
 * Atualiza a query string na URL refletindo os filtros e escolhas do BI (Itens E1 e 2.3).
 */
export function atualizarURLFiltrosRanking() {
  const partes = [];
  partes.push(`periodo=${encodeURIComponent(rankingState.periodo)}`);

  if (rankingState.modelo) {
    partes.push(`modelo=${encodeURIComponent(rankingState.modelo)}`);
  }

  if (rankingState.ano) {
    partes.push(`ano=${encodeURIComponent(rankingState.ano)}`);
  }

  partes.push(`grafico=${encodeURIComponent(rankingState.graficoBI)}`);
  partes.push(`dim=${encodeURIComponent(rankingState.dimensaoBI)}`);

  const queryString = partes.length > 0 ? `?${partes.join('&')}` : '';
  const hashAtual = window.location.hash || '#ranking';
  const novaUrl = `${window.location.pathname}${queryString}${hashAtual}`;

  window.history.replaceState(null, '', novaUrl);
}

function popularSelectModeloFiltro() {
  const select = document.getElementById('filtroRankingModelo');
  if (!select) return;

  select.replaceChildren();
  const optTodos = document.createElement('option');
  optTodos.value = '';
  optTodos.textContent = 'Todos os modelos';
  select.appendChild(optTodos);

  getModelos().forEach((modelo) => {
    const opt = document.createElement('option');
    opt.value = modelo;
    opt.textContent = modelo;
    select.appendChild(opt);
  });
}

function popularSelectAnoFiltro() {
  const select = document.getElementById('filtroRankingAno');
  if (!select) return;

  const anosPermitidos = rankingState.modelo
    ? getAnosPorModelo(rankingState.modelo)
    : getTodosAnos();

  if (rankingState.ano && !anosPermitidos.includes(Number(rankingState.ano))) {
    rankingState.ano = '';
  }

  select.replaceChildren();
  const optTodos = document.createElement('option');
  optTodos.value = '';
  optTodos.textContent = 'Todos os anos';
  select.appendChild(optTodos);

  anosPermitidos.forEach((ano) => {
    const opt = document.createElement('option');
    opt.value = String(ano);
    opt.textContent = String(ano);
    if (String(ano) === rankingState.ano) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });

  select.value = rankingState.ano;
}

export function popularSelectConsultorVendasGerais() {
  const select = document.getElementById('filtroVendasGeraisConsultor');
  if (!select) return;

  const consultores = getConsultores();
  const valorAnterior = rankingState.consultorVendasGerais;

  select.replaceChildren();
  const optTodos = document.createElement('option');
  optTodos.value = '';
  optTodos.textContent = 'Todos os consultores';
  select.appendChild(optTodos);

  let aindaExiste = false;
  consultores.forEach((c) => {
    if (!c) return;
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nome;
    if (c.id === valorAnterior) {
      opt.selected = true;
      aindaExiste = true;
    }
    select.appendChild(opt);
  });

  if (!aindaExiste) {
    rankingState.consultorVendasGerais = '';
    select.value = '';
  }
}

function sincronizarControlesComEstado() {
  const botoesPeriodo = document.querySelectorAll('.btn-ranking-period');
  atualizarBotoesSegmentados(botoesPeriodo, rankingState.periodo, 'period');

  const selectModelo = document.getElementById('filtroRankingModelo');
  if (selectModelo) selectModelo.value = rankingState.modelo;

  const selectAno = document.getElementById('filtroRankingAno');
  if (selectAno) selectAno.value = rankingState.ano;

  const selectBITipo = document.getElementById('selectBITipoGrafico');
  if (selectBITipo) selectBITipo.value = rankingState.graficoBI;

  aplicarRegrasCompatibilidadeBI();

  const botoesMatriz = document.querySelectorAll('.btn-matriz-dimensao');
  atualizarBotoesSegmentados(botoesMatriz, rankingState.dimensaoMatriz, 'dimensao');
}

function setupRankingListeners() {
  const botoesPeriodo = document.querySelectorAll('.btn-ranking-period');
  configurarControleSegmentado(
    botoesPeriodo,
    (novoPeriodo) => {
      rankingState.periodo = novoPeriodo;
      rankingState.limiteVendasGerais = obterPassoPaginacaoVendasGerais();
      atualizarURLFiltrosRanking();
      renderRankingGeral();
    },
    'period'
  );

  const selectModelo = document.getElementById('filtroRankingModelo');
  if (selectModelo) {
    selectModelo.addEventListener('change', (e) => {
      rankingState.modelo = e.target.value;
      popularSelectAnoFiltro();
      rankingState.limiteVendasGerais = obterPassoPaginacaoVendasGerais();
      atualizarURLFiltrosRanking();
      renderRankingGeral();
    });
  }

  const selectAno = document.getElementById('filtroRankingAno');
  if (selectAno) {
    selectAno.addEventListener('change', (e) => {
      rankingState.ano = e.target.value;
      rankingState.limiteVendasGerais = obterPassoPaginacaoVendasGerais();
      atualizarURLFiltrosRanking();
      renderRankingGeral();
    });
  }

  const btnLimparFiltros = document.getElementById('btnLimparFiltrosRanking');
  if (btnLimparFiltros) {
    btnLimparFiltros.addEventListener('click', () => {
      rankingState.periodo = 'mes';
      rankingState.modelo = '';
      rankingState.ano = '';
      rankingState.consultorVendasGerais = '';
      rankingState.limiteVendasGerais = obterPassoPaginacaoVendasGerais();

      popularSelectAnoFiltro();
      popularSelectConsultorVendasGerais();
      sincronizarControlesComEstado();
      atualizarURLFiltrosRanking();
      renderRankingGeral();
    });
  }

  // Controles do BI (Item 2.3)
  const selectBITipo = document.getElementById('selectBITipoGrafico');
  if (selectBITipo) {
    selectBITipo.addEventListener('change', (e) => {
      const novoTipo = e.target.value;
      rankingState.graficoBI = TIPOS_GRAFICO_BI.includes(novoTipo) ? novoTipo : 'colunas';
      aplicarRegrasCompatibilidadeBI();
      atualizarURLFiltrosRanking();
      renderSecaoBIRanking();
    });
  }

  const selectBIDim = document.getElementById('selectBIDimensao');
  if (selectBIDim) {
    selectBIDim.addEventListener('change', (e) => {
      const novaDim = e.target.value;
      rankingState.dimensaoBI = DIMENSOES_BI.includes(novaDim) ? novaDim : 'modelo';
      rankingState.dicaEmpilhadoPorModelo = false;
      aplicarRegrasCompatibilidadeBI();
      atualizarURLFiltrosRanking();
      renderSecaoBIRanking();
    });
  }

  const btnBaixarPNGBI = document.getElementById('btnBaixarPNGBI');
  if (btnBaixarPNGBI) {
    btnBaixarPNGBI.addEventListener('click', () => {
      const ok = exportarGraficoPNG('ranking-bi', rankingState.graficoBI);
      if (!ok) {
        showToast('Gráfico indisponível para exportação no momento.', 'error');
      }
    });
  }

  // Ordenação da tabela de Ranking de Consultores (Item E3)
  const btnSortConsultor = document.getElementById('btnSortRankingConsultor');
  const btnSortVendas = document.getElementById('btnSortRankingVendas');

  if (btnSortConsultor) {
    btnSortConsultor.addEventListener('click', () => {
      if (rankingState.sortColuna === 'nome') {
        rankingState.sortDirecao = rankingState.sortDirecao === 'asc' ? 'desc' : 'asc';
      } else {
        rankingState.sortColuna = 'nome';
        rankingState.sortDirecao = 'asc';
      }
      atualizarCabecalhosSortRanking();
      renderRankingGeral();
    });
  }

  if (btnSortVendas) {
    btnSortVendas.addEventListener('click', () => {
      if (rankingState.sortColuna === 'vendas') {
        rankingState.sortDirecao = rankingState.sortDirecao === 'desc' ? 'asc' : 'desc';
      } else {
        rankingState.sortColuna = 'vendas';
        rankingState.sortDirecao = 'desc';
      }
      atualizarCabecalhosSortRanking();
      renderRankingGeral();
    });
  }

  // Controle segmentado da Matriz (Por Modelo | Por Ano Modelo — Item E4)
  const botoesMatriz = document.querySelectorAll('.btn-matriz-dimensao');
  configurarControleSegmentado(
    botoesMatriz,
    (novaDimensao) => {
      rankingState.dimensaoMatriz = novaDimensao;
      renderRankingGeral();
    },
    'dimensao'
  );

  // Filtro extra por consultor nas Vendas Gerais (Item E5)
  const selectConsultorGerais = document.getElementById('filtroVendasGeraisConsultor');
  if (selectConsultorGerais) {
    selectConsultorGerais.addEventListener('change', (e) => {
      rankingState.consultorVendasGerais = e.target.value;
      rankingState.limiteVendasGerais = obterPassoPaginacaoVendasGerais();
      renderVendasGerais();
    });
  }

  // Botão "Mostrar mais" (10 no celular / 20 no desktop — Item 1.3 e E5)
  const btnMostrarMais = document.getElementById('btnMostrarMaisVendasGerais');
  if (btnMostrarMais) {
    btnMostrarMais.addEventListener('click', () => {
      rankingState.limiteVendasGerais += obterPassoPaginacaoVendasGerais();
      renderVendasGerais();
    });
  }
}

function atualizarCabecalhosSortRanking() {
  const thConsultor = document.getElementById('thSortRankingConsultor');
  const thVendas = document.getElementById('thSortRankingVendas');
  const iconConsultor = document.getElementById('sortIconRankingConsultor');
  const iconVendas = document.getElementById('sortIconRankingVendas');

  if (thConsultor && iconConsultor) {
    if (rankingState.sortColuna === 'nome') {
      thConsultor.setAttribute(
        'aria-sort',
        rankingState.sortDirecao === 'asc' ? 'ascending' : 'descending'
      );
      iconConsultor.textContent = rankingState.sortDirecao === 'asc' ? '▲' : '▼';
      iconConsultor.classList.add('active');
    } else {
      thConsultor.setAttribute('aria-sort', 'none');
      iconConsultor.textContent = '↕';
      iconConsultor.classList.remove('active');
    }
  }

  if (thVendas && iconVendas) {
    if (rankingState.sortColuna === 'vendas') {
      thVendas.setAttribute(
        'aria-sort',
        rankingState.sortDirecao === 'asc' ? 'ascending' : 'descending'
      );
      iconVendas.textContent = rankingState.sortDirecao === 'asc' ? '▲' : '▼';
      iconVendas.classList.add('active');
    } else {
      thVendas.setAttribute('aria-sort', 'none');
      iconVendas.textContent = '↕';
      iconVendas.classList.remove('active');
    }
  }
}

function obterVendasFiltradasRanking() {
  const todasVendas = getVendas();
  return filtrarVendas(todasVendas, {
    periodo: rankingState.periodo,
    modelo: rankingState.modelo,
    ano: rankingState.ano
  });
}

export function renderRankingGeral() {
  popularSelectConsultorVendasGerais();
  const consultores = getConsultores();
  const vendasRecorte = obterVendasFiltradasRanking();

  renderKPIsRanking(vendasRecorte, consultores);
  renderSecaoBIRanking(vendasRecorte, consultores);
  renderTabelaRankingConsultores(vendasRecorte, consultores);
  renderMatrizConsultores(vendasRecorte, consultores);
  renderVendasGerais(vendasRecorte, consultores);
}

/**
 * Monta o título dinâmico do BI (ex: "Vendas por modelo · Semana atual · Ano 2026")
 * e renderiza o gráfico da seção "BI · Análise visual" (Item 2.3).
 */
function renderSecaoBIRanking(
  vendasRecorte = obterVendasFiltradasRanking(),
  consultores = getConsultores()
) {
  const elTitulo = document.getElementById('tituloDinamicoBI');

  const mapaDimensao = {
    consultor: 'consultor',
    modelo: 'modelo',
    anoModelo: 'ano modelo'
  };
  const mapaPeriodo = {
    dia: 'Hoje',
    semana: 'Semana atual',
    mes: 'Mês atual'
  };

  let prefixo = `Vendas por ${mapaDimensao[rankingState.dimensaoBI] || 'modelo'}`;
  if (rankingState.graficoBI === 'empilhadas') {
    const dimPilha = rankingState.dimensaoBI === 'anoModelo' ? 'ano modelo' : 'modelo';
    prefixo = `Vendas por consultor (empilhado por ${dimPilha})`;
  } else if (rankingState.graficoBI === 'linha') {
    prefixo = `Evolução de vendas por ${mapaDimensao[rankingState.dimensaoBI] || 'modelo'}`;
  } else if (rankingState.graficoBI === 'dispersao') {
    prefixo = `Horário das vendas por ${mapaDimensao[rankingState.dimensaoBI] || 'modelo'}`;
  }

  const partesTitulo = [prefixo, mapaPeriodo[rankingState.periodo] || 'Mês atual'];
  if (rankingState.modelo) partesTitulo.push(rankingState.modelo);
  if (rankingState.ano) partesTitulo.push(`Ano ${rankingState.ano}`);

  if (elTitulo) {
    elTitulo.textContent = partesTitulo.join(' · ');
  }

  renderGraficoRankingBI({
    vendas: vendasRecorte,
    consultores,
    tipo: rankingState.graficoBI,
    dimensao: rankingState.dimensaoBI,
    periodo: rankingState.periodo,
    elementos: {
      canvas: document.getElementById('canvasGraficoBI'),
      containerCanvas: document.getElementById('containerCanvasBI'),
      boxVazio: document.getElementById('emptyStateGraficoBI'),
      boxErroCDN: document.getElementById('erroCDNGraficoBI'),
      detailsTabela: document.getElementById('detailsTabelaDadosBI'),
      theadTabela: document.getElementById('theadTabelaDadosBI'),
      tbodyTabela: document.getElementById('tbodyTabelaDadosBI'),
      btnDownload: document.getElementById('btnBaixarPNGBI')
    }
  });
}

function renderKPIsRanking(vendasRecorte, consultores) {
  const elTotal = document.getElementById('kpiRankingTotal');
  const elTotalDetalhe = document.getElementById('kpiRankingTotalDetalhe');
  const elLider = document.getElementById('kpiRankingLider');
  const elLiderDetalhe = document.getElementById('kpiRankingLiderDetalhe');
  const elModelo = document.getElementById('kpiRankingModelo');
  const elModeloDetalhe = document.getElementById('kpiRankingModeloDetalhe');
  const elAno = document.getElementById('kpiRankingAno');
  const elAnoDetalhe = document.getElementById('kpiRankingAnoDetalhe');

  const rotulosPeriodo = {
    dia: 'Hoje',
    semana: 'Nesta semana',
    mes: 'Neste mês'
  };
  const partesFiltro = [rotulosPeriodo[rankingState.periodo] || 'No período'];
  if (rankingState.modelo) partesFiltro.push(rankingState.modelo);
  if (rankingState.ano) partesFiltro.push(`Ano ${rankingState.ano}`);

  if (elTotal) elTotal.textContent = String(vendasRecorte.length);
  if (elTotalDetalhe) elTotalDetalhe.textContent = partesFiltro.join(' · ');

  const mapaConsultores = new Map();
  consultores.forEach((c) => {
    if (c && c.id) mapaConsultores.set(c.id, c.nome);
  });

  const liderConsultor = calcularLiderComEmpate(
    vendasRecorte,
    'consultorId',
    mapaConsultores,
    'venda',
    'vendas'
  );
  if (elLider) elLider.textContent = liderConsultor.valorPrincipal;
  if (elLiderDetalhe) elLiderDetalhe.textContent = liderConsultor.detalhe;

  const liderModelo = calcularLiderComEmpate(vendasRecorte, 'modelo', null, 'unidade', 'unidades');
  if (elModelo) elModelo.textContent = liderModelo.valorPrincipal;
  if (elModeloDetalhe) elModeloDetalhe.textContent = liderModelo.detalhe;

  const liderAno = calcularLiderComEmpate(vendasRecorte, 'anoModelo', null, 'unidade', 'unidades');
  if (elAno) elAno.textContent = liderAno.valorPrincipal;
  if (elAnoDetalhe) elAnoDetalhe.textContent = liderAno.detalhe;
}

function criarElementoPosicaoRanking(posicao, qtdVendas) {
  const badge = document.createElement('span');

  if (posicao === 1 && qtdVendas > 0) {
    badge.className = 'medal-badge medal-gold';
    badge.setAttribute('aria-label', '1º lugar - Medalha de Ouro');
    badge.textContent = '1º · Ouro';
  } else if (posicao === 2 && qtdVendas > 0) {
    badge.className = 'medal-badge medal-silver';
    badge.setAttribute('aria-label', '2º lugar - Medalha de Prata');
    badge.textContent = '2º · Prata';
  } else if (posicao === 3 && qtdVendas > 0) {
    badge.className = 'medal-badge medal-bronze';
    badge.setAttribute('aria-label', '3º lugar - Medalha de Bronze');
    badge.textContent = '3º · Bronze';
  } else {
    badge.className = 'medal-badge medal-regular';
    badge.setAttribute('aria-label', `${posicao}º lugar`);
    badge.textContent = `${posicao}º`;
  }

  return badge;
}

function renderTabelaRankingConsultores(vendasRecorte, consultores) {
  const tbody = document.getElementById('tbodyRankingConsultores');
  const tabela = document.getElementById('tabelaRankingConsultores');
  const emptyState = document.getElementById('emptyStateRankingConsultores');
  if (!tbody) return;

  tbody.replaceChildren();

  const rankingBase = gerarRanking(vendasRecorte, consultores);

  if (rankingBase.length === 0) {
    if (tabela) tabela.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (tabela) tabela.classList.remove('hidden');
  if (emptyState) emptyState.classList.add('hidden');

  const rankingExibicao = [...rankingBase].sort((a, b) => {
    if (rankingState.sortColuna === 'nome') {
      const cmp = String(a.nome).localeCompare(String(b.nome), 'pt-BR');
      if (cmp !== 0) return rankingState.sortDirecao === 'asc' ? cmp : -cmp;
      return b.vendas - a.vendas;
    }

    const diff = rankingState.sortDirecao === 'desc' ? b.vendas - a.vendas : a.vendas - b.vendas;
    if (diff !== 0) return diff;
    return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
  });

  const usuarioLogado = getSessaoAtiva();

  rankingExibicao.forEach((item) => {
    const tr = document.createElement('tr');
    const isUsuarioLogado =
      Boolean(usuarioLogado) && usuarioLogado.consultorId === item.consultorId;

    if (isUsuarioLogado) {
      tr.classList.add('row-current-user');
    }

    const tdPosicao = document.createElement('td');
    tdPosicao.className = 'whitespace-nowrap';
    tdPosicao.setAttribute('data-label', 'Posição');
    tdPosicao.appendChild(criarElementoPosicaoRanking(item.posicao, item.vendas));

    const tdConsultor = document.createElement('td');
    tdConsultor.setAttribute('data-label', 'Consultor');
    const wrapperNome = document.createElement('div');
    wrapperNome.className = 'consultor-cell-wrapper';

    const strongNome = document.createElement('strong');
    strongNome.textContent = item.nome;
    wrapperNome.appendChild(strongNome);

    if (isUsuarioLogado) {
      const badgeVoce = document.createElement('span');
      badgeVoce.className = 'badge-voce';
      badgeVoce.setAttribute('aria-label', 'Consultor logado (Você)');
      badgeVoce.textContent = 'Você';
      wrapperNome.appendChild(badgeVoce);
    }
    tdConsultor.appendChild(wrapperNome);

    const tdVendas = document.createElement('td');
    tdVendas.className = 'text-right';
    tdVendas.setAttribute('data-label', 'Vendas');
    const spanVendas = document.createElement('span');
    spanVendas.className = `badge-count ${item.posicao === 1 && item.vendas > 0 ? 'top' : ''}`;
    spanVendas.textContent = String(item.vendas);
    tdVendas.appendChild(spanVendas);

    const tdPercentual = document.createElement('td');
    tdPercentual.className = 'text-right';
    tdPercentual.setAttribute('data-label', '% do Total');
    const percFormatado = item.percentual.toFixed(1).replace('.', ',');
    tdPercentual.textContent = `${percFormatado}%`;

    const tdModeloTop = document.createElement('td');
    tdModeloTop.setAttribute('data-label', 'Modelo Mais Vendido');
    tdModeloTop.textContent = item.modeloTop;

    tr.appendChild(tdPosicao);
    tr.appendChild(tdConsultor);
    tr.appendChild(tdVendas);
    tr.appendChild(tdPercentual);
    tr.appendChild(tdModeloTop);

    tbody.appendChild(tr);
  });
}

function renderMatrizConsultores(vendasRecorte, consultores) {
  const thead = document.getElementById('theadMatrizRanking');
  const tbody = document.getElementById('tbodyMatrizRanking');
  const tfoot = document.getElementById('tfootMatrizRanking');
  if (!thead || !tbody || !tfoot) return;

  thead.replaceChildren();
  tbody.replaceChildren();
  tfoot.replaceChildren();

  const matriz = gerarMatriz(vendasRecorte, consultores, rankingState.dimensaoMatriz);
  const usuarioLogado = getSessaoAtiva();

  const trHead = document.createElement('tr');
  const thConsultor = document.createElement('th');
  thConsultor.className = 'sticky-col';
  thConsultor.textContent = 'Consultor';
  trHead.appendChild(thConsultor);

  matriz.colunas.forEach((col) => {
    const th = document.createElement('th');
    th.className = 'text-right';
    th.textContent = String(col);
    trHead.appendChild(th);
  });

  const thTotalLinha = document.createElement('th');
  thTotalLinha.className = 'text-right matrix-total-col';
  thTotalLinha.textContent = 'Total';
  trHead.appendChild(thTotalLinha);
  thead.appendChild(trHead);

  matriz.linhas.forEach((linha) => {
    const tr = document.createElement('tr');
    const isUsuarioLogado =
      Boolean(usuarioLogado) && usuarioLogado.consultorId === linha.consultorId;
    if (isUsuarioLogado) {
      tr.classList.add('row-current-user');
    }

    const tdNome = document.createElement('td');
    tdNome.className = 'sticky-col';
    tdNome.setAttribute('data-label', 'Consultor');
    const wrapperNome = document.createElement('div');
    wrapperNome.className = 'consultor-cell-wrapper';

    const strongNome = document.createElement('strong');
    strongNome.textContent = linha.nome;
    wrapperNome.appendChild(strongNome);

    if (isUsuarioLogado) {
      const badgeVoce = document.createElement('span');
      badgeVoce.className = 'badge-voce';
      badgeVoce.textContent = 'Você';
      wrapperNome.appendChild(badgeVoce);
    }
    tdNome.appendChild(wrapperNome);
    tr.appendChild(tdNome);

    matriz.colunas.forEach((col) => {
      const tdValor = document.createElement('td');
      tdValor.className = 'text-right';
      tdValor.setAttribute('data-label', String(col));
      const qtd = linha.valores[col] || 0;
      tdValor.textContent = String(qtd);
      if (qtd === 0) {
        tdValor.classList.add('matrix-zero');
      }
      tr.appendChild(tdValor);
    });

    const tdTotal = document.createElement('td');
    tdTotal.className = 'text-right matrix-total-col';
    tdTotal.setAttribute('data-label', 'Total do Consultor');
    const strongTotal = document.createElement('strong');
    strongTotal.textContent = String(linha.total);
    tdTotal.appendChild(strongTotal);
    tr.appendChild(tdTotal);

    tbody.appendChild(tr);
  });

  const trFoot = document.createElement('tr');
  trFoot.className = 'matrix-footer-row';

  const tdLabelTotal = document.createElement('td');
  tdLabelTotal.className = 'sticky-col';
  tdLabelTotal.setAttribute('data-label', 'Resumo');
  const strongLabel = document.createElement('strong');
  strongLabel.textContent = 'Total Geral';
  tdLabelTotal.appendChild(strongLabel);
  trFoot.appendChild(tdLabelTotal);

  matriz.colunas.forEach((col) => {
    const tdColTotal = document.createElement('td');
    tdColTotal.className = 'text-right';
    tdColTotal.setAttribute('data-label', `Total ${col}`);
    const strongCol = document.createElement('strong');
    strongCol.textContent = String(matriz.totaisColuna[col] || 0);
    tdColTotal.appendChild(strongCol);
    trFoot.appendChild(tdColTotal);
  });

  const tdTotalGeral = document.createElement('td');
  tdTotalGeral.className = 'text-right matrix-total-col';
  tdTotalGeral.setAttribute('data-label', 'Total Geral do Recorte');
  const spanTotalGeral = document.createElement('span');
  spanTotalGeral.className = 'badge-count top';
  spanTotalGeral.textContent = String(matriz.totalGeral);
  tdTotalGeral.appendChild(spanTotalGeral);
  trFoot.appendChild(tdTotalGeral);

  tfoot.appendChild(trFoot);
}

function renderVendasGerais(
  vendasRecorte = obterVendasFiltradasRanking(),
  consultores = getConsultores()
) {
  const tbody = document.getElementById('tbodyVendasGerais');
  const tabela = document.getElementById('tabelaVendasGerais');
  const emptyState = document.getElementById('emptyStateVendasGerais');
  const boxPaginacao = document.getElementById('paginacaoVendasGeraisBox');
  const infoContagem = document.getElementById('infoContagemVendasGerais');
  const btnMostrarMais = document.getElementById('btnMostrarMaisVendasGerais');

  if (!tbody) return;
  tbody.replaceChildren();

  const vendasComFiltroConsultor = rankingState.consultorVendasGerais
    ? vendasRecorte.filter((v) => v.consultorId === rankingState.consultorVendasGerais)
    : vendasRecorte;

  const vendasOrdenadas = [...vendasComFiltroConsultor].sort(
    (a, b) => new Date(b.dataVenda) - new Date(a.dataVenda)
  );

  if (vendasOrdenadas.length === 0) {
    if (tabela) tabela.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    if (boxPaginacao) boxPaginacao.classList.add('hidden');
    return;
  }

  if (tabela) tabela.classList.remove('hidden');
  if (emptyState) emptyState.classList.add('hidden');

  const mapaConsultores = new Map();
  consultores.forEach((c) => {
    if (c && c.id) mapaConsultores.set(c.id, c.nome);
  });

  const vendasVisiveis = vendasOrdenadas.slice(0, rankingState.limiteVendasGerais);

  vendasVisiveis.forEach((venda) => {
    const tr = document.createElement('tr');

    const tdData = document.createElement('td');
    tdData.setAttribute('data-label', 'Data/Hora');
    tdData.textContent = formatarDataHora(venda.dataVenda);

    const tdConsultor = document.createElement('td');
    tdConsultor.setAttribute('data-label', 'Consultor');
    const strongConsultor = document.createElement('strong');
    strongConsultor.textContent = mapaConsultores.get(venda.consultorId) || 'Consultor';
    tdConsultor.appendChild(strongConsultor);

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
    tdModelo.textContent = venda.modelo;

    const tdAno = document.createElement('td');
    tdAno.className = 'text-right';
    tdAno.setAttribute('data-label', 'Ano');
    tdAno.textContent = String(venda.anoModelo);

    tr.appendChild(tdData);
    tr.appendChild(tdConsultor);
    tr.appendChild(tdPlaca);
    tr.appendChild(tdContrato);
    tr.appendChild(tdModelo);
    tr.appendChild(tdAno);

    tbody.appendChild(tr);
  });

  if (boxPaginacao && infoContagem && btnMostrarMais) {
    boxPaginacao.classList.remove('hidden');
    infoContagem.textContent = `Exibindo ${vendasVisiveis.length} de ${vendasOrdenadas.length} venda${vendasOrdenadas.length === 1 ? '' : 's'}`;

    const passo = obterPassoPaginacaoVendasGerais();
    btnMostrarMais.textContent = `Mostrar mais (+${passo})`;

    const temMais = vendasOrdenadas.length > vendasVisiveis.length;
    btnMostrarMais.classList.toggle('hidden', !temMais);
  }
}

export function sincronizarRankingComURL() {
  lerFiltrosDaURL();
  popularSelectAnoFiltro();
  sincronizarControlesComEstado();
  renderRankingGeral();
}
