/**
 * Módulo da Aba "Ranking geral" (ranking.js — Parte E):
 * Gerencia filtros combinados sincronizados com a URL (?periodo=...&modelo=...&ano=...#ranking),
 * KPIs gerais do recorte, tabela de Ranking de Competição (1, 1, 3) com medalhas acessíveis e etiqueta "Você",
 * Matriz cruzada Consultor x (Modelo | Ano Modelo) e listagem geral paginada (20 por vez).
 */

import { getModelos, getAnosPorModelo, getTodosAnos } from './catalog.js';
import {
  getConsultores,
  getVendas,
  getSessaoAtiva
} from './storage.js';
import {
  filtrarVendas,
  gerarRanking,
  gerarMatriz,
  calcularLiderComEmpate,
  formatarDataHora,
  formatarPlaca
} from './utils.js';
import {
  atualizarBotoesSegmentados,
  configurarControleSegmentado
} from './ui.js';

const ITENS_POR_PAGINA_GERAL = 20;
const PERIODOS_VALIDOS = ['dia', 'semana', 'mes'];

const rankingState = {
  periodo: 'mes', // 'dia' | 'semana' | 'mes' (padrão 'mes' — Item E1)
  modelo: '', // '' = Todos
  ano: '', // '' = Todos
  consultorVendasGerais: '', // '' = Todos (filtro extra da seção E5)
  sortColuna: 'vendas', // 'vendas' | 'nome'
  sortDirecao: 'desc', // 'asc' | 'desc'
  dimensaoMatriz: 'modelo', // 'modelo' | 'anoModelo'
  limiteVendasGerais: ITENS_POR_PAGINA_GERAL
};

/**
 * Inicializa a aba de Ranking Geral, populando selects, lendo parâmetros da URL e registrando eventos.
 */
export function initRanking() {
  popularSelectModeloFiltro();
  lerFiltrosDaURL();
  popularSelectAnoFiltro();
  popularSelectConsultorVendasGerais();
  sincronizarControlesComEstado();
  setupRankingListeners();
  renderRankingGeral();
}

/**
 * Lê e valida os parâmetros de filtro da URL (?periodo=...&modelo=...&ano=...),
 * ignorando quaisquer valores inválidos (Item E1).
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
}

/**
 * Atualiza a query string na URL refletindo os filtros ativos (ex: ?periodo=semana&modelo=Fan%20160&ano=2026#ranking).
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

  const queryString = partes.length > 0 ? `?${partes.join('&')}` : '';
  const hashAtual = window.location.hash || '#ranking';
  const novaUrl = `${window.location.pathname}${queryString}${hashAtual}`;

  window.history.replaceState(null, '', novaUrl);
}

/**
 * Preenche o select de Modelos no filtro do Ranking Geral.
 */
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

/**
 * Preenche o select de Ano Modelo no filtro do Ranking Geral.
 * Se um modelo estiver selecionado, exibe apenas os anos válidos daquele modelo,
 * resetando para "Todos" caso o ano anteriormente selecionado não pertença ao modelo (Item E1).
 */
