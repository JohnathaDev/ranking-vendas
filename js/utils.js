/**
 * Utilitários puros (sem acesso ao DOM e sem Chart) para validação de dados,
 * formatação de datas/placas, filtros combinados, ranking de competição, matriz analítica
 * e geração de séries de dados para o módulo de BI (Item 2.2).
 */

import { getModelos, getTodosAnos } from './catalog.js';

export const DATA_MINIMA_VENDA = '2023-01-01';

export function normalizarPlaca(placaRaw) {
  if (!placaRaw || typeof placaRaw !== 'string') return '';
  return placaRaw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function validarPlaca(placaRaw) {
  if (!placaRaw || typeof placaRaw !== 'string') return false;
  const textoLimpo = placaRaw.trim();
  const regexEstrita = /^[A-Z]{3}-?(\d{4}|\d[A-Z]\d{2})$/i;
  if (!regexEstrita.test(textoLimpo)) {
    return false;
  }
  const normalizada = normalizarPlaca(textoLimpo);
  return normalizada.length === 7;
}

export function formatarPlaca(placaSemHifen) {
  const placa = normalizarPlaca(placaSemHifen);
  if (placa.length === 7 && validarPlaca(placa)) {
    return `${placa.slice(0, 3)}-${placa.slice(3)}`;
  }
  return placaSemHifen || '';
}

export function normalizarContrato(contrato) {
  if (!contrato || typeof contrato !== 'string') return '';
  return contrato.trim().toUpperCase();
}

export function validarContrato(contrato) {
  if (!contrato || typeof contrato !== 'string') return false;
  const regexContrato = /^[A-Za-z0-9]+$/;
  return regexContrato.test(contrato.trim());
}

export function normalizarNomeConsultor(nome) {
  if (!nome || typeof nome !== 'string') return '';
  return nome
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function validarNomeConsultor(nome) {
  if (!nome || typeof nome !== 'string') return false;
  const limpo = nome.trim();
  return limpo.length >= 3 && limpo.length <= 60;
}

export function obterDataHojeISO(data = new Date()) {
  const d = new Date(data);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function validarDataInput(dataYMD, dataReferencia = new Date()) {
  if (!dataYMD || typeof dataYMD !== 'string') return false;
  const limpo = dataYMD.trim();
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(limpo)) return false;

  const [ano, mes, dia] = limpo.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return false;
  }

  const hojeStr = obterDataHojeISO(dataReferencia);
  return limpo >= DATA_MINIMA_VENDA && limpo <= hojeStr;
}

export function combinarDataComHoraAtual(dataYMD, horaRef = new Date()) {
  if (!dataYMD || typeof dataYMD !== 'string') return null;
  const limpo = dataYMD.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpo)) return null;

  const [ano, mes, dia] = limpo.split('-').map(Number);
  const dataCheck = new Date(ano, mes - 1, dia);
  if (
    dataCheck.getFullYear() !== ano ||
    dataCheck.getMonth() !== mes - 1 ||
    dataCheck.getDate() !== dia
  ) {
    return null;
  }

  const agora = new Date(horaRef);
  if (isNaN(agora.getTime())) return null;

  const dataResultante = new Date(
    ano,
    mes - 1,
    dia,
    agora.getHours(),
    agora.getMinutes(),
    agora.getSeconds(),
    agora.getMilliseconds()
  );

  if (dataResultante > agora) {
    return agora.toISOString();
  }

  return dataResultante.toISOString();
}

export function validarDataVenda(dataIso, dataReferencia = new Date()) {
  if (!dataIso || typeof dataIso !== 'string') return false;
  const data = new Date(dataIso);
  if (isNaN(data.getTime())) return false;

  const dataYMD = obterDataHojeISO(data);
  if (!validarDataInput(dataYMD, dataReferencia)) {
    return false;
  }

  const agora = new Date(dataReferencia);
  return data.getTime() <= agora.getTime() + 1000;
}

export function formatarDataHora(dataIso) {
  if (!dataIso) return '-';
  const data = new Date(dataIso);
  if (isNaN(data.getTime())) return '-';

  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  const horas = String(data.getHours()).padStart(2, '0');
  const minutos = String(data.getMinutes()).padStart(2, '0');

  return `${dia}/${mes}/${ano} às ${horas}:${minutos}`;
}

