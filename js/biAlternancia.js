/**
 * Módulo de alternância automática do gráfico de BI (Item 5).
 * Permite alternar automaticamente entre os tipos de gráfico do BI a cada 20 segundos.
 * Suporta pausa inteligente em:
 * - Aba em segundo plano (document.hidden / visibilitychange)
 * - Hover do cursor sobre a área do gráfico
 * - Seção colapsável fechada (!detalhesAnaliseVisual.open)
 * - Aba do Ranking oculta
 * Retorna para modo Fixo se o usuário interagir manualmente com o seletor.
 * Salva a preferência em localStorage ('ranking_motos_bi_alternar').
 */

import { STORAGE_KEYS } from './storage.js';
import { proximoTipoGrafico } from './utils.js';

export const INTERVALO_ALTERNANCIA_MS = 20000;
const RESOLUCAO_TICK_MS = 100;

/**
 * Cria e inicializa o gerenciador da alternância automática do BI.
 * @param {Object} config
 * @returns {Object} Instância com métodos de controle e consulta
 */
export function criarGerenciadorAlternanciaBI(config) {
  const {
    selectTipo,
    containerGrafico,
    detalhesSecao,
    painelRanking,
    btnFixo,
    btnAlternar,
    barraProgresso,
    tiposDisponiveis = [],
    obterTipoAtual = () => 'colunas',
    aoMudarTipo = () => {}
  } = config;

  let modoAtual = 'fixo';
  let tempoDecorridoMs = 0;
  let timerId = null;
  let isMouseSobreGrafico = false;

  function salvarPreferencia(modo) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.BI_ALTERNAR, modo);
      }
    } catch {
      // Ignora falhas de localStorage (ex: sandboxes restritas)
    }
  }

  function carregarPreferencia() {
    try {
      if (typeof localStorage !== 'undefined') {
        const salvo = localStorage.getItem(STORAGE_KEYS.BI_ALTERNAR);
        return salvo === 'alternar' ? 'alternar' : 'fixo';
      }
    } catch {
      // Fallback seguro
    }
    return 'fixo';
  }

  function devePausar() {
    if (typeof document !== 'undefined' && document.hidden) return true;
    if (isMouseSobreGrafico) return true;
    if (detalhesSecao && !detalhesSecao.open) return true;
    if (painelRanking && painelRanking.classList.contains('hidden')) return true;
    return false;
  }

  function atualizarBarraProgresso(fracao) {
    if (!barraProgresso) return;
    const pct = Math.max(0, Math.min(100, fracao * 100));
    barraProgresso.style.width = String(pct) + '%';
  }

  function pararLoop() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    tempoDecorridoMs = 0;
    atualizarBarraProgresso(0);
  }

  function executarTick() {
    if (modoAtual !== 'alternar') {
      pararLoop();
      return;
    }

    if (devePausar()) {
      return;
    }

    tempoDecorridoMs += RESOLUCAO_TICK_MS;
    if (tempoDecorridoMs >= INTERVALO_ALTERNANCIA_MS) {
      tempoDecorridoMs = 0;
      atualizarBarraProgresso(0);
      const atual = obterTipoAtual();
      const proximo = proximoTipoGrafico(atual, tiposDisponiveis);
      if (proximo && proximo !== atual) {
        aoMudarTipo(proximo);
      }
    } else {
      atualizarBarraProgresso(tempoDecorridoMs / INTERVALO_ALTERNANCIA_MS);
    }
  }

  function iniciarLoop() {
    if (timerId !== null) return;
    tempoDecorridoMs = 0;
    atualizarBarraProgresso(0);
    timerId = setInterval(executarTick, RESOLUCAO_TICK_MS);
  }

  function atualizarBotoesUI() {
    const isAlternar = modoAtual === 'alternar';
    if (btnFixo) {
      btnFixo.classList.toggle('active', !isAlternar);
      btnFixo.setAttribute('aria-pressed', String(!isAlternar));
    }
    if (btnAlternar) {
      btnAlternar.classList.toggle('active', isAlternar);
      btnAlternar.setAttribute('aria-pressed', String(isAlternar));
    }
  }

  function definirModo(novoModo, persistir = true) {
    modoAtual = novoModo === 'alternar' ? 'alternar' : 'fixo';
    atualizarBotoesUI();
    if (persistir) {
      salvarPreferencia(modoAtual);
    }

    if (modoAtual === 'alternar') {
      iniciarLoop();
    } else {
      pararLoop();
    }
  }

  // Interação nos botões segmentados
  if (btnFixo) {
    btnFixo.addEventListener('click', () => {
      definirModo('fixo');
    });
  }

  if (btnAlternar) {
    btnAlternar.addEventListener('click', () => {
      definirModo('alternar');
    });
  }

  // Interação manual no seletor volta para Fixo
  if (selectTipo) {
    selectTipo.addEventListener('change', () => {
      if (modoAtual === 'alternar') {
        definirModo('fixo');
      }
    });
  }

  // Hover sobre o gráfico pausa o cronômetro
  if (containerGrafico) {
    containerGrafico.addEventListener('mouseenter', () => {
      isMouseSobreGrafico = true;
    });
    containerGrafico.addEventListener('mouseleave', () => {
      isMouseSobreGrafico = false;
    });
  }

  // Inicializa com preferência salva
  const modoInicial = carregarPreferencia();
  definirModo(modoInicial, false);

  return {
    obterModo: () => modoAtual,
    definirModo,
    destruir: () => {
      pararLoop();
    }
  };
}
