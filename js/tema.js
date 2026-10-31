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
  return prefereEscuro ? TEMAS.ESCURO : TEMAS.CLARO;
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
 * Retorna uma Promise resolvida após a mutação do DOM ter sido efetivamente aplicada.
 * @param {'claro'|'escuro'} tema
 * @param {{ salvar?: boolean, transicao?: boolean }} [opcoes]
 * @returns {Promise<'claro'|'escuro'>}
 */
export function aplicarTema(tema, { salvar = false, transicao = true } = {}) {
  const temaFinal = tema === TEMAS.ESCURO ? TEMAS.ESCURO : TEMAS.CLARO;

  const aplicarMutacao = () => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-tema', temaFinal);
    }
    if (salvar && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEYS.TEMA, temaFinal);
      } catch {
        /* Ignora indisponibilidade ou restrição de gravação no localStorage */
      }
    }
    atualizarBotaoTema(temaFinal);
  };

  const prefereReduzido =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Crossfade suave nativo via View Transitions API (~300ms) quando disponível e permitido
  if (
    transicao &&
    !prefereReduzido &&
    typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function'
  ) {
    try {
      const transition = document.startViewTransition(() => {
        aplicarMutacao();
      });
      if (transition && typeof transition.updateCallbackDone?.then === 'function') {
        return transition.updateCallbackDone.then(() => temaFinal);
      }
      if (transition && typeof transition.finished?.then === 'function') {
        return transition.finished.then(() => temaFinal);
      }
    } catch {
      /* Segue para caminho síncrono */
    }
  }

  // Fallback suave via classe tema-transicao
  if (
    transicao &&
    !prefereReduzido &&
    typeof document !== 'undefined' &&
    document.documentElement &&
    !document.documentElement.classList.contains('tema-transicao')
  ) {
    document.documentElement.classList.add('tema-transicao');
    setTimeout(() => {
      document.documentElement.classList.remove('tema-transicao');
    }, 250);
  }

  aplicarMutacao();
  return Promise.resolve(temaFinal);
}

/**
 * Alterna entre modo claro e escuro a partir de interação do usuário.
 * Aguarda a mutação do DOM antes de invocar aoMudarTema, prevenindo condição de corrida na leitura de cores.
 * @param {{ aoMudarTema?: (novoTema: string) => void }} [opcoes]
 * @returns {Promise<'claro'|'escuro'>}
 */
export function alternarTema({ aoMudarTema } = {}) {
  const atual = obterTemaAtual();
  const novoTema = atual === TEMAS.ESCURO ? TEMAS.CLARO : TEMAS.ESCURO;
  return aplicarTema(novoTema, { salvar: true, transicao: true }).then((temaAplicado) => {
    if (typeof aoMudarTema === 'function') {
      aoMudarTema(temaAplicado);
    }
    return temaAplicado;
  });
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
  } catch {
    /* Ignora indisponibilidade ou restrição de leitura no localStorage */
  }

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
      } catch {
        /* Ignora indisponibilidade de leitura do localStorage */
      }
      const escolhaValida = escolhaSalva === TEMAS.CLARO || escolhaSalva === TEMAS.ESCURO;
      if (!escolhaValida) {
        const temaSistema = resolverTema(null, e.matches);
        aplicarTema(temaSistema, { salvar: false, transicao: true }).then((temaAplicado) => {
          if (typeof aoMudarTema === 'function') {
            aoMudarTema(temaAplicado);
          }
        });
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
      aplicarTema(novoTema, { salvar: false, transicao: true }).then((temaAplicado) => {
        if (typeof aoMudarTema === 'function') {
          aoMudarTema(temaAplicado);
        }
      });
    }
  });
}
