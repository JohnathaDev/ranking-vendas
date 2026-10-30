import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DATA_MINIMA_VENDA,
  normalizarPlaca,
  validarPlaca,
  formatarPlaca,
  normalizarContrato,
  validarContrato,
  normalizarNomeConsultor,
  validarNomeConsultor,
  obterDataHojeISO,
  validarDataInput,
  combinarDataComHoraAtual,
  validarDataVenda,
  formatarDataHora,
  filtrarPorPeriodo,
  filtrarVendas,
  agruparPor,
  calcularLiderComEmpate,
  gerarRanking,
  gerarMatriz,
  serieCategorias,
  agruparFatiasPizza,
  serieEmpilhada,
  serieTemporal,
  gerarSeriesLinhaPorDimensao,
  pontosDispersao
} from '../js/utils.js';

describe('Validação e formatação de placa', () => {
  it('normaliza placa removendo símbolos e convertendo para maiúsculas', () => {
    assert.equal(normalizarPlaca('abc-1234'), 'ABC1234');
    assert.equal(normalizarPlaca('  abc1d23  '), 'ABC1D23');
    assert.equal(normalizarPlaca(''), '');
    assert.equal(normalizarPlaca(null), '');
    assert.equal(normalizarPlaca(1234567), '');
  });

  it('valida placas no padrão Mercosul e antigo (com e sem hífen, minúsculas)', () => {
    assert.equal(validarPlaca('ABC1D23'), true);
    assert.equal(validarPlaca('ABC1234'), true);
    assert.equal(validarPlaca('ABC-1234'), true);
    assert.equal(validarPlaca('abc-1d23'), true);
    assert.equal(validarPlaca('  abc1234  '), true);
  });

  it('rejeita placas inválidas (vazio, 6 caracteres, número, null)', () => {
    assert.equal(validarPlaca(''), false);
    assert.equal(validarPlaca('   '), false);
    assert.equal(validarPlaca('ABC123'), false);
    assert.equal(validarPlaca('ABCD123'), false);
    assert.equal(validarPlaca('1234567'), false);
    assert.equal(validarPlaca(1234567), false);
    assert.equal(validarPlaca(null), false);
    assert.equal(validarPlaca(undefined), false);
  });

  it('formata placa de 7 caracteres com hífen apenas se válida e preserva entradas inválidas', () => {
    assert.equal(formatarPlaca('ABC1234'), 'ABC-1234');
    assert.equal(formatarPlaca('abc1d23'), 'ABC-1D23');
    assert.equal(formatarPlaca('ABC-1234'), 'ABC-1234');
    assert.equal(formatarPlaca('1234567'), '1234567');
    assert.equal(formatarPlaca('CURTA'), 'CURTA');
    assert.equal(formatarPlaca(''), '');
    assert.equal(formatarPlaca(null), '');
    assert.equal(formatarPlaca(undefined), '');
  });
});

describe('Validação e normalização de contrato', () => {
  it('normaliza contrato removendo espaços nas pontas e colocando em maiúsculas', () => {
    assert.equal(normalizarContrato('  ct12345  '), 'CT12345');
    assert.equal(normalizarContrato(''), '');
    assert.equal(normalizarContrato(null), '');
  });

  it('aceita contratos alfanuméricos e rejeita espaços internos, símbolos ou vazios', () => {
    assert.equal(validarContrato('CT2026001'), true);
    assert.equal(validarContrato('  abc123  '), true);
    assert.equal(validarContrato('CT 123'), false);
    assert.equal(validarContrato('CT-123'), false);
    assert.equal(validarContrato('CT@123'), false);
    assert.equal(validarContrato(''), false);
    assert.equal(validarContrato(null), false);
  });
});

describe('Validação e normalização de nome de consultor', () => {
  it('normaliza nome removendo acentos, espaços extras e convertendo para minúsculas', () => {
    assert.equal(normalizarNomeConsultor('  João   Vítor   São  '), 'joao vitor sao');
    assert.equal(normalizarNomeConsultor('ÁÉÍÓÚ Ç ÃÕ'), 'aeiou c ao');
    assert.equal(normalizarNomeConsultor(''), '');
    assert.equal(normalizarNomeConsultor(null), '');
  });

  it('valida limites de 3 a 60 caracteres após trim', () => {
    assert.equal(validarNomeConsultor('Ana'), true);
    assert.equal(validarNomeConsultor('  Ana  '), true);
    assert.equal(validarNomeConsultor('A'.repeat(60)), true);
    assert.equal(validarNomeConsultor('Ab'), false);
    assert.equal(validarNomeConsultor('  Ab  '), false);
    assert.equal(validarNomeConsultor('A'.repeat(61)), false);
    assert.equal(validarNomeConsultor(''), false);
    assert.equal(validarNomeConsultor(null), false);
  });
});

