import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { instalarLocalStorageMock } from './helpers/localStorage.mock.js';
import {
  STORAGE_KEYS,
  gerarHashSHA256,
  inicializarSeedSeNecessario,
  getUsuarios,
  getConsultores,
  getConsultorAtivoId,
  getEstadoBloqueioLogin,
  getSessaoAtiva,
  login,
  logout,
  getVendas,
  getVendasPorConsultor,
  addVenda,
  deleteVenda
} from '../js/storage.js';

const DATA_REF_FIXA = new Date(2026, 4, 15, 14, 30, 0, 0); // 15/05/2026 14:30 local

describe('Hash SHA-256, login, bloqueio de tentativas e sessão', () => {
  beforeEach(() => {
    instalarLocalStorageMock();
    mock.timers.enable({ apis: ['Date'], now: DATA_REF_FIXA });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('gerarHashSHA256 retorna o digest hexadecimal esperado para "123456"', async () => {
    const hash = await gerarHashSHA256('123456');
    assert.equal(
      hash,
      '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'
    );
  });

  it('login autentica de forma case-insensitive no usuário, cria sessão e define consultor ativo', async () => {
    inicializarSeedSeNecessario(DATA_REF_FIXA);
    localStorage.removeItem(STORAGE_KEYS.CONSULTOR_ATIVO);

    const usuarioLogado = await login('  joaovitor  ', '123456');
    assert.equal(usuarioLogado.usuario, 'JoaoVitor');
    assert.equal(usuarioLogado.nome, 'João Vitor');
    assert.ok(usuarioLogado.consultorId);

    const sessaoAtiva = getSessaoAtiva();
    assert.deepEqual(sessaoAtiva, usuarioLogado);
    assert.equal(getConsultorAtivoId(), usuarioLogado.consultorId);
  });

  it('rejeita senha errada e campos vazios incrementando falhas, e zera o contador ao acertar', async () => {
    inicializarSeedSeNecessario(DATA_REF_FIXA);

    await assert.rejects(() => login('JoaoVitor', 'senha-errada'), /Usuário ou senha inválidos/);
    assert.equal(getEstadoBloqueioLogin().falhas, 1);

    await assert.rejects(() => login('', '123456'), /Usuário ou senha inválidos/);
    assert.equal(getEstadoBloqueioLogin().falhas, 2);

    await assert.rejects(() => login('JoaoVitor', ''), /Usuário ou senha inválidos/);
    assert.equal(getEstadoBloqueioLogin().falhas, 3);

    await login('JoaoVitor', '123456');
    const estadoAposSucesso = getEstadoBloqueioLogin();
    assert.equal(estadoAposSucesso.bloqueado, false);
    assert.equal(estadoAposSucesso.falhas, 0);
  });

  it('bloqueia após 5 falhas com code AUTH_LOCKED e desbloqueia após 60 segundos', async () => {
    inicializarSeedSeNecessario(DATA_REF_FIXA);

    for (let i = 1; i <= 5; i += 1) {
      await assert.rejects(() => login('JoaoVitor', 'errada'));
    }

    const estadoBloqueado = getEstadoBloqueioLogin();
    assert.equal(estadoBloqueado.bloqueado, true);
    assert.equal(estadoBloqueado.falhas, 5);
    assert.equal(estadoBloqueado.segundosRestantes, 60);

    await assert.rejects(
      () => login('JoaoVitor', '123456'),
      (err) => {
        assert.equal(err.code, 'AUTH_LOCKED');
        assert.equal(err.segundosRestantes, 60);
        return true;
      }
    );

    mock.timers.tick(59 * 1000);
    assert.equal(getEstadoBloqueioLogin().bloqueado, true);

    mock.timers.tick(1000); // Total 60s
    const estadoApos60s = getEstadoBloqueioLogin();
    assert.equal(estadoApos60s.bloqueado, false);
    assert.equal(estadoApos60s.falhas, 0);

    const logado = await login('JoaoVitor', '123456');
    assert.equal(logado.usuario, 'JoaoVitor');
  });

  it('getSessaoAtiva retorna sessão válida, remove sessão após 8h e retorna null se usuário ou consultor não existir', async () => {
    inicializarSeedSeNecessario(DATA_REF_FIXA);
    await login('JoaoVitor', '123456');

    assert.ok(getSessaoAtiva());

    // 8 horas menos 1 segundo: ainda válida
    mock.timers.tick(8 * 60 * 60 * 1000 - 1000);
    assert.ok(getSessaoAtiva());

    // Mais 1 segundo (exatamente 8h): expirada
    mock.timers.tick(1000);
    assert.equal(getSessaoAtiva(), null);
    assert.equal(localStorage.getItem(STORAGE_KEYS.SESSAO), null);

    // Nova sessão com usuário removido do storage
    await login('JoaoVitor', '123456');
    assert.ok(getSessaoAtiva());
    localStorage.setItem(STORAGE_KEYS.USUARIOS, JSON.stringify([]));
    assert.equal(getSessaoAtiva(), null);
    assert.equal(localStorage.getItem(STORAGE_KEYS.SESSAO), null);

    // Nova sessão com consultor removido do storage
    inicializarSeedSeNecessario(DATA_REF_FIXA);
    await login('JoaoVitor', '123456');
    localStorage.setItem(STORAGE_KEYS.CONSULTORES, JSON.stringify([]));
    assert.equal(getSessaoAtiva(), null);
    assert.equal(localStorage.getItem(STORAGE_KEYS.SESSAO), null);
  });

  it('logout encerra a sessão ativa', async () => {
    inicializarSeedSeNecessario(DATA_REF_FIXA);
    await login('JoaoVitor', '123456');
    assert.ok(getSessaoAtiva());

    logout();
    assert.equal(getSessaoAtiva(), null);
    assert.equal(localStorage.getItem(STORAGE_KEYS.SESSAO), null);
  });
});

describe('Operações e permissões de addVenda e deleteVenda', () => {
  beforeEach(() => {
    instalarLocalStorageMock();
    mock.timers.enable({ apis: ['Date'], now: DATA_REF_FIXA });
    inicializarSeedSeNecessario(DATA_REF_FIXA);
  });

  afterEach(() => {
    mock.timers.reset();
  });

  it('addVenda exige login ativo', () => {
    assert.throws(
      () =>
        addVenda({
          placa: 'ABC1D23',
          numeroContrato: 'CT9001',
          modelo: 'Fan 160',
          anoModelo: 2026,
          dataVenda: DATA_REF_FIXA.toISOString()
        }),
      /Acesso negado/
    );
  });

  it('addVenda grava venda válida com placa normalizada e ignora consultorId do payload', async () => {
    const usuario = await login('JoaoVitor', '123456');
    const outroConsultor = getConsultores().find((c) => c.id !== usuario.consultorId);

    const novaVenda = addVenda({
      consultorId: outroConsultor.id, // deve ser ignorado
      placa: 'abc-1d23',
      numeroContrato: '  CT9001  ',
      modelo: 'Fan 160',
      anoModelo: '2026',
      dataVenda: new Date(2026, 4, 10, 10, 0, 0).toISOString()
    });

    assert.equal(novaVenda.consultorId, usuario.consultorId);
    assert.notEqual(novaVenda.consultorId, outroConsultor.id);
    assert.equal(novaVenda.placa, 'ABC1D23');
    assert.equal(novaVenda.numeroContrato, 'CT9001');
    assert.equal(novaVenda.modelo, 'Fan 160');
    assert.equal(novaVenda.anoModelo, 2026);

    const vendasDoJoao = getVendasPorConsultor(usuario.consultorId);
    assert.ok(vendasDoJoao.some((v) => v.id === novaVenda.id));
  });

  it('addVenda aceita a MESMA placa em contratos diferentes e rejeita contrato duplicado (case-insensitive)', async () => {
    await login('JoaoVitor', '123456');

    const venda1 = addVenda({
      placa: 'XYZ-9A88',
      numeroContrato: 'CT9100',
      modelo: 'Bros 160',
      anoModelo: 2026,
      dataVenda: DATA_REF_FIXA.toISOString()
    });

    const venda2MesmaPlaca = addVenda({
      placa: 'xyz9a88',
      numeroContrato: 'CT9101',
      modelo: 'Bros 160',
      anoModelo: 2025,
      dataVenda: DATA_REF_FIXA.toISOString()
    });

    assert.equal(venda1.placa, 'XYZ9A88');
    assert.equal(venda2MesmaPlaca.placa, 'XYZ9A88');
    assert.notEqual(venda1.id, venda2MesmaPlaca.id);

    assert.throws(
      () =>
        addVenda({
          placa: 'DEF1G23',
          numeroContrato: 'ct9100', // duplicado em minúsculas
          modelo: 'Fan 160',
          anoModelo: 2026,
          dataVenda: DATA_REF_FIXA.toISOString()
        }),
      /já está cadastrado/
    );
  });

  it('addVenda rejeita modelo fora do catálogo, ano inválido para o modelo, datas inválidas, placa e contrato inválidos', async () => {
    await login('JoaoVitor', '123456');

    const baseValida = {
      placa: 'ABC1D23',
      numeroContrato: 'CT9200',
      modelo: 'Pop 110i',
      anoModelo: 2026,
      dataVenda: DATA_REF_FIXA.toISOString()
    };

    assert.throws(() => addVenda({ ...baseValida, placa: 'INVALIDA' }), /Placa inválida/);
    assert.throws(
      () => addVenda({ ...baseValida, numeroContrato: 'CT 9200' }),
      /Número de contrato inválido/
    );
    assert.throws(
      () => addVenda({ ...baseValida, modelo: 'CB 300F' }),
      /não pertence ao catálogo oficial/
    );
    assert.throws(
      () => addVenda({ ...baseValida, modelo: 'Pop 110i', anoModelo: 2024 }),
      /não é válido para o modelo/
    );
    assert.throws(
      () =>
        addVenda({
          ...baseValida,
          dataVenda: new Date(2022, 11, 31, 12, 0, 0).toISOString()
        }),
      /não pode ser anterior a 01\/01\/2023/
    );
    assert.throws(
      () =>
        addVenda({
          ...baseValida,
          dataVenda: new Date(2026, 4, 16, 12, 0, 0).toISOString()
        }),
      /inválida ou posterior à data de hoje/
    );
  });

  it('deleteVenda exige login, bloqueia exclusão de outro consultor, retorna false para inexistente e remove venda própria', async () => {
    const vendasIniciais = getVendas();
    assert.throws(() => deleteVenda(vendasIniciais[0].id), /Acesso negado/);

    const usuario = await login('JoaoVitor', '123456');
    const vendaOutroConsultor = vendasIniciais.find(
      (v) => v.consultorId !== usuario.consultorId
    );
    const vendaPropria = vendasIniciais.find(
      (v) => v.consultorId === usuario.consultorId
    );

    assert.throws(
      () => deleteVenda(vendaOutroConsultor.id),
      /Permissão negada/
    );

    assert.equal(deleteVenda('id-que-nao-existe'), false);

    const totalAntes = getVendas().length;
    const removida = deleteVenda(vendaPropria.id);
    assert.equal(removida, true);
    assert.equal(getVendas().length, totalAntes - 1);
    assert.equal(
      getVendas().some((v) => v.id === vendaPropria.id),
      false
    );
  });
});