function popularSelectAnoFiltro() {
  const select = document.getElementById('filtroRankingAno');
  if (!select) return;

  const anosPermitidos = rankingState.modelo
    ? getAnosPorModelo(rankingState.modelo)
    : getTodosAnos();

  // Reseta o ano para "Todos" se ficar inválido para o modelo atual
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

/**
 * Atualiza o select de filtro extra por consultor da tabela de Vendas Gerais (Item E5).
 */
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

/**
 * Sincroniza os botões e selects do DOM com os valores em `rankingState`.
 */
function sincronizarControlesComEstado() {
  const botoesPeriodo = document.querySelectorAll('.btn-ranking-period');
  atualizarBotoesSegmentados(botoesPeriodo, rankingState.periodo, 'period');

  const selectModelo = document.getElementById('filtroRankingModelo');
  if (selectModelo) selectModelo.value = rankingState.modelo;

  const selectAno = document.getElementById('filtroRankingAno');
  if (selectAno) selectAno.value = rankingState.ano;

  const botoesMatriz = document.querySelectorAll('.btn-matriz-dimensao');
  atualizarBotoesSegmentados(botoesMatriz, rankingState.dimensaoMatriz, 'dimensao');
}

/**
 * Configura ouvintes de eventos da aba Ranking Geral.
 */
function setupRankingListeners() {
  const botoesPeriodo = document.querySelectorAll('.btn-ranking-period');
  configurarControleSegmentado(
    botoesPeriodo,
    (novoPeriodo) => {
      rankingState.periodo = novoPeriodo;
      rankingState.limiteVendasGerais = ITENS_POR_PAGINA_GERAL;
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
      rankingState.limiteVendasGerais = ITENS_POR_PAGINA_GERAL;
      atualizarURLFiltrosRanking();
      renderRankingGeral();
    });
  }

  const selectAno = document.getElementById('filtroRankingAno');
  if (selectAno) {
    selectAno.addEventListener('change', (e) => {
      rankingState.ano = e.target.value;
      rankingState.limiteVendasGerais = ITENS_POR_PAGINA_GERAL;
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
      rankingState.limiteVendasGerais = ITENS_POR_PAGINA_GERAL;

      popularSelectAnoFiltro();
      popularSelectConsultorVendasGerais();
      sincronizarControlesComEstado();
      atualizarURLFiltrosRanking();
      renderRankingGeral();
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
      rankingState.limiteVendasGerais = ITENS_POR_PAGINA_GERAL;
      renderVendasGerais();
    });
  }

  // Botão "Mostrar mais" (20 por vez — Item E5)
  const btnMostrarMais = document.getElementById('btnMostrarMaisVendasGerais');
  if (btnMostrarMais) {
    btnMostrarMais.addEventListener('click', () => {
      rankingState.limiteVendasGerais += ITENS_POR_PAGINA_GERAL;
      renderVendasGerais();
    });
  }
}

/**
 * Atualiza os atributos aria-sort e ícones de ordenação dos cabeçalhos do Ranking (Item E3).
 */
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

/**
 * Obtém as vendas do recorte atual da aba Ranking Geral usando a função pura filtrarVendas (Item E6).
 * @returns {Array<Object>}
 */
function obterVendasFiltradasRanking() {
  const todasVendas = getVendas();
  return filtrarVendas(todasVendas, {
    periodo: rankingState.periodo,
    modelo: rankingState.modelo,
    ano: rankingState.ano
  });
}

/**
 * Renderiza toda a aba Ranking Geral (KPIs, Tabela de Ranking, Matriz e Vendas Gerais).
 */
export function renderRankingGeral() {
  popularSelectConsultorVendasGerais();
  const consultores = getConsultores();
  const vendasRecorte = obterVendasFiltradasRanking();

  renderKPIsRanking(vendasRecorte, consultores);
  renderTabelaRankingConsultores(vendasRecorte, consultores);
  renderMatrizConsultores(vendasRecorte, consultores);
  renderVendasGerais(vendasRecorte, consultores);
}

/**
 * Renderiza os 4 KPIs do recorte (Total de vendas, Consultor líder, Modelo mais vendido, Ano mais vendido — Item E2).
 * @param {Array<Object>} vendasRecorte
 * @param {Array<{ id: string, nome: string }>} consultores
 */
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

  // Mapa de ID -> Nome do consultor
  const mapaConsultores = new Map();
  consultores.forEach((c) => {
    if (c && c.id) mapaConsultores.set(c.id, c.nome);
  });

  // Consultor líder (Item E2)
  const liderConsultor = calcularLiderComEmpate(
    vendasRecorte,
    'consultorId',
    mapaConsultores,
    'venda',
    'vendas'
  );
  if (elLider) elLider.textContent = liderConsultor.valorPrincipal;
  if (elLiderDetalhe) elLiderDetalhe.textContent = liderConsultor.detalhe;

  // Modelo mais vendido (Item E2)
  const liderModelo = calcularLiderComEmpate(
    vendasRecorte,
    'modelo',
    null,
    'unidade',
    'unidades'
  );
  if (elModelo) elModelo.textContent = liderModelo.valorPrincipal;
  if (elModeloDetalhe) elModeloDetalhe.textContent = liderModelo.detalhe;

  // Ano mais vendido (Item E2)
  const liderAno = calcularLiderComEmpate(
    vendasRecorte,
    'anoModelo',
    null,
    'unidade',
    'unidades'
  );
  if (elAno) elAno.textContent = liderAno.valorPrincipal;
  if (elAnoDetalhe) elAnoDetalhe.textContent = liderAno.detalhe;
}

