/**
 * Módulo de Gráficos e BI (charts.js — Parte 2):
 * Único módulo autorizado a acessar `window.Chart` (Chart.js 4.4.1 via CDN).
 * Gerencia ciclo de vida (destroy antes de recriar), fallback offline, estado vazio,
 * resumo textual em aria-label no <canvas role="img">, tabela acessível em <details>
 * construída com createElement/textContent e exportação PNG.
 */

import { getCorConsistente, definirCoresConsultores } from './catalog.js';
import {
  serieCategorias,
  agruparFatiasPizza,
  serieEmpilhada,
  serieTemporal,
  gerarSeriesLinhaPorDimensao,
  pontosDispersao,
  obterDataHojeISO
} from './utils.js';

const instanciasGraficos = new Map();

export const MENSAGEM_ERRO_CDN =
  'Não foi possível carregar os gráficos. Verifique sua conexão.';
export const MENSAGEM_ESTADO_VAZIO = 'Sem vendas para os filtros selecionados';

function isChartDisponivel() {
  return typeof window !== 'undefined' && typeof window.Chart === 'function';
}

function obterDuracaoAnimacao() {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 0;
  }
  return 350;
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.innerWidth <= 600;
}

function lerCoresTemaCSS() {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') {
    return {
      bgCard: '#ffffff',
      textMain: '#0f172a',
      textSecondary: '#475569',
      borderColor: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif'
    };
  }
  const styles = getComputedStyle(document.documentElement);
  return {
    bgCard: styles.getPropertyValue('--bg-card').trim() || '#ffffff',
    textMain: styles.getPropertyValue('--text-main').trim() || '#0f172a',
    textSecondary: styles.getPropertyValue('--text-secondary').trim() || '#475569',
    borderColor: styles.getPropertyValue('--border-color').trim() || '#e2e8f0',
    fontFamily: styles.getPropertyValue('--font-family').trim() || 'system-ui, sans-serif'
  };
}