export function filtrarPorPeriodo(vendas, periodo, dataReferencia = new Date()) {
  if (!Array.isArray(vendas)) return [];

  const ref = new Date(dataReferencia);
  const anoRef = ref.getFullYear();
  const mesRef = ref.getMonth();
  const diaRef = ref.getDate();

  const inicioDia = new Date(anoRef, mesRef, diaRef, 0, 0, 0, 0);
  const fimDia = new Date(anoRef, mesRef, diaRef, 23, 59, 59, 999);

  const inicioMes = new Date(anoRef, mesRef, 1, 0, 0, 0, 0);
  const ultimoDiaMes = new Date(anoRef, mesRef + 1, 0).getDate();
  const fimMes = new Date(anoRef, mesRef, ultimoDiaMes, 23, 59, 59, 999);

  const diaSemana = ref.getDay();
  const diferencaParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  const inicioSemana = new Date(anoRef, mesRef, diaRef + diferencaParaSegunda, 0, 0, 0, 0);
  const fimSemana = new Date(
    inicioSemana.getFullYear(),
    inicioSemana.getMonth(),
    inicioSemana.getDate() + 6,
    23,
    59,
    59,
    999
  );

  return vendas.filter((venda) => {
    if (!venda || !venda.dataVenda) return false;
    const dataVenda = new Date(venda.dataVenda);
    if (isNaN(dataVenda.getTime())) return false;

    if (periodo === 'dia') {
      return dataVenda >= inicioDia && dataVenda <= fimDia;
    }
    if (periodo === 'semana') {
      return dataVenda >= inicioSemana && dataVenda <= fimSemana;
    }
    if (periodo === 'mes') {
      return dataVenda >= inicioMes && dataVenda <= fimMes;
    }
    return true;
  });
}

export function filtrarVendas(vendas, filtros = {}, dataReferencia = new Date()) {
  if (!Array.isArray(vendas)) return [];

  const { periodo, modelo, ano, consultorId } = filtros || {};

  let resultado = vendas.filter((v) => v && typeof v === 'object');

  if (periodo && ['dia', 'semana', 'mes'].includes(periodo)) {
    resultado = filtrarPorPeriodo(resultado, periodo, dataReferencia);
  }

  if (modelo && modelo !== 'todos') {
    resultado = resultado.filter((v) => v.modelo === modelo);
  }

  if (ano !== undefined && ano !== null && ano !== '' && String(ano) !== 'todos') {
    const anoNum = Number(ano);
    if (!isNaN(anoNum)) {
      resultado = resultado.filter((v) => Number(v.anoModelo) === anoNum);
    }
  }

  if (consultorId && consultorId !== 'todos') {
    resultado = resultado.filter((v) => v.consultorId === consultorId);
  }

  return resultado;
}

export function agruparPor(vendas, campo) {
  if (!Array.isArray(vendas) || !campo) return [];

  const contagem = {};

  vendas.forEach((venda) => {
    if (!venda) return;
    const valor = venda[campo];
    if (valor !== undefined && valor !== null) {
      contagem[valor] = (contagem[valor] || 0) + 1;
    }
  });

  return Object.entries(contagem).map(([chave, quantidade]) => ({
    chave: campo === 'anoModelo' && !isNaN(Number(chave)) ? Number(chave) : chave,
    quantidade
  }));
}

export function calcularLiderComEmpate(
  vendas,
  campo,
  mapaLabels = null,
  unidadeSingular = 'unidade',
  unidadePlural = 'unidades'
) {
  const agrupado = agruparPor(vendas, campo);
  if (agrupado.length === 0) {
    return {
      valorPrincipal: '-',
      detalhe: `0 ${unidadePlural}`,
      quantidadeMax: 0,
      empatados: []
    };
  }

  const maxQtd = Math.max(...agrupado.map((i) => i.quantidade));
  if (maxQtd <= 0) {
    return {
      valorPrincipal: '-',
      detalhe: `0 ${unidadePlural}`,
      quantidadeMax: 0,
      empatados: []
    };
  }

  const lideres = agrupado
    .filter((i) => i.quantidade === maxQtd)
    .map((i) => {
      if (mapaLabels) {
        if (mapaLabels instanceof Map) {
          return mapaLabels.get(String(i.chave)) || String(i.chave);
        }
        return mapaLabels[i.chave] || String(i.chave);
      }
      return String(i.chave);
    })
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const labelUnidade = maxQtd === 1 ? unidadeSingular : unidadePlural;

  if (lideres.length > 1) {
    return {
      valorPrincipal: `${lideres.join(' / ')} · empate`,
      detalhe: `empate · ${maxQtd} ${labelUnidade} cada`,
      quantidadeMax: maxQtd,
      empatados: lideres
    };
  }

  return {
    valorPrincipal: lideres[0],
    detalhe: `${maxQtd} ${labelUnidade}`,
    quantidadeMax: maxQtd,
    empatados: lideres
  };
}