describe('Datas de venda e formatação', () => {
  const refFixa = new Date(2026, 4, 15, 14, 30, 0, 0); // 15/05/2026 14:30 local

  it('obterDataHojeISO retorna YYYY-MM-DD no fuso local', () => {
    assert.equal(obterDataHojeISO(refFixa), '2026-05-15');
  });

  it('validarDataInput aceita de 2023-01-01 até hoje e rejeita amanhã, datas inexistentes e formatos errados', () => {
    assert.equal(DATA_MINIMA_VENDA, '2023-01-01');
    assert.equal(validarDataInput('2023-01-01', refFixa), true);
    assert.equal(validarDataInput('2026-05-15', refFixa), true);
    assert.equal(validarDataInput('2022-12-31', refFixa), false);
    assert.equal(validarDataInput('2026-05-16', refFixa), false); // amanhã
    assert.equal(validarDataInput('2023-02-30', refFixa), false); // dia inexistente
    assert.equal(validarDataInput('2023-13-01', refFixa), false);
    assert.equal(validarDataInput('15/05/2026', refFixa), false);
    assert.equal(validarDataInput('2026-5-15', refFixa), false);
    assert.equal(validarDataInput('', refFixa), false);
    assert.equal(validarDataInput(null, refFixa), false);
  });

  it('combinarDataComHoraAtual combina data com hora de referência e nunca gera data futura', () => {
    const isoPassado = combinarDataComHoraAtual('2026-05-10', refFixa);
    const dPassado = new Date(isoPassado);
    assert.equal(dPassado.getFullYear(), 2026);
    assert.equal(dPassado.getMonth(), 4);
    assert.equal(dPassado.getDate(), 10);
    assert.equal(dPassado.getHours(), 14);
    assert.equal(dPassado.getMinutes(), 30);

    const isoFuturo = combinarDataComHoraAtual('2026-05-20', refFixa);
    assert.equal(isoFuturo, refFixa.toISOString());
    assert.ok(new Date(isoFuturo).getTime() <= refFixa.getTime());

    assert.equal(combinarDataComHoraAtual(null, refFixa), null);
    assert.equal(combinarDataComHoraAtual(20260515, refFixa), null);
    assert.equal(combinarDataComHoraAtual('2026-02-30', refFixa), null);
    assert.equal(combinarDataComHoraAtual('15/05/2026', refFixa), null);
  });

  it('validarDataVenda valida ISO dentro do intervalo permitido e rejeita futuro ou inválido', () => {
    const vendaValida = new Date(2026, 4, 10, 10, 0, 0).toISOString();
    const vendaHoje = refFixa.toISOString();
    const vendaFuturaHora = new Date(refFixa.getTime() + 5000).toISOString();
    const vendaAmanhã = new Date(2026, 4, 16, 8, 0, 0).toISOString();
    const vendaAntesMin = new Date(2022, 11, 31, 23, 0, 0).toISOString();

    assert.equal(validarDataVenda(vendaValida, refFixa), true);
    assert.equal(validarDataVenda(vendaHoje, refFixa), true);
    assert.equal(validarDataVenda(vendaFuturaHora, refFixa), false);
    assert.equal(validarDataVenda(vendaAmanhã, refFixa), false);
    assert.equal(validarDataVenda(vendaAntesMin, refFixa), false);
    assert.equal(validarDataVenda('data-invalida', refFixa), false);
    assert.equal(validarDataVenda('', refFixa), false);
    assert.equal(validarDataVenda(null, refFixa), false);
  });

  it('formatarDataHora formata para DD/MM/YYYY às HH:mm ou retorna hífen se inválida', () => {
    const iso = new Date(2026, 4, 5, 9, 7, 0).toISOString();
    assert.equal(formatarDataHora(iso), '05/05/2026 às 09:07');
    assert.equal(formatarDataHora(''), '-');
    assert.equal(formatarDataHora('invalida'), '-');
  });
});

