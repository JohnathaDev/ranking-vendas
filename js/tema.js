/**
 * Módulo de Tema (js/tema.js):
 * Gerencia alternância de modo claro/escuro, sincronização com o sistema operacional,
 * persistência no localStorage (chave ranking_motos_tema) e redesenho de gráficos.
 */

import { STORAGE_KEYS } from './storage.js';

export const TEMAS = {
  CLARO: 'claro',
  ESCURO: 'escuro'
};

/**
 * Função pura que resolve o tema a ser aplicado.
 * @param {string|null|undefined} salvo - Valor salvo no storage ('claro', 'escuro' ou outro)
 * @param {boolean} prefereEscuro - Se o sistema operacional prefere modo escuro (matchMedia)
 * @returns {'claro'|'escuro'}
 */
export function resolverTema(salvo, prefereEscuro) {
  if (salvo === TEMAS.ESCURO) return TEMAS.ESCURO;
  if (salvo === TEMAS.CLARO) return TEMAS.CLARO;
  return Boolean(prefereEscuro) ? TEMAS.ESCURO : TEMAS.CLARO;
}

/**
 * Obtém a preferência do sistema operacional via matchMedia.
 * @returns {boolean}
 */
export function obterPreferenciaSistemaEscuro() {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

/**
 * Obtém o tema atualmente ativo no documentElement.
 * @returns {'claro'|'escuro'}
 */
export function obterTemaAtual() {
  if (typeof document !== 'undefined' && document.documentElement) {
    const tema = document.documentElement.getAttribute('data-tema');
    if (tema === TEMAS.ESCURO) return TEMAS.ESCURO;
  }
  return TEMAS.CLARO;
}

/**
 * Atualiza o estado visual e atributos de acessibilidade do botão de tema.
 * @param {'claro'|'escuro'} tema
 */
export function atualizarBotaoTema(tema) {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('btnAlternarTema');
  if (!btn) return;

  const ehEscuro = tema === TEMAS.ESCURO;
  btn.setAttribute('aria-pressed', ehEscuro ? 'true' : 'false');
  btn.setAttribute('aria-label', ehEscuro ? 'Ativar modo claro' : 'Ativar modo escuro');
  btn.title = ehEscuro ? 'Ativar modo claro' : 'Ativar modo escuro';

  const iconSun = btn.querySelector('.icon-theme-sun');
  const iconMoon = btn.querySelector('.icon-theme-moon');
  if (iconSun && iconMoon) {
    iconSun.classList.toggle('hidden', !ehEscuro);
    iconMoon.classList.toggle('hidden', ehEscuro);
  }
}

/**
 * Aplica o tema no documentElement, atualiza atributos do botão e salva se solicitado.
 * @param {'claro'|'escuro'} tema
 * @param {{ salvar?: boolean, transicao?: boolean }} [opcoes]
 */
export function aplicarTema(tema, { salvar = false, transicao = true } = {}) {
  const temaFinal = tema === TEMAS.ESCURO ? TEMAS.ESCURO : TEMAS.CLARO;

  if (typeof document !== 'undefined' && document.documentElement) {
    const html = document.documentElement;

    if (transicao && !html.classList.contains('tema-transicao')) {
      html.classList.add('tema-transicao');
      setTimeout(() => {
        html.classList.remove('tema-transicao');
      }, 250);
    }

    html.setAttribute('data-tema', temaFinal);
  }

  if (salvar && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEYS.TEMA, temaFinal);
    } catch (_) {}
  }

  atualizarBotaoTema(temaFinal);
}

/**
 * Alterna entre modo claro e escuro a partir de interação do usuário.
 * @param {{ aoMudarTema?: (novoTema: string) => void }} [opcoes]
 */
export function alternarTema({ aoMudarTema } = {}) {
  const atual = obterTemaAtual();
  const novoTema = atual === TEMAS.ESCURO ? TEMAS.CLARO : TEMAS.ESCURO;
  aplicarTema(novoTema, { salvar: true, transicao: true });
  if (typeof aoMudarTema === 'function') {
    aoMudarTema(novoTema);
  }
}

/**
 * Inicializa os ouvintes de tema, botão de cabeçalho, matchMedia e sincronização storage.
 * @param {{ aoMudarTema?: (novoTema: string) => void }} [opcoes]
 */
export function initTema({ aoMudarTema } = {}) {
  if (typeof window === 'undefined') return;

  let salvo = null;
  try {
    salvo = localStorage.getItem(STORAGE_KEYS.TEMA);
  } catch (_) {}

  const prefereEscuro = obterPreferenciaSistemaEscuro();
  const temaInicial = resolverTema(salvo, prefereEscuro);
  aplicarTema(temaInicial, { salvar: false, transicao: false });

  const btn = document.getElementById('btnAlternarTema');
  if (btn) {
    btn.addEventListener('click', () => {
      alternarTema({ aoMudarTema });
    });
  }

  if (typeof window.matchMedia === 'function') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e) => {
      let escolhaSalva = null;
      try {
        escolhaSalva = localStorage.getItem(STORAGE_KEYS.TEMA);
      } catch (_) {}
      if (!escolhaSalva) {
        const temaSistema = e.matches ? TEMAS.ESCURO : TEMAS.CLARO;
        aplicarTema(temaSistema, { salvar: false, transicao: true });
        if (typeof aoMudarTema === 'function') {
          aoMudarTema(temaSistema);
        }
      }
    };
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleSystemChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleSystemChange);
    }
  }

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEYS.TEMA) {
      const novoTema = resolverTema(event.newValue, obterPreferenciaSistemaEscuro());
      aplicarTema(novoTema, { salvar: false, transicao: true });
      if (typeof aoMudarTema === 'function') {
        aoMudarTema(novoTema);
      }
    }
  });
}