export function gerarRanking(vendas, consultores) {
  if (!Array.isArray(consultores) || consultores.length === 0) return [];
  const listaVendas = Array.isArray(vendas) ? vendas.filter(Boolean) : [];
  const totalGeral = listaVendas.length;

  const itens = consultores
    .filter((c) => c && c.id)
    .map((consultor) => {
      const vendasConsultor = listaVendas.filter((v) => v.consultorId === consultor.id);
      const qtd = vendasConsultor.length;
      const percentual = totalGeral > 0 ? Number(((qtd / totalGeral) * 100).toFixed(1)) : 0;

      let modeloTop = '-';
      if (qtd > 0) {
        const liderModelo = calcularLiderComEmpate(vendasConsultor, 'modelo');
        modeloTop = liderModelo.valorPrincipal;
      }

      return {
        posicao: 0,
        consultorId: consultor.id,
        nome: consultor.nome,
        vendas: qtd,
        percentual,
        modeloTop
      };
    });

  itens.sort((a, b) => {
    const diff = b.vendas - a.vendas;
    if (diff !== 0) return diff;
    return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
  });

  itens.forEach((item, index) => {
    if (index === 0) {
      item.posicao = 1;
    } else if (item.vendas === itens[index - 1].vendas) {
      item.posicao = itens[index - 1].posicao;
    } else {
      item.posicao = index + 1;
    }
  });

  return itens;
}

export function gerarMatriz(vendas, consultores, dimensao = 'modelo') {
  const listaVendas = Array.isArray(vendas) ? vendas.filter(Boolean) : [];
  const listaConsultores = Array.isArray(consultores) ? consultores.filter((c) => c && c.id) : [];
  const campo = dimensao === 'anoModelo' ? 'anoModelo' : 'modelo';

  let colunas = [];
  if (campo === 'anoModelo') {
    const anosSet = new Set(getTodosAnos());
    listaVendas.forEach((v) => {
      if (v.anoModelo !== undefined && v.anoModelo !== null && !isNaN(Number(v.anoModelo))) {
        anosSet.add(Number(v.anoModelo));
      }
    });
    colunas = Array.from(anosSet).sort((a, b) => a - b);
  } else {
    const modelosSet = new Set(getModelos());
    listaVendas.forEach((v) => {
      if (v.modelo) modelosSet.add(v.modelo);
    });
    colunas = Array.from(modelosSet);
  }

  const totaisColuna = {};
  colunas.forEach((col) => {
    totaisColuna[col] = 0;
  });

  let totalGeral = 0;

  const linhas = listaConsultores.map((consultor) => {
    const valores = {};
    colunas.forEach((col) => {
      valores[col] = 0;
    });

    let totalLinha = 0;
    listaVendas.forEach((venda) => {
      if (venda.consultorId !== consultor.id) return;
      const chave = campo === 'anoModelo' ? Number(venda.anoModelo) : venda.modelo;
      if (valores[chave] !== undefined) {
        valores[chave] += 1;
        totaisColuna[chave] += 1;
        totalLinha += 1;
        totalGeral += 1;
      }
    });

    const celulas = colunas.map((col) => valores[col]);

    return {
      consultorId: consultor.id,
      nome: consultor.nome,
      valores,
      celulas,
      total: totalLinha
    };
  });

  linhas.sort((a, b) => {
    const diff = b.total - a.total;
    if (diff !== 0) return diff;
    return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
  });

  return {
    colunas,
    linhas,
    totaisColuna,
    totalGeral
  };
}

// ==========================================
// FUNÇÕES PURAS DE BI / GRÁFICOS (ITEM 2.2)
// ==========================================

/**
 * Gera série de categorias para Colunas e Pizza (Item 2.2).
 * Ordena por quantidade desc (desempate alfabético; anos em ordem crescente quando dimensao = 'anoModelo').
 */