describe('Filtros por período e filtros combinados de vendas', () => {
  const refQuarta = new Date(2026, 4, 13, 15, 0, 0); // Quarta, 13/05/2026 (semana: Seg 11/05 a Dom 17/05)
  const refDomingo = new Date(2026, 4, 17, 20, 0, 0); // Domingo, 17/05/2026 (mesma semana: Seg 11/05 a Dom 17/05)

  const vendasBase = [
    {
      id: 'v-mes-ant',
      consultorId: 'c1',
      modelo: 'Fan 160',
      anoModelo: 2025,
      dataVenda: new Date(2026, 3, 30, 23, 59, 0).toISOString() // 30/04/2026
    },
    {
      id: 'v-inicio-mes',
      consultorId: 'c1',
      modelo: 'Fan 160',
      anoModelo: 2026,
      dataVenda: new Date(2026, 4, 1, 0, 5, 0).toISOString() // 01/05/2026
    },
    {
      id: 'v-dom-ant',
      consultorId: 'c2',
      modelo: 'Bros 160',
      anoModelo: 2025,
      dataVenda: new Date(2026, 4, 10, 23, 59, 0).toISOString() // Dom 10/05/2026 (semana anterior)
    },
    {
      id: 'v-segunda',
      consultorId: 'c1',
      modelo: 'Start 160',
      anoModelo: 2024,
      dataVenda: new Date(2026, 4, 11, 0, 0, 0).toISOString() // Seg 11/05/2026 00:00
    },
    {
      id: 'v-quarta-manha',
      consultorId: 'c2',
      modelo: 'Fan 160',
      anoModelo: 2026,
      dataVenda: new Date(2026, 4, 13, 9, 30, 0).toISOString() // Qua 13/05/2026
    },
    {
      id: 'v-domingo',
      consultorId: 'c2',
      modelo: 'Pop 110i',
      anoModelo: 2026,
      dataVenda: new Date(2026, 4, 17, 23, 59, 0).toISOString() // Dom 17/05/2026
    },
    {
      id: 'v-prox-seg',
      consultorId: 'c1',
      modelo: 'Factor 150',
      anoModelo: 2025,
      dataVenda: new Date(2026, 4, 18, 0, 0, 0).toISOString() // Seg 18/05/2026
    },
    {
      id: 'v-fim-mes',
      consultorId: 'c1',
      modelo: 'Factor 150',
      anoModelo: 2026,
      dataVenda: new Date(2026, 4, 31, 23, 59, 0).toISOString() // 31/05/2026
    },
    {
      id: 'v-prox-mes',
      consultorId: 'c1',
      modelo: 'Factor 150',
      anoModelo: 2026,
      dataVenda: new Date(2026, 5, 1, 0, 0, 0).toISOString() // 01/06/2026
    }
  ];

  it('filtra vendas do dia na referência informada', () => {
    const doDia = filtrarPorPeriodo(vendasBase, 'dia', refQuarta);
    assert.deepEqual(doDia.map((v) => v.id), ['v-quarta-manha']);
  });

  it('filtra vendas da semana (segunda a domingo), inclusive quando a referência é um domingo', () => {
    const idsEsperadosSemana = ['v-segunda', 'v-quarta-manha', 'v-domingo'];
    const daSemanaQuarta = filtrarPorPeriodo(vendasBase, 'semana', refQuarta);
    const daSemanaDomingo = filtrarPorPeriodo(vendasBase, 'semana', refDomingo);

    assert.deepEqual(daSemanaQuarta.map((v) => v.id), idsEsperadosSemana);
    assert.deepEqual(daSemanaDomingo.map((v) => v.id), idsEsperadosSemana);
  });

  it('filtra vendas do mês respeitando virada de mês (1º até último dia)', () => {
    const doMes = filtrarPorPeriodo(vendasBase, 'mes', refQuarta);
    assert.deepEqual(doMes.map((v) => v.id), [
      'v-inicio-mes',
      'v-dom-ant',
      'v-segunda',
      'v-quarta-manha',
      'v-domingo',
      'v-prox-seg',
      'v-fim-mes'
    ]);
  });

  it('retorna array vazio para entrada não-array e ignora itens inválidos', () => {
    assert.deepEqual(filtrarPorPeriodo(null, 'dia', refQuarta), []);
    assert.deepEqual(filtrarPorPeriodo('invalido', 'mes', refQuarta), []);
    assert.deepEqual(filtrarVendas(null, { periodo: 'mes' }, refQuarta), []);

    const comInvalidos = [null, undefined, { id: 'sem-data' }, { id: 'data-ruim', dataVenda: 'abc' }, vendasBase[4]];
    assert.deepEqual(filtrarPorPeriodo(comInvalidos, 'dia', refQuarta).map((v) => v.id), ['v-quarta-manha']);
  });

  it('filtrarVendas combina filtros de período, modelo, ano e consultorId', () => {
    const filtradas = filtrarVendas(
      vendasBase,
      {
        periodo: 'mes',
        modelo: 'Fan 160',
        ano: '2026',
        consultorId: 'c1'
      },
      refQuarta
    );
    assert.deepEqual(filtradas.map((v) => v.id), ['v-inicio-mes']);

    const todosMes = filtrarVendas(
      vendasBase,
      {
        periodo: 'semana',
        modelo: 'todos',
        ano: 'todos',
        consultorId: 'todos'
      },
      refDomingo
    );
    assert.equal(todosMes.length, 3);
  });
});

