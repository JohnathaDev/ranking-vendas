/**
 * Utilitários puros (sem acesso ao DOM) para validação de dados,
 * formatação de datas/placas, filtros combinados, ranking de competição e matriz analítica.
 */

import { getModelos, getTodosAnos } from './catalog.js';

/**
 * Limite mínimo permitido para a data de venda em todo o sistema (Item A2).
 */
export const DATA_MINIMA_VENDA = '2023-01-01';

/**
 * Remove caracteres especiais e hífens da placa, convertendo para maiúsculas.
 * @param {string} placaRaw
 * @returns {string} Placa limpa (somente letras e dígitos em maiúsculo)
 */
export function normalizarPlaca(placaRaw) {
  if (!placaRaw || typeof placaRaw !== 'string') return '';
  return placaRaw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Valida a placa aceitando como separador APENAS hífen opcional entre as 3 letras e o restante.
 * Rejeita qualquer outro caractere (espaços, pontos, underscores, etc).
 * Formato antigo: ABC1234 ou ABC-1234
 * Formato Mercosul: ABC1D23 ou ABC-1D23
 * @param {string} placaRaw
 * @returns {boolean}
 */
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

/**
 * Formata uma placa de 7 caracteres para o padrão visual com hífen (ABC-1234 ou ABC-1D23).
 * @param {string} placaSemHifen
 * @returns {string} Placa formatada
 */
export function formatarPlaca(placaSemHifen) {
  const placa = normalizarPlaca(placaSemHifen);
  if (placa.length === 7) {
    return `${placa.slice(0, 3)}-${placa.slice(3)}`;
  }
  return placaSemHifen || '';
}

/**
 * Normaliza o número do contrato removendo espaços nas pontas e convertendo para maiúsculas (Item B2).
 * @param {string} contrato
 * @returns {string}
 */
export function normalizarContrato(contrato) {
  if (!contrato || typeof contrato !== 'string') return '';
  return contrato.trim().toUpperCase();
}

/**
 * Valida o número do contrato:
 * Obrigatório, apenas números e/ou letras, ignorando espaços nas pontas (Item B2).
 * @param {string} contrato
 * @returns {boolean}
 */
export function validarContrato(contrato) {
  if (!contrato || typeof contrato !== 'string') return false;
  const regexContrato = /^[A-Za-z0-9]+$/;
  return regexContrato.test(contrato.trim());
}

/**
 * Normaliza o nome do consultor para comparação sem diferenciar maiúsculas/minúsculas,
 * acentos e espaços extras.
 * @param {string} nome
 * @returns {string} Nome normalizado
 */
export function normalizarNomeConsultor(nome) {
  if (!nome || typeof nome !== 'string') return '';
  return nome
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Valida os requisitos do nome do consultor (de 3 a 60 caracteres).
 * @param {string} nome
 * @returns {boolean}
 */
export function validarNomeConsultor(nome) {
  if (!nome || typeof nome !== 'string') return false;
  const limpo = nome.trim();
  return limpo.length >= 3 && limpo.length <= 60;
}

/**
 * Retorna a data no formato YYYY-MM-DD considerando o fuso local.
 * @param {Date} [data=new Date()]
 * @returns {string} Data em formato YYYY-MM-DD
 */
export function obterDataHojeISO(data = new Date()) {
  const d = new Date(data);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Valida se uma string YYYY-MM-DD é uma data válida de calendário,
 * maior ou igual a 2023-01-01 (Item A2) e não futura em relação a hoje.
 * @param {string} dataYMD
 * @param {Date} [dataReferencia=new Date()]
 * @returns {boolean}
 */
export function validarDataInput(dataYMD, dataReferencia = new Date()) {
  if (!dataYMD || typeof dataYMD !== 'string') return false;
  const limpo = dataYMD.trim();
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(limpo)) return false;

  const [ano, mes, dia] = limpo.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    return false;
  }

  const hojeStr = obterDataHojeISO(dataReferencia);
  return limpo >= DATA_MINIMA_VENDA && limpo <= hojeStr;
}

/**
 * Combina uma data YYYY-MM-DD com o horário atual local (horas, minutos, segundos).
 * Garante que a data/hora resultante não ultrapasse o momento presente.
 * @param {string} dataYMD Data no formato YYYY-MM-DD
 * @param {Date} [horaRef=new Date()] Objeto Date de referência
 * @returns {string} Data e hora combinadas em formato ISO
 */
export function combinarDataComHoraAtual(dataYMD, horaRef = new Date()) {
  const [ano, mes, dia] = dataYMD.trim().split('-').map(Number);
  const agora = new Date(horaRef);

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

/**
 * Valida se a data de venda ISO é uma data válida, maior ou igual a 2023-01-01 (Item A2)
 * e não está no futuro.
 * @param {string} dataIso
 * @param {Date} [dataReferencia=new Date()]
 * @returns {boolean}
 */
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

/**
 * Formata data ISO para exibição amigável em pt-BR (ex: "28/10/2026 às 14:35").
 * @param {string} dataIso
 * @returns {string} Data e hora formatadas
 */
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

/**
 * Filtra uma lista de vendas de acordo com o período especificado.
 * @param {Array<Object>} vendas Lista de vendas a filtrar
 * @param {'dia' | 'semana' | 'mes'} periodo Período desejado
 * @param {Date} [dataReferencia=new Date()] Data de referência (padrão hoje)
 * @returns {Array<Object>} Vendas pertencentes ao período
 */
export function filtrarPorPeriodo(vendas, periodo, dataReferencia = new Date()) {
  if (!Array.isArray(vendas)) return [];

  const ref = new Date(dataReferencia);
  const anoRef = ref.getFullYear();
  const mesRef = ref.getMonth();
  const diaRef = ref.getDate();

  // Início e fim do dia
  const inicioDia = new Date(anoRef, mesRef, diaRef, 0, 0, 0, 0);
  const fimDia = new Date(anoRef, mesRef, diaRef, 23, 59, 59, 999);

  // Início e fim do mês
  const inicioMes = new Date(anoRef, mesRef, 1, 0, 0, 0, 0);
  const ultimoDiaMes = new Date(anoRef, mesRef + 1, 0).getDate();
  const fimMes = new Date(anoRef, mesRef, ultimoDiaMes, 23, 59, 59, 999);

  // Início e fim da semana (Segunda a Domingo)
  const diaSemana = ref.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
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

/**
 * Filtra vendas aplicando múltiplos critérios (período, modelo, ano e consultor) — Item E6.
 * @param {Array<Object>} vendas Lista de vendas
 * @param {Object} [filtros={}] Objeto com { periodo, modelo, ano, consultorId }
 * @param {Date} [dataReferencia=new Date()] Data de referência para o recorte temporal
 * @returns {Array<Object>} Lista de vendas filtradas
 */
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

/**
 * Agrupa as vendas por uma chave específica (ex: 'modelo', 'anoModelo', 'consultorId').
 * @param {Array<Object>} vendas Lista de vendas
 * @param {string} campo Nome do campo para agrupamento
 * @returns {Array<{ chave: string|number, quantidade: number }>} Lista agrupada
 */
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

/**
 * Calcula o item mais frequente (líder) de um campo nas vendas, tratando empates como "A / B · empate".
 * @param {Array<Object>} vendas Lista de vendas
 * @param {string} campo Campo a agrupar ('modelo' | 'anoModelo' | 'consultorId')
 * @param {Map<string, string>|Object|null} [mapaLabels=null] Mapa opcional para traduzir ID em nome
 * @param {string} [unidadeSingular='unidade']
 * @param {string} [unidadePlural='unidades']
 * @returns {{ valorPrincipal: string, detalhe: string, quantidadeMax: number, empatados: string[] }}
 */
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

/**
 * Gera o ranking de competição (1, 1, 3) para todos os consultores (inclusive com 0 vendas) — Item E3 e E6.
 * @param {Array<Object>} vendas Vendas já filtradas no recorte
 * @param {Array<{ id: string, nome: string }>} consultores Lista de todos os consultores
 * @returns {Array<{ posicao: number, consultorId: string, nome: string, vendas: number, percentual: number, modeloTop: string }>}
 */
export function gerarRanking(vendas, consultores) {
  if (!Array.isArray(consultores) || consultores.length === 0) return [];
  const listaVendas = Array.isArray(vendas) ? vendas.filter(Boolean) : [];
  const totalGeral = listaVendas.length;

  const itens = consultores
    .filter((c) => c && c.id)
    .map((consultor) => {
      const vendasConsultor = listaVendas.filter((v) => v.consultorId === consultor.id);
      const qtd = vendasConsultor.length;
      const percentual =
        totalGeral > 0 ? Number(((qtd / totalGeral) * 100).toFixed(1)) : 0;

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

  // Ordenação padrão: vendas decrescente, desempate por nome em ordem alfabética crescente
  itens.sort((a, b) => {
    const diff = b.vendas - a.vendas;
    if (diff !== 0) return diff;
    return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
  });

  // Posição em ranking de competição (1, 1, 3)
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

/**
 * Gera a matriz cruzada Consultor x (Modelo | Ano Modelo) com totais por linha, coluna e geral — Item E4 e E6.
 * @param {Array<Object>} vendas Vendas já filtradas no recorte
 * @param {Array<{ id: string, nome: string }>} consultores Lista de consultores
 * @param {'modelo' | 'anoModelo'} [dimensao='modelo'] Dimensão das colunas
 * @returns {{
 *   colunas: Array<string|number>,
 *   linhas: Array<{ consultorId: string, nome: string, valores: Object, celulas: number[], total: number }>,
 *   totaisColuna: Object,
 *   totalGeral: number
 * }}
 */
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

  // Ordena linhas por total decrescente e desempate por nome
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
