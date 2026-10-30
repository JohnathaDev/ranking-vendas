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
  filtrarVendas
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

  it('formata placa de 7 caracteres com hífen e preserva entradas inválidas', () => {
    assert.equal(formatarPlaca('ABC1234'), 'ABC-1234');
    assert.equal(formatarPlaca('abc1d23'), 'ABC-1D23');
    assert.equal(formatarPlaca('ABC-1234'), 'ABC-1234');
    assert.equal(formatarPlaca('CURTA'), 'CURTA');
    assert.equal(formatarPlaca(''), '');
    assert.equal(formatarPlaca(null), '');
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