export function serieCategorias(vendas, dimensao = 'modelo', consultores = []) {
  const listaVendas = Array.isArray(vendas) ? vendas.filter(Boolean) : [];
  if (listaVendas.length === 0) {
    return { labels: [], valores: [] };
  }

  const mapaConsultores = new Map();
  if (Array.isArray(consultores)) {
    consultores.forEach((c) => {
      if (c && c.id) mapaConsultores.set(c.id, c.nome);
    });
  }

  const contagem = new Map();

  listaVendas.forEach((venda) => {
    let chave = '';
    if (dimensao === 'consultor') {
      chave =
        mapaConsultores.get(venda.consultorId) ||
        venda.consultorNome ||
        venda.consultorId ||
        'Consultor';
    } else if (dimensao === 'anoModelo') {
      if (venda.anoModelo === undefined || venda.anoModelo === null) return;
      chave = String(venda.anoModelo);
    } else {
      if (!venda.modelo) return;
      chave = String(venda.modelo);
    }

    contagem.set(chave, (contagem.get(chave) || 0) + 1);
  });

  const pares = Array.from(contagem.entries()).map(([label, valor]) => ({
    label: String(label),
    valor: Number(valor) || 0
  }));

  if (dimensao === 'anoModelo') {
    pares.sort((a, b) => Number(a.label) - Number(b.label));
  } else {
    pares.sort((a, b) => {
      const diff = b.valor - a.valor;
      if (diff !== 0) return diff;
      return a.label.localeCompare(b.label, 'pt-BR');
    });
  }

  return {
    labels: pares.map((p) => p.label),
    valores: pares.map((p) => p.valor)
  };
}

/**
 * Agrupa fatias menores em "Outros" quando houver mais de 6 fatias para Pizza (Item 2.3).
 */
export function agruparFatiasPizza(labels, valores, maxFatias = 6) {
  if (!Array.isArray(labels) || !Array.isArray(valores) || labels.length <= maxFatias) {
    return {
      labels: Array.isArray(labels) ? [...labels] : [],
      valores: Array.isArray(valores) ? valores.map((v) => Number(v) || 0) : []
    };
  }

  const pares = labels.map((label, idx) => ({
    label: String(label),
    valor: Number(valores[idx]) || 0
  }));

  pares.sort((a, b) => {
    const diff = b.valor - a.valor;
    if (diff !== 0) return diff;
    return a.label.localeCompare(b.label, 'pt-BR');
  });

  const principais = pares.slice(0, maxFatias - 1);
  const restantes = pares.slice(maxFatias - 1);
  const somaOutros = restantes.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);

  return {
    labels: [...principais.map((p) => p.label), 'Outros'],
    valores: [...principais.map((p) => p.valor), somaOutros]
  };
}

/**
 * Gera série empilhada por consultor reaproveitando gerarMatriz (Item 2.2).
 */
export function serieEmpilhada(vendas, consultores, dimensao = 'modelo') {
  const dimValida = dimensao === 'anoModelo' ? 'anoModelo' : 'modelo';
  const matriz = gerarMatriz(vendas, consultores, dimValida);

  const labels = matriz.linhas.map((linha) => linha.nome);
  const datasets = matriz.colunas.map((col) => ({
    label: String(col),
    valores: matriz.linhas.map((linha) => Number(linha.valores[col]) || 0)
  }));

  return { labels, datasets };
}

/**
 * Gera série temporal contínua (incluindo zeros) para 'dia' (00h–23h), 'semana' (Seg–Dom) e 'mes' (1..último dia) — Item 2.2.
 */