describe('Agrupamento, líder com empate, ranking e matriz', () => {
  const consultores = [
    { id: 'c1', nome: 'Carlos' },
    { id: 'c2', nome: 'Ana' },
    { id: 'c3', nome: 'Bruno' },
    { id: 'c4', nome: 'Daniel' }
  ];

  const vendas = [
    { id: '1', consultorId: 'c1', modelo: 'Fan 160', anoModelo: 2026 },
    { id: '2', consultorId: 'c1', modelo: 'Fan 160', anoModelo: 2025 },
    { id: '3', consultorId: 'c2', modelo: 'Bros 160', anoModelo: 2026 },
    { id: '4', consultorId: 'c2', modelo: 'Start 160', anoModelo: 2024 },
    { id: '5', consultorId: 'c3', modelo: 'Pop 110i', anoModelo: 2026 }
  ];

  it('agruparPor conta ocorrências por campo e converte anoModelo para número', () => {
    const porAno = agruparPor(vendas, 'anoModelo');
    assert.deepEqual(porAno, [
      { chave: 2024, quantidade: 1 },
      { chave: 2025, quantidade: 1 },
      { chave: 2026, quantidade: 3 }
    ]);
    assert.deepEqual(agruparPor(null, 'modelo'), []);
  });

  it('calcularLiderComEmpate identifica líder único, empate ordenado e lista vazia', () => {
    const semEmpate = calcularLiderComEmpate(vendas, 'modelo');
    assert.equal(semEmpate.valorPrincipal, 'Fan 160');
    assert.equal(semEmpate.detalhe, '2 unidades');
    assert.equal(semEmpate.quantidadeMax, 2);
    assert.deepEqual(semEmpate.empatados, ['Fan 160']);

    const mapaConsultores = new Map(consultores.map((c) => [c.id, c.nome]));
    const comEmpate = calcularLiderComEmpate(vendas, 'consultorId', mapaConsultores);
    assert.equal(comEmpate.valorPrincipal, 'Ana / Carlos · empate');
    assert.equal(comEmpate.detalhe, 'empate · 2 unidades cada');
    assert.equal(comEmpate.quantidadeMax, 2);
    assert.deepEqual(comEmpate.empatados, ['Ana', 'Carlos']);

    const vazio = calcularLiderComEmpate([], 'modelo');
    assert.equal(vazio.valorPrincipal, '-');
    assert.equal(vazio.quantidadeMax, 0);
    assert.deepEqual(vazio.empatados, []);
  });

  it('gerarRanking atribui posições de competição (1, 1, 3, 4), percentuais e desempata por nome', () => {
    const ranking = gerarRanking(vendas, consultores);
    assert.equal(ranking.length, 4);

    assert.deepEqual(
      ranking.map((r) => ({
        posicao: r.posicao,
        nome: r.nome,
        vendas: r.vendas,
        percentual: r.percentual
      })),
      [
        { posicao: 1, nome: 'Ana', vendas: 2, percentual: 40 },
        { posicao: 1, nome: 'Carlos', vendas: 2, percentual: 40 },
        { posicao: 3, nome: 'Bruno', vendas: 1, percentual: 20 },
        { posicao: 4, nome: 'Daniel', vendas: 0, percentual: 0 }
      ]
    );

    assert.equal(ranking[0].modeloTop, 'Bros 160 / Start 160 · empate');
    assert.equal(ranking[1].modeloTop, 'Fan 160');
    assert.equal(ranking[3].modeloTop, '-');
  });

  it('gerarMatriz calcula totais por linha, coluna e geral para modelo e anoModelo', () => {
    const matrizModelo = gerarMatriz(vendas, consultores, 'modelo');
    assert.equal(matrizModelo.totalGeral, 5);
    assert.equal(matrizModelo.totaisColuna['Fan 160'], 2);
    assert.equal(matrizModelo.totaisColuna['Bros 160'], 1);
    assert.equal(matrizModelo.totaisColuna['Start 160'], 1);
    assert.equal(matrizModelo.totaisColuna['Pop 110i'], 1);
    assert.equal(matrizModelo.totaisColuna['Factor 150'], 0);

    const somaLinhasModelo = matrizModelo.linhas.reduce((acc, l) => acc + l.total, 0);
    assert.equal(somaLinhasModelo, matrizModelo.totalGeral);
    assert.equal(matrizModelo.linhas[0].nome, 'Ana');
    assert.equal(matrizModelo.linhas[0].total, 2);

    const matrizAno = gerarMatriz(vendas, consultores, 'anoModelo');
    assert.deepEqual(matrizAno.colunas, [2024, 2025, 2026]);
    assert.equal(matrizAno.totalGeral, 5);
    assert.deepEqual(matrizAno.totaisColuna, { 2024: 1, 2025: 1, 2026: 3 });

    const somaLinhasAno = matrizAno.linhas.reduce((acc, l) => acc + l.total, 0);
    assert.equal(somaLinhasAno, matrizAno.totalGeral);
  });
});