/**
 * Cria o elemento de posição com medalha Ouro/Prata/Bronze com texto e aria-label (Item E3).
 * @param {number} posicao
 * @param {number} qtdVendas
 * @returns {HTMLElement}
 */
function criarElementoPosicaoRanking(posicao, qtdVendas) {
  const badge = document.createElement('span');

  // Destaca top 3 com Ouro/Prata/Bronze quando houver vendas (ou conforme a posição de competição)
  if (posicao === 1 && qtdVendas > 0) {
    badge.className = 'medal-badge medal-gold';
    badge.setAttribute('aria-label', '1º lugar - Medalha de Ouro');
    badge.textContent = '🥇 1º · Ouro';
  } else if (posicao === 2 && qtdVendas > 0) {
    badge.className = 'medal-badge medal-silver';
    badge.setAttribute('aria-label', '2º lugar - Medalha de Prata');
    badge.textContent = '🥈 2º · Prata';
  } else if (posicao === 3 && qtdVendas > 0) {
    badge.className = 'medal-badge medal-bronze';
    badge.setAttribute('aria-label', '3º lugar - Medalha de Bronze');
    badge.textContent = '🥉 3º · Bronze';
  } else {
    badge.className = 'medal-badge medal-regular';
    badge.setAttribute('aria-label', `${posicao}º lugar`);
    badge.textContent = `${posicao}º`;
  }

  return badge;
}