export function serieTemporal(vendas, periodo = 'mes', dataReferencia = new Date()) {
  const listaVendas = Array.isArray(vendas) ? vendas.filter(Boolean) : [];
  const ref = new Date(dataReferencia);

  if (periodo === 'dia') {
    const labels = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}h`);
    const valores = new Array(24).fill(0);

    listaVendas.forEach((venda) => {
      if (!venda.dataVenda) return;
      const d = new Date(venda.dataVenda);
      if (isNaN(d.getTime())) return;
      const hora = d.getHours();
      if (hora >= 0 && hora < 24) {
        valores[hora] += 1;
      }
    });

    return { labels, valores };
  }

  if (periodo === 'semana') {
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const valores = new Array(7).fill(0);

    listaVendas.forEach((venda) => {
      if (!venda.dataVenda) return;
      const d = new Date(venda.dataVenda);
      if (isNaN(d.getTime())) return;
      const indiceSegADom = (d.getDay() + 6) % 7;
      if (indiceSegADom >= 0 && indiceSegADom < 7) {
        valores[indiceSegADom] += 1;
      }
    });

    return { labels, valores };
  }

  const ultimoDia = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const labels = Array.from({ length: ultimoDia }, (_, i) => String(i + 1));
  const valores = new Array(ultimoDia).fill(0);

  listaVendas.forEach((venda) => {
    if (!venda.dataVenda) return;
    const d = new Date(venda.dataVenda);
    if (isNaN(d.getTime())) return;
    const dia = d.getDate();
    if (dia >= 1 && dia <= ultimoDia) {
      valores[dia - 1] += 1;
    }
  });

  return { labels, valores };
}

/**
 * Gera séries para o gráfico de Linha do BI: linha "Total" + até 5 itens mais vendidos + "Outros" (Item 2.3).
 */
export function gerarSeriesLinhaPorDimensao(
  vendas,
  dimensao = 'modelo',
  periodo = 'mes',
  consultores = [],
  dataReferencia = new Date()
) {
  const baseTotal = serieTemporal(vendas, periodo, dataReferencia);
  const labels = baseTotal.labels;
  const datasets = [
    {
      label: 'Total',
      valores: baseTotal.valores,
      isTotal: true
    }
  ];

  const listaVendas = Array.isArray(vendas) ? vendas.filter(Boolean) : [];
  if (listaVendas.length === 0) {
    return { labels, datasets };
  }

  const mapaConsultores = new Map();
  if (Array.isArray(consultores)) {
    consultores.forEach((c) => {
      if (c && c.id) mapaConsultores.set(c.id, c.nome);
    });
  }

  function obterChaveVenda(v) {
    if (dimensao === 'consultor') {
      return mapaConsultores.get(v.consultorId) || v.consultorId || 'Consultor';
    }
    if (dimensao === 'anoModelo') {
      return String(v.anoModelo ?? '-');
    }
    return String(v.modelo ?? '-');
  }

  const contagem = new Map();
  listaVendas.forEach((v) => {
    const ch = obterChaveVenda(v);
    contagem.set(ch, (contagem.get(ch) || 0) + 1);
  });

  const ordenados = Array.from(contagem.entries())
    .map(([chave, qtd]) => ({ chave, qtd }))
    .sort((a, b) => {
      const diff = b.qtd - a.qtd;
      if (diff !== 0) return diff;
      return String(a.chave).localeCompare(String(b.chave), 'pt-BR');
    });

  const top5 = ordenados.slice(0, 5).map((i) => i.chave);
  const temOutros = ordenados.length > 5;
  const top5Set = new Set(top5);

  top5.forEach((chaveItem) => {
    const vendasDoItem = listaVendas.filter((v) => obterChaveVenda(v) === chaveItem);
    const serieItem = serieTemporal(vendasDoItem, periodo, dataReferencia);
    datasets.push({
      label: String(chaveItem),
      valores: serieItem.valores,
      isTotal: false
    });
  });

  if (temOutros) {
    const vendasOutros = listaVendas.filter((v) => !top5Set.has(obterChaveVenda(v)));
    const serieOutros = serieTemporal(vendasOutros, periodo, dataReferencia);
    datasets.push({
      label: 'Outros',
      valores: serieOutros.valores,
      isTotal: false
    });
  }

  return { labels, datasets };
}

/**
 * Gera os pontos para o gráfico de Dispersão (horário das vendas — Item 2.2):
 * [{ x: diaDoMes (ou dia da semana no filtro semana), y: hora decimal (ex.: 14.5), consultor, modelo, placa }]
 */
export function pontosDispersao(vendas, consultores = [], periodo = 'mes') {
  const listaVendas = Array.isArray(vendas) ? vendas.filter(Boolean) : [];
  if (listaVendas.length === 0) return [];

  const mapaConsultores = new Map();
  if (Array.isArray(consultores)) {
    consultores.forEach((c) => {
      if (c && c.id) mapaConsultores.set(c.id, c.nome);
    });
  }

  const pontos = [];

  listaVendas.forEach((venda) => {
    if (!venda.dataVenda) return;
    const d = new Date(venda.dataVenda);
    if (isNaN(d.getTime())) return;

    const x = periodo === 'semana' ? ((d.getDay() + 6) % 7) + 1 : d.getDate();

    const y = Number((d.getHours() + d.getMinutes() / 60).toFixed(2));
    if (isNaN(x) || isNaN(y)) return;

    const nomeConsultor =
      mapaConsultores.get(venda.consultorId) ||
      venda.consultor ||
      venda.consultorNome ||
      venda.consultorId ||
      'Consultor';

    pontos.push({
      x,
      y,
      consultor: String(nomeConsultor),
      modelo: String(venda.modelo || '-'),
      anoModelo: Number(venda.anoModelo) || 0,
      placa: formatarPlaca(venda.placa),
      dataHora: formatarDataHora(venda.dataVenda)
    });
  });

  return pontos;
}