const pluginFundoCanvas = {
  id: 'fundoCanvas',
  beforeDraw(chart) {
    const { ctx, width, height } = chart;
    if (!ctx) return;
    const { bgCard } = lerCoresTemaCSS();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = bgCard || '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
};

/**
 * Destrói a instância anterior de um gráfico pelo seu identificador (Item 2.1).
 * @param {string} idInstancia
 */
export function destruirGrafico(idInstancia) {
  const instancia = instanciasGraficos.get(idInstancia);
  if (instancia && typeof instancia.destroy === 'function') {
    instancia.destroy();
  }
  instanciasGraficos.delete(idInstancia);
}

function formatarPerc(qtd, total) {
  if (!total || total <= 0) return '0,0%';
  const p = ((Number(qtd) || 0) / total) * 100;
  return `${p.toFixed(1).replace('.', ',')}%`;
}

function formatarHoraDecimal(horaDec) {
  const val = Number(horaDec) || 0;
  const h = Math.floor(val);
  const m = Math.round((val - h) * 60);
  const hAjustada = m === 60 ? h + 1 : h;
  const mAjustado = m === 60 ? 0 : m;
  return `${String(hAjustada).padStart(2, '0')}:${String(mAjustado).padStart(2, '0')}`;
}

/**
 * Popula a tabela de dados acessível dentro de <details> usando apenas createElement e textContent (Item 2.5).
 * @param {HTMLElement|null} theadEl
 * @param {HTMLElement|null} tbodyEl
 * @param {string[]} cabecalhos
 * @param {Array<Array<string|number>>} linhas
 */
function popularTabelaDadosAcessivel(theadEl, tbodyEl, cabecalhos, linhas) {
  if (!theadEl || !tbodyEl) return;
  theadEl.replaceChildren();
  tbodyEl.replaceChildren();

  const trHead = document.createElement('tr');
  cabecalhos.forEach((col, idx) => {
    const th = document.createElement('th');
    if (idx > 0) th.className = 'text-right';
    th.textContent = String(col);
    trHead.appendChild(th);
  });
  theadEl.appendChild(trHead);

  linhas.forEach((celulas) => {
    const tr = document.createElement('tr');
    celulas.forEach((valor, idx) => {
      const td = document.createElement('td');
      if (idx > 0) td.className = 'text-right';
      if (idx === 0) {
        const strong = document.createElement('strong');
        strong.textContent = String(valor ?? '');
        td.appendChild(strong);
      } else {
        td.textContent = String(valor ?? '');
      }
      tr.appendChild(td);
    });
    tbodyEl.appendChild(tr);
  });
}

function gerarResumoAriaCategorias(nomeTipo, labels, valores) {
  const total = valores.reduce((acc, v) => acc + (Number(v) || 0), 0);
  if (total === 0 || labels.length === 0) {
    return `${nomeTipo}: sem vendas no período.`;
  }
  const partes = labels.map(
    (label, idx) => `${label} ${formatarPerc(valores[idx], total)} (${valores[idx]})`
  );
  return `${nomeTipo}: ${partes.join(', ')}. Total: ${total} vendas.`;
}

function alternarVisibilidadeElementos(els, modo) {
  const {
    containerCanvas,
    boxVazio,
    boxErroCDN,
    detailsTabela,
    btnDownload
  } = els;

  if (modo === 'vazio') {
    if (containerCanvas) containerCanvas.classList.add('hidden');
    if (boxErroCDN) boxErroCDN.classList.add('hidden');
    if (detailsTabela) detailsTabela.classList.add('hidden');
    if (boxVazio) {
      boxVazio.textContent = MENSAGEM_ESTADO_VAZIO;
      boxVazio.classList.remove('hidden');
    }
    if (btnDownload) btnDownload.disabled = true;
    return;
  }

  if (modo === 'erro-cdn') {
    if (containerCanvas) containerCanvas.classList.add('hidden');
    if (boxVazio) boxVazio.classList.add('hidden');
    if (boxErroCDN) {
      boxErroCDN.textContent = MENSAGEM_ERRO_CDN;
      boxErroCDN.classList.remove('hidden');
    }
    if (detailsTabela) detailsTabela.classList.remove('hidden');
    if (btnDownload) btnDownload.disabled = true;
    return;
  }

  if (boxVazio) boxVazio.classList.add('hidden');
  if (boxErroCDN) boxErroCDN.classList.add('hidden');
  if (containerCanvas) containerCanvas.classList.remove('hidden');
  if (detailsTabela) detailsTabela.classList.remove('hidden');
  if (btnDownload) btnDownload.disabled = false;
}

/**
 * Exporta o gráfico especificado como imagem PNG via chart.toBase64Image() (Itens 2.3 e 2.4).
 * Nome do arquivo: motoranking-<tipo>-<data>.png
 * @param {string} idInstancia
 * @param {string} tipoGrafico
 * @returns {boolean}
 */
export function exportarGraficoPNG(idInstancia, tipoGrafico = 'colunas') {
  const chart = instanciasGraficos.get(idInstancia);
  if (!chart || typeof chart.toBase64Image !== 'function') {
    return false;
  }

  const base64Url = chart.toBase64Image('image/png', 1);
  if (!base64Url) return false;

  const tipoLimpo = String(tipoGrafico || 'grafico')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');
  const dataStr = obterDataHojeISO(new Date());
  const nomeArquivo = `motoranking-${tipoLimpo}-${dataStr}.png`;

  const link = document.createElement('a');
  link.href = base64Url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}

/**
 * Renderiza o gráfico da seção "BI · Análise visual" na aba Ranking Geral (Itens 2.1, 2.3, 2.5).
 * @param {Object} params
 */
export function renderGraficoRankingBI(params) {
  const {
    vendas = [],
    consultores = [],
    tipo = 'colunas',
    dimensao = 'modelo',
    periodo = 'mes',
    elementos = {}
  } = params || {};

  const idInstancia = 'ranking-bi';
  destruirGrafico(idInstancia);
  definirCoresConsultores(consultores);

  const listaVendas = Array.isArray(vendas) ? vendas.filter(Boolean) : [];
  if (listaVendas.length === 0) {
    alternarVisibilidadeElementos(elementos, 'vazio');
    return;
  }

  const totalGeral = listaVendas.length;
  const { canvas, theadTabela, tbodyTabela } = elementos;
  const coresTema = lerCoresTemaCSS();
  const duracaoAnimacao = obterDuracaoAnimacao();
  const mobile = isMobileViewport();

  let configChart = null;
  let ariaLabelResumo = '';
  let cabecalhosTabela = [];
  let linhasTabela = [];

  const labelDimensao =
    dimensao === 'consultor'
      ? 'Consultor'
      : dimensao === 'anoModelo'
      ? 'Ano Modelo'
      : 'Modelo';

  if (tipo === 'colunas' || tipo === 'pizza') {
    const base = serieCategorias(listaVendas, dimensao, consultores);
    const ehCircular = tipo === 'pizza';
    const serieFinal = ehCircular
      ? agruparFatiasPizza(base.labels, base.valores, 6)
      : base;

    const coresFatias = serieFinal.labels.map((lbl) => getCorConsistente(dimensao, lbl));

    cabecalhosTabela = [labelDimensao, 'Vendas', '% do Total'];
    linhasTabela = serieFinal.labels.map((lbl, idx) => [
      lbl,
      serieFinal.valores[idx],
      formatarPerc(serieFinal.valores[idx], totalGeral)
    ]);

    const nomesTipo = {
      colunas: 'Gráfico de colunas',
      pizza: 'Gráfico de pizza'
    };
    ariaLabelResumo = gerarResumoAriaCategorias(
      nomesTipo[tipo] || 'Gráfico',
      serieFinal.labels,
      serieFinal.valores
    );

    configChart = {
      type: ehCircular ? 'pie' : 'bar',
      data: {
        labels: serieFinal.labels,
        datasets: [
          {
            label: 'Vendas',
            data: serieFinal.valores,
            backgroundColor: coresFatias,
            borderColor: ehCircular ? '#ffffff' : coresFatias,
            borderWidth: ehCircular ? 2 : 1,
            borderRadius: ehCircular ? 0 : 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: duracaoAnimacao },
        plugins: {
          legend: {
            display: ehCircular,
            position: mobile ? 'bottom' : 'right',
            labels: {
              color: coresTema.textMain,
              font: { family: coresTema.fontFamily, size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const valor = Number(ctx.raw) || 0;
                return ` ${ctx.label}: ${valor} venda${valor === 1 ? '' : 's'} (${formatarPerc(valor, totalGeral)})`;
              }
            }
          }
        },
        scales: ehCircular
          ? {}
          : {
              x: {
                beginAtZero: true,
                ticks: {
                  color: coresTema.textSecondary,
                  precision: 0
                },
                grid: { color: coresTema.borderColor }
              },
              y: {
                beginAtZero: true,
                ticks: {
                  color: coresTema.textSecondary,
                  precision: 0
                },
                grid: { color: coresTema.borderColor }
              }
            }
      }
    };
  } else if (tipo === 'empilhadas') {
    const dimPilha = dimensao === 'anoModelo' ? 'anoModelo' : 'modelo';
    const empilhada = serieEmpilhada(listaVendas, consultores, dimPilha);

    cabecalhosTabela = ['Consultor', ...empilhada.datasets.map((d) => d.label), 'Total'];
    linhasTabela = empilhada.labels.map((nomeConsultor, idxLinha) => {
      let somaLinha = 0;
      const vals = empilhada.datasets.map((ds) => {
        const v = Number(ds.valores[idxLinha]) || 0;
        somaLinha += v;
        return v;
      });
      return [nomeConsultor, ...vals, `${somaLinha} (${formatarPerc(somaLinha, totalGeral)})`];
    });

    const resumoConsultores = empilhada.labels.map((nome, idx) => {
      const soma = empilhada.datasets.reduce((acc, ds) => acc + (Number(ds.valores[idx]) || 0), 0);
      return `${nome} ${soma}`;
    });
    ariaLabelResumo = `Gráfico de colunas empilhadas por ${dimPilha === 'anoModelo' ? 'ano modelo' : 'modelo'}: ${resumoConsultores.join(', ')}.`;

    configChart = {
      type: 'bar',
      data: {
        labels: empilhada.labels,
        datasets: empilhada.datasets.map((ds) => {
          const cor = getCorConsistente(dimPilha, ds.label);
          return {
            label: ds.label,
            data: ds.valores,
            backgroundColor: cor,
            borderColor: '#ffffff',
            borderWidth: 1
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: duracaoAnimacao },
        plugins: {
          legend: {
            display: true,
            position: mobile ? 'bottom' : 'top',
            labels: {
              color: coresTema.textMain,
              font: { family: coresTema.fontFamily, size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const valor = Number(ctx.raw) || 0;
                return ` ${ctx.dataset.label}: ${valor} (${formatarPerc(valor, totalGeral)} do total)`;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: coresTema.textSecondary },
            grid: { color: coresTema.borderColor }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { color: coresTema.textSecondary, precision: 0 },
            grid: { color: coresTema.borderColor }
          }
        }
      }
    };
  } else if (tipo === 'linha') {
    const seriesLinha = gerarSeriesLinhaPorDimensao(
      listaVendas,
      dimensao,
      periodo,
      consultores
    );

    cabecalhosTabela = ['Período', ...seriesLinha.datasets.map((d) => d.label)];
    linhasTabela = seriesLinha.labels.map((rotuloTempo, idxTempo) => [
      rotuloTempo,
      ...seriesLinha.datasets.map((ds) => Number(ds.valores[idxTempo]) || 0)
    ]);

    ariaLabelResumo = `Gráfico de linha de evolução (${periodo}): total de ${totalGeral} vendas distribuídas em ${seriesLinha.labels.length} intervalos.`;

    configChart = {
      type: 'line',
      data: {
        labels: seriesLinha.labels,
        datasets: seriesLinha.datasets.map((ds) => {
          const cor = ds.isTotal
            ? '#0f172a'
            : getCorConsistente(dimensao, ds.label);
          return {
            label: ds.label,
            data: ds.valores,
            borderColor: cor,
            backgroundColor: cor,
            borderWidth: ds.isTotal ? 3 : 2,
            borderDash: ds.isTotal ? [] : [4, 2],
            tension: 0.25,
            pointRadius: ds.isTotal ? 4 : 3
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: duracaoAnimacao },
        plugins: {
          legend: {
            display: true,
            position: mobile ? 'bottom' : 'top',
            labels: {
              color: coresTema.textMain,
              font: { family: coresTema.fontFamily, size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const valor = Number(ctx.raw) || 0;
                return ` ${ctx.dataset.label}: ${valor} venda${valor === 1 ? '' : 's'} (${formatarPerc(valor, totalGeral)})`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: coresTema.textSecondary },
            grid: { color: coresTema.borderColor }
          },
          y: {
            beginAtZero: true,
            ticks: { color: coresTema.textSecondary, precision: 0 },
            grid: { color: coresTema.borderColor }
          }
        }
      }
    };
  } else if (tipo === 'dispersao') {
    const pontos = pontosDispersao(listaVendas, consultores, periodo);

    const grupos = new Map();
    pontos.forEach((pt) => {
      const chaveCor =
        dimensao === 'consultor'
          ? pt.consultor
          : dimensao === 'anoModelo'
          ? String(pt.anoModelo)
          : pt.modelo;
      if (!grupos.has(chaveCor)) {
        grupos.set(chaveCor, []);
      }
      grupos.get(chaveCor).push(pt);
    });

    cabecalhosTabela = ['Data/Hora', 'Consultor', 'Modelo', 'Ano', 'Placa'];
    linhasTabela = pontos.map((pt) => [
      pt.dataHora,
      pt.consultor,
      pt.modelo,
      pt.anoModelo,
      pt.placa
    ]);

    ariaLabelResumo = `Gráfico de dispersão de horários das vendas: ${pontos.length} vendas plotadas por dia e horário.`;

    const nomesDiasSemana = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    // No filtro "Dia" todas as vendas caem no mesmo dia; em vez de empilhar tudo numa coluna,
    // vira uma linha do tempo: x = horário, y = uma faixa por item da dimensão.
    const ehLinhaDoTempoDia = periodo === 'dia';
    const chavesGrupos = Array.from(grupos.keys()).map(String);
    const hojeRef = new Date();
    const ultimoDiaMes = new Date(hojeRef.getFullYear(), hojeRef.getMonth() + 1, 0).getDate();
    const formatarHoraTick = (value) => `${String(value).padStart(2, '0')}h`;

    const escalasDispersao = ehLinhaDoTempoDia
      ? {
          x: {
            type: 'linear',
            position: 'bottom',
            min: 0,
            max: 24,
            title: { display: true, text: 'Horário da Venda (00h–24h)', color: coresTema.textSecondary },
            ticks: { color: coresTema.textSecondary, stepSize: 2, callback: formatarHoraTick },
            grid: { color: coresTema.borderColor }
          },
          y: {
            type: 'category',
            labels: chavesGrupos,
            offset: true,
            title: { display: true, text: labelDimensao, color: coresTema.textSecondary },
            ticks: { color: coresTema.textSecondary },
            grid: { color: coresTema.borderColor }
          }
        }
      : null;

    configChart = {
      type: 'scatter',
      data: {
        datasets: Array.from(grupos.entries()).map(([chaveGrupo, listaPts]) => {
          const cor = getCorConsistente(dimensao, chaveGrupo);
          const dadosPontos = ehLinhaDoTempoDia
            ? listaPts.map((pt) => ({ ...pt, x: pt.y, y: String(chaveGrupo) }))
            : listaPts;
          return {
            label: String(chaveGrupo),
            data: dadosPontos,
            backgroundColor: cor,
            borderColor: '#ffffff',
            borderWidth: 1,
            pointRadius: 6,
            pointHoverRadius: 8
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: duracaoAnimacao },
        plugins: {
          legend: {
            display: true,
            position: mobile ? 'bottom' : 'top',
            labels: {
              color: coresTema.textMain,
              font: { family: coresTema.fontFamily, size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const pt = ctx.raw || {};
                const percUnidade = formatarPerc(1, totalGeral);
                return [
                  ` Data/Hora: ${pt.dataHora || '-'}`,
                  ` Consultor: ${pt.consultor || '-'}`,
                  ` Modelo: ${pt.modelo || '-'} (${pt.anoModelo || '-'})`,
                  ` Placa: ${pt.placa || '-'} (1 venda · ${percUnidade})`
                ];
              }
            }
          }
        },
        scales: escalasDispersao || {
          x: {
            type: 'linear',
            position: 'bottom',
            min: 1,
            max: periodo === 'semana' ? 7 : ultimoDiaMes,
            title: {
              display: true,
              text: periodo === 'semana' ? 'Dia da Semana (Seg–Dom)' : 'Dia do Mês',
              color: coresTema.textSecondary
            },
            ticks: {
              color: coresTema.textSecondary,
              stepSize: 1,
              callback(value) {
                if (periodo === 'semana') {
                  return nomesDiasSemana[value] || value;
                }
                return value;
              }
            },
            grid: { color: coresTema.borderColor }
          },
          y: {
            min: 0,
            max: 24,
            title: {
              display: true,
              text: 'Horário da Venda (00h–24h)',
              color: coresTema.textSecondary
            },
            ticks: {
              color: coresTema.textSecondary,
              stepSize: 2,
              callback(value) {
                return `${String(value).padStart(2, '0')}h`;
              }
            },
            grid: { color: coresTema.borderColor }
          }
        }
      }
    };
  }

  popularTabelaDadosAcessivel(theadTabela, tbodyTabela, cabecalhosTabela, linhasTabela);

  if (canvas) {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', ariaLabelResumo);
  }

  if (!isChartDisponivel()) {
    alternarVisibilidadeElementos(elementos, 'erro-cdn');
    return;
  }

  alternarVisibilidadeElementos(elementos, 'grafico');

  if (canvas && configChart) {
    configChart.plugins = [pluginFundoCanvas, ...(configChart.plugins || [])];
    const ctx = canvas.getContext('2d');
    const novaInstancia = new window.Chart(ctx, configChart);
    instanciasGraficos.set(idInstancia, novaInstancia);
  }
}

/**
 * Renderiza o gráfico individual no "Painel do consultor" (Itens 2.1, 2.4, 2.5).
 * @param {Object} params
 */
export function renderGraficoConsultorPainel(params) {
  const {
    vendas = [],
    tipo = 'colunas',
    dimensao = 'modelo',
    periodo = 'mes',
    nomeConsultor = 'Consultor',
    elementos = {}
  } = params || {};

  const idInstancia = 'painel-consultor';
  destruirGrafico(idInstancia);

  const listaVendas = Array.isArray(vendas) ? vendas.filter(Boolean) : [];
  if (listaVendas.length === 0) {
    alternarVisibilidadeElementos(elementos, 'vazio');
    return;
  }

  const totalConsultor = listaVendas.length;
  const { canvas, theadTabela, tbodyTabela } = elementos;
  const coresTema = lerCoresTemaCSS();
  const duracaoAnimacao = obterDuracaoAnimacao();
  const mobile = isMobileViewport();

  let configChart = null;
  let ariaLabelResumo = '';
  let cabecalhosTabela = [];
  let linhasTabela = [];

  const dimValida = dimensao === 'anoModelo' ? 'anoModelo' : 'modelo';
  const labelDim = dimValida === 'anoModelo' ? 'Ano Modelo' : 'Modelo';

  if (tipo === 'linha') {
    const temporal = serieTemporal(listaVendas, periodo);
    cabecalhosTabela = ['Período', 'Vendas', '% do Total'];
    linhasTabela = temporal.labels.map((rotulo, idx) => {
      const qtd = temporal.valores[idx] || 0;
      return [rotulo, qtd, formatarPerc(qtd, totalConsultor)];
    });

    ariaLabelResumo = `Gráfico de linha de evolução de ${nomeConsultor}: ${totalConsultor} vendas no período.`;

    configChart = {
      type: 'line',
      data: {
        labels: temporal.labels,
        datasets: [
          {
            label: `Vendas de ${nomeConsultor}`,
            data: temporal.valores,
            borderColor: '#d90429',
            backgroundColor: 'rgba(217, 4, 41, 0.15)',
            fill: true,
            borderWidth: 3,
            tension: 0.25,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: duracaoAnimacao },
        plugins: {
          legend: {
            display: true,
            position: mobile ? 'bottom' : 'top',
            labels: {
              color: coresTema.textMain,
              font: { family: coresTema.fontFamily, size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const valor = Number(ctx.raw) || 0;
                return ` ${valor} venda${valor === 1 ? '' : 's'} (${formatarPerc(valor, totalConsultor)})`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: coresTema.textSecondary },
            grid: { color: coresTema.borderColor }
          },
          y: {
            beginAtZero: true,
            ticks: { color: coresTema.textSecondary, precision: 0 },
            grid: { color: coresTema.borderColor }
          }
        }
      }
    };
  } else {
    const base = serieCategorias(listaVendas, dimValida);
    const ehCircular = tipo === 'pizza';
    const serieFinal = ehCircular
      ? agruparFatiasPizza(base.labels, base.valores, 6)
      : base;

    const cores = serieFinal.labels.map((lbl) => getCorConsistente(dimValida, lbl));

    cabecalhosTabela = [labelDim, 'Vendas', '% do Total'];
    linhasTabela = serieFinal.labels.map((lbl, idx) => [
      lbl,
      serieFinal.valores[idx],
      formatarPerc(serieFinal.valores[idx], totalConsultor)
    ]);

    const nomesTipo = {
      colunas: 'Gráfico de colunas',
      pizza: 'Gráfico de pizza'
    };
    ariaLabelResumo = gerarResumoAriaCategorias(
      `${nomesTipo[tipo] || 'Gráfico'} (${nomeConsultor})`,
      serieFinal.labels,
      serieFinal.valores
    );

    configChart = {
      type: ehCircular ? 'pie' : 'bar',
      data: {
        labels: serieFinal.labels,
        datasets: [
          {
            label: 'Vendas',
            data: serieFinal.valores,
            backgroundColor: cores,
            borderColor: ehCircular ? '#ffffff' : cores,
            borderWidth: ehCircular ? 2 : 1,
            borderRadius: ehCircular ? 0 : 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: duracaoAnimacao },
        plugins: {
          legend: {
            display: ehCircular,
            position: mobile ? 'bottom' : 'right',
            labels: {
              color: coresTema.textMain,
              font: { family: coresTema.fontFamily, size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const valor = Number(ctx.raw) || 0;
                return ` ${ctx.label}: ${valor} venda${valor === 1 ? '' : 's'} (${formatarPerc(valor, totalConsultor)})`;
              }
            }
          }
        },
        scales: ehCircular
          ? {}
          : {
              x: {
                ticks: { color: coresTema.textSecondary },
                grid: { color: coresTema.borderColor }
              },
              y: {
                beginAtZero: true,
                ticks: { color: coresTema.textSecondary, precision: 0 },
                grid: { color: coresTema.borderColor }
              }
            }
      }
    };
  }

  popularTabelaDadosAcessivel(theadTabela, tbodyTabela, cabecalhosTabela, linhasTabela);

  if (canvas) {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', ariaLabelResumo);
  }

  if (!isChartDisponivel()) {
    alternarVisibilidadeElementos(elementos, 'erro-cdn');
    return;
  }

  alternarVisibilidadeElementos(elementos, 'grafico');

  if (canvas && configChart) {
    configChart.plugins = [pluginFundoCanvas, ...(configChart.plugins || [])];
    const ctx = canvas.getContext('2d');
    const novaInstancia = new window.Chart(ctx, configChart);
    instanciasGraficos.set(idInstancia, novaInstancia);
  }
}
