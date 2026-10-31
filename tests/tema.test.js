import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolverTema, aplicarTema, alternarTema, TEMAS } from '../js/tema.js';
import { STORAGE_KEYS } from '../js/storage.js';

describe('Resolução de tema (modo claro / modo escuro)', () => {
  it('respeita a escolha salva no storage como "escuro", mesmo se o sistema for claro', () => {
    assert.equal(resolverTema('escuro', false), TEMAS.ESCURO);
    assert.equal(resolverTema('escuro', true), TEMAS.ESCURO);
  });

  it('respeita a escolha salva no storage como "claro", mesmo se o sistema for escuro', () => {
    assert.equal(resolverTema('claro', false), TEMAS.CLARO);
    assert.equal(resolverTema('claro', true), TEMAS.CLARO);
  });

  it('quando não há escolha salva (null ou undefined), segue a preferência do sistema', () => {
    assert.equal(resolverTema(null, true), TEMAS.ESCURO);
    assert.equal(resolverTema(null, false), TEMAS.CLARO);
    assert.equal(resolverTema(undefined, true), TEMAS.ESCURO);
    assert.equal(resolverTema(undefined, false), TEMAS.CLARO);
  });

  it('quando o valor salvo for inválido, faz fallback seguro para a preferência do sistema', () => {
    assert.equal(resolverTema('invalido', true), TEMAS.ESCURO);
    assert.equal(resolverTema('', false), TEMAS.CLARO);
  });

  it('possui a chave de armazenamento TEMA configurada em STORAGE_KEYS', () => {
    assert.equal(STORAGE_KEYS.TEMA, 'ranking_motos_tema');
  });
});

describe('Garantia de resolução assíncrona e prevenção de corrida (aplicarTema / alternarTema)', () => {
  it('aplicarTema retorna uma Promise que resolve com o tema aplicado', async () => {
    const res = await aplicarTema('escuro', { salvar: false, transicao: false });
    assert.equal(res, TEMAS.ESCURO);
  });

  it('alternarTema aguarda a mutação antes de executar o callback aoMudarTema', async () => {
    let callbackChamado = false;
    let temaNoCallback = null;

    // Simula document global básico se não existir em ambiente de teste node puro
    const documentOriginal = globalThis.document;
    globalThis.document = {
      documentElement: {
        getAttribute: () => 'claro',
        setAttribute: () => {},
        classList: { contains: () => false, add: () => {}, remove: () => {} }
      },
      getElementById: () => null,
      startViewTransition: (cb) => {
        return {
          updateCallbackDone: new Promise((resolve) => {
            setTimeout(() => {
              cb();
              resolve();
            }, 10);
          })
        };
      }
    };

    try {
      await alternarTema({
        aoMudarTema: (novo) => {
          callbackChamado = true;
          temaNoCallback = novo;
        }
      });

      assert.equal(callbackChamado, true);
      assert.equal(temaNoCallback, TEMAS.ESCURO);
    } finally {
      globalThis.document = documentOriginal;
    }
  });
});