/**
 * Renderiza a tabela de Ranking de Consultores (Item E3).
 * @param {Array<Object>} vendasRecorte
 * @param {Array<{ id: string, nome: string }>} consultores
 */
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

  // Aplica a ordenação visual selecionada nos cabeçalhos preservando a posição oficial de competição
  const rankingExibicao = [...rankingBase].sort((a, b) => {
    if (rankingState.sortColuna === 'nome') {
      const cmp = String(a.nome).localeCompare(String(b.nome), 'pt-BR');
      if (cmp !== 0) return rankingState.sortDirecao === 'asc' ? cmp : -cmp;
      return b.vendas - a.vendas;
    }

    // Ordenação por vendas
    const diff =
      rankingState.sortDirecao === 'desc' ? b.vendas - a.vendas : a.vendas - b.vendas;
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

    // 1. Posição
    const tdPosicao = document.createElement('td');
    tdPosicao.setAttribute('data-label', 'Posição');
    tdPosicao.appendChild(criarElementoPosicaoRanking(item.posicao, item.vendas));

    // 2. Consultor (+ etiqueta "Você" se for o usuário logado — Item E3)
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

    // 3. Vendas
    const tdVendas = document.createElement('td');
    tdVendas.className = 'text-right';
    tdVendas.setAttribute('data-label', 'Vendas');
    const spanVendas = document.createElement('span');
    spanVendas.className = `badge-count ${item.posicao === 1 && item.vendas > 0 ? 'top' : ''}`;
    spanVendas.textContent = String(item.vendas);
    tdVendas.appendChild(spanVendas);

    // 4. % do total (com 1 casa decimal — Item E3 / E6)
    const tdPercentual = document.createElement('td');
    tdPercentual.className = 'text-right';
    tdPercentual.setAttribute('data-label', '% do Total');
    const percFormatado = item.percentual.toFixed(1).replace('.', ',');
    tdPercentual.textContent = `${percFormatado}%`;

    // 5. Modelo mais vendido do consultor
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

/**
 * Renderiza a Matriz Consultor x (Modelo | Ano Modelo) com linha e coluna de totais (Item E4).
 * @param {Array<Object>} vendasRecorte
 * @param {Array<{ id: string, nome: string }>} consultores
 */
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

  // Cabeçalho da matriz
  const trHead = document.createElement('tr');
  const thConsultor = document.createElement('th');
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

  // Corpo da matriz
  matriz.linhas.forEach((linha) => {
    const tr = document.createElement('tr');
    const isUsuarioLogado =
      Boolean(usuarioLogado) && usuarioLogado.consultorId === linha.consultorId;
    if (isUsuarioLogado) {
      tr.classList.add('row-current-user');
    }

    const tdNome = document.createElement('td');
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

  // Rodapé de totais por coluna e total geral
  const trFoot = document.createElement('tr');
  trFoot.className = 'matrix-footer-row';

  const tdLabelTotal = document.createElement('td');
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

/**
 * Renderiza a seção "Vendas gerais" do recorte (mais recentes primeiro, filtro extra por consultor,
 * paginação de 20 por vez com "Mostrar mais" e sem botão de excluir — Item E5).
 * @param {Array<Object>} [vendasRecorte]
 * @param {Array<{ id: string, nome: string }>} [consultores]
 */
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

  // Aplica o filtro extra por consultor caso esteja selecionado
  const vendasComFiltroConsultor = rankingState.consultorVendasGerais
    ? vendasRecorte.filter((v) => v.consultorId === rankingState.consultorVendasGerais)
    : vendasRecorte;

  // Ordena pelas mais recentes primeiro (Item E5)
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

    // 1. Data/Hora
    const tdData = document.createElement('td');
    tdData.setAttribute('data-label', 'Data/Hora');
    tdData.textContent = formatarDataHora(venda.dataVenda);

    // 2. Consultor
    const tdConsultor = document.createElement('td');
    tdConsultor.setAttribute('data-label', 'Consultor');
    const strongConsultor = document.createElement('strong');
    strongConsultor.textContent = mapaConsultores.get(venda.consultorId) || 'Consultor';
    tdConsultor.appendChild(strongConsultor);

    // 3. Placa
    const tdPlaca = document.createElement('td');
    tdPlaca.setAttribute('data-label', 'Placa');
    const spanPlaca = document.createElement('span');
    spanPlaca.className = 'plate-tag';
    spanPlaca.textContent = formatarPlaca(venda.placa);
    tdPlaca.appendChild(spanPlaca);

    // 4. Contrato
    const tdContrato = document.createElement('td');
    tdContrato.setAttribute('data-label', 'Contrato');
    const spanContrato = document.createElement('span');
    spanContrato.className = 'contract-tag';
    spanContrato.textContent = venda.numeroContrato;
    tdContrato.appendChild(spanContrato);

    // 5. Modelo
    const tdModelo = document.createElement('td');
    tdModelo.setAttribute('data-label', 'Modelo');
    tdModelo.textContent = venda.modelo;

    // 6. Ano
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

  // Controle de paginação (20 por vez com "Mostrar mais")
  if (boxPaginacao && infoContagem && btnMostrarMais) {
    boxPaginacao.classList.remove('hidden');
    infoContagem.textContent = `Exibindo ${vendasVisiveis.length} de ${vendasOrdenadas.length} venda${vendasOrdenadas.length === 1 ? '' : 's'}`;

    const temMais = vendasOrdenadas.length > vendasVisiveis.length;
    btnMostrarMais.classList.toggle('hidden', !temMais);
  }
}

/**
 * Recarrega filtros da URL e re-renderiza quando ocorre navegação no histórico.
 */
export function sincronizarRankingComURL() {
  lerFiltrosDaURL();
  popularSelectAnoFiltro();
  sincronizarControlesComEstado();
  renderRankingGeral();
}