describe('Séries de BI: pizza, temporal, linha por dimensão e dispersão', () => {
  it('agruparFatiasPizza mantém até 6 fatias e agrupa excedentes em "Outros"', () => {
    const labels6 = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'];
    const valores6 = [10, 9, 8, 7, 6, 5];
    const semAgrupar = agruparFatiasPizza(labels6, valores6, 6);
    assert.deepEqual(semAgrupar.labels, labels6);
    assert.deepEqual(semAgrupar.valores, valores6);

    const labels8 = ['G', 'A', 'B', 'C', 'D', 'E', 'F', 'H'];
    const valores8 = [1, 10, 9, 8, 7, 6, 2, 3];
    const agrupado = agruparFatiasPizza(labels8, valores8, 6);
    assert.deepEqual(agrupado.labels, ['A', 'B', 'C', 'D', 'E', 'Outros']);
    assert.deepEqual(agrupado.valores, [10, 9, 8, 7, 6, 6]); // 1 + 2 + 3 = 6
  });

  it('serieCategorias e serieEmpilhada geram estruturas consistentes para gráficos', () => {
    const consultores = [{ id: 'c1', nome: 'Ana' }];
    const vendas = [
      { consultorId: 'c1', modelo: 'Fan 160', anoModelo: 2026 },
      { consultorId: 'c1', modelo: 'Fan 160', anoModelo: 2024 }
    ];

    const catAno = serieCategorias(vendas, 'anoModelo', consultores);
    assert.deepEqual(catAno.labels, ['2024', '2026']);
    assert.deepEqual(catAno.valores, [1, 1]);

    const emp = serieEmpilhada(vendas, consultores, 'anoModelo');
    assert.deepEqual(emp.labels, ['Ana']);
    assert.equal(emp.datasets.length, 3);
  });

  it('serieTemporal gera 24 horas no dia, 7 dias na semana e N dias no mês', () => {
    const refFevBissexto = new Date(2024, 1, 15, 12, 0, 0); // Fevereiro de 2024 (29 dias)
    const refMaio = new Date(2026, 4, 13, 12, 0, 0); // Maio de 2026 (31 dias)

    const vendas = [
      { dataVenda: new Date(2026, 4, 11, 0, 15, 0).toISOString() }, // Seg, dia 11, 00h
      { dataVenda: new Date(2026, 4, 13, 14, 45, 0).toISOString() }, // Qua, dia 13, 14h
      { dataVenda: new Date(2026, 4, 17, 23, 10, 0).toISOString() } // Dom, dia 17, 23h
    ];

    const sDia = serieTemporal(vendas, 'dia', refMaio);
    assert.equal(sDia.labels.length, 24);
    assert.equal(sDia.labels[0], '00h');
    assert.equal(sDia.labels[23], '23h');
    assert.equal(sDia.valores[0], 1);
    assert.equal(sDia.valores[14], 1);
    assert.equal(sDia.valores[23], 1);

    const sSemana = serieTemporal(vendas, 'semana', refMaio);
    assert.equal(sSemana.labels.length, 7);
    assert.deepEqual(sSemana.valores, [1, 0, 1, 0, 0, 0, 1]); // Seg, Qua, Dom

    const sMesMaio = serieTemporal(vendas, 'mes', refMaio);
    assert.equal(sMesMaio.labels.length, 31);
    assert.equal(sMesMaio.valores[10], 1); // dia 11 (índice 10)
    assert.equal(sMesMaio.valores[12], 1); // dia 13 (índice 12)
    assert.equal(sMesMaio.valores[16], 1); // dia 17 (índice 16)

    const sMesFev = serieTemporal([], 'mes', refFevBissexto);
    assert.equal(sMesFev.labels.length, 29);
  });

  it('gerarSeriesLinhaPorDimensao gera série Total + top 5 itens + Outros quando há mais de 5 categorias', () => {
    const ref = new Date(2026, 4, 15, 10, 0, 0);
    const dataIso = new Date(2026, 4, 10, 10, 0, 0).toISOString();
    const modelos = [
      { nome: 'M1', qtd: 6 },
      { nome: 'M2', qtd: 5 },
      { nome: 'M3', qtd: 4 },
      { nome: 'M4', qtd: 3 },
      { nome: 'M5', qtd: 2 },
      { nome: 'M6', qtd: 1 },
      { nome: 'M7', qtd: 1 }
    ];

    const vendas = [];
    modelos.forEach((m) => {
      for (let i = 0; i < m.qtd; i += 1) {
        vendas.push({ modelo: m.nome, dataVenda: dataIso });
      }
    });

    const resultado = gerarSeriesLinhaPorDimensao(vendas, 'modelo', 'mes', [], ref);
    assert.equal(resultado.labels.length, 31);
    assert.deepEqual(
      resultado.datasets.map((d) => d.label),
      ['Total', 'M1', 'M2', 'M3', 'M4', 'M5', 'Outros']
    );
    assert.equal(resultado.datasets[0].isTotal, true);
    assert.equal(resultado.datasets[0].valores[9], 22); // dia 10 (índice 9) soma todas as 22 vendas
    assert.equal(resultado.datasets[6].valores[9], 2); // Outros = M6 (1) + M7 (1)
  });

  it('pontosDispersao calcula coordenadas x (dia do mês ou dia da semana) e y (hora decimal)', () => {
    const consultores = [{ id: 'c1', nome: 'João Vitor' }];
    const vendas = [
      {
        consultorId: 'c1',
        modelo: 'Fan 160',
        anoModelo: 2026,
        placa: 'ABC1D23',
        dataVenda: new Date(2026, 4, 17, 14, 30, 0).toISOString() // Dom 17/05/2026 às 14:30
      }
    ];

    const pontosMes = pontosDispersao(vendas, consultores, 'mes');
    assert.equal(pontosMes.length, 1);
    assert.equal(pontosMes[0].x, 17);
    assert.equal(pontosMes[0].y, 14.5);
    assert.equal(pontosMes[0].consultor, 'João Vitor');
    assert.equal(pontosMes[0].placa, 'ABC-1D23');

    const pontosSemana = pontosDispersao(vendas, consultores, 'semana');
    assert.equal(pontosSemana.length, 1);
    assert.equal(pontosSemana[0].x, 7); // Domingo = 7
    assert.equal(pontosSemana[0].y, 14.5);
  });
});
