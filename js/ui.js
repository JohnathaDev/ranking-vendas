/**
 * Utilitários compartilhados de Interface do Usuário (UI):
 * - Notificações Toast seguras contra XSS (showToast)
 * - Controles segmentados de período/dimensão com aria-pressed
 * - Gerenciamento de abas acessíveis (role="tablist" / "tab" / "tabpanel") e sincronização de hash na URL
 * - Helpers de erro inline em campos de formulário
 */

export const ABAS_VALIDAS = ['ranking', 'painel', 'nova-venda'];
export const ABA_PADRAO = 'ranking';

/**
 * Exibe uma notificação temporária (toast) construída com DOM seguro (sem innerHTML).
 * @param {string} mensagem Texto da mensagem a ser exibida
 * @param {'success' | 'error' | 'info'} [tipo='success'] Tipo visual do toast
 * @param {number} [duracaoMs=3500] Tempo em milissegundos antes de ocultar
 */
export function showToast(mensagem, tipo = 'success', duracaoMs = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${tipo === 'error' ? 'toast-error' : ''}`;
  toast.setAttribute('role', 'status');

  const iconeSpan = document.createElement('span');
  iconeSpan.setAttribute('aria-hidden', 'true');
  iconeSpan.textContent = tipo === 'error' ? '⚠️' : tipo === 'info' ? 'ℹ️' : '✅';

  const textoSpan = document.createElement('span');
  textoSpan.textContent = String(mensagem ?? '');

  toast.appendChild(iconeSpan);
  toast.appendChild(textoSpan);

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    setTimeout(() => toast.remove(), 300);
  }, duracaoMs);
}

/**
 * Exibe mensagem de erro inline abaixo de um campo e marca aria-invalid="true".
 * @param {HTMLElement|null} inputEl
 * @param {HTMLElement|null} erroEl
 * @param {string} mensagem
 */
export function exibirErroCampo(inputEl, erroEl, mensagem) {
  if (inputEl) {
    inputEl.classList.add('is-invalid');
    inputEl.setAttribute('aria-invalid', 'true');
  }
  if (erroEl) {
    erroEl.textContent = String(mensagem ?? '');
  }
}

/**
 * Limpa o estado de erro inline de um campo de formulário.
 * @param {HTMLElement|null} inputEl
 * @param {HTMLElement|null} erroEl
 */
export function limparErroCampo(inputEl, erroEl) {
  if (inputEl) {
    inputEl.classList.remove('is-invalid');
    inputEl.removeAttribute('aria-invalid');
  }
  if (erroEl) {
    erroEl.textContent = '';
  }
}

/**
 * Atualiza visualmente e com aria-pressed um grupo de botões segmentados (ex: Dia / Semana / Mês).
 * @param {NodeListOf<HTMLElement>|Array<HTMLElement>} botoes Lista de botões
 * @param {string} valorAtivo Valor ativo correspondente ao dataset
 * @param {string} [dataKey='period'] Nome da propriedade no dataset (ex: 'period' ou 'dimensao')
 */
export function atualizarBotoesSegmentados(botoes, valorAtivo, dataKey = 'period') {
  if (!botoes) return;
  Array.from(botoes).forEach((btn) => {
    const isAtivo = btn.dataset[dataKey] === valorAtivo;
    btn.classList.toggle('active', isAtivo);
    btn.setAttribute('aria-pressed', isAtivo ? 'true' : 'false');
  });
}

/**
 * Associa ouvintes de clique a um controle segmentado, gerenciando aria-pressed automaticamente.
 * @param {NodeListOf<HTMLElement>|Array<HTMLElement>} botoes
 * @param {function(string): void} onSelect Callback chamado com o novo valor selecionado
 * @param {string} [dataKey='period']
 */
export function configurarControleSegmentado(botoes, onSelect, dataKey = 'period') {
  if (!botoes) return;
  Array.from(botoes).forEach((btn) => {
    btn.addEventListener('click', () => {
      const valor = btn.dataset[dataKey];
      if (!valor) return;
      atualizarBotoesSegmentados(botoes, valor, dataKey);
      if (typeof onSelect === 'function') {
        onSelect(valor);
      }
    });
  });
}

/**
 * Extrai o identificador da aba a partir do location.hash atual.
 * Valores desconhecidos retornam sempre ABA_PADRAO ('ranking').
 * @param {string} [hashStr=window.location.hash]
 * @returns {'ranking' | 'painel' | 'nova-venda'}
 */
export function obterAbaDaURL(hashStr = window.location.hash) {
  if (!hashStr || typeof hashStr !== 'string') return ABA_PADRAO;
  const limpo = hashStr.replace(/^#/, '').trim().toLowerCase();
  if (ABAS_VALIDAS.includes(limpo)) {
    return limpo;
  }
  return ABA_PADRAO;
}

/**
 * Atualiza o estado das abas (role="tab" / role="tabpanel" e aria-selected) e reflete na URL.
 * @param {string} abaDestino 'ranking' | 'painel' | 'nova-venda'
 * @param {Object} [opcoes={}]
 * @param {boolean} [opcoes.atualizarHash=true] Se deve atualizar o hash na URL
 * @param {boolean} [opcoes.focarAba=false] Se deve mover o foco para o botão da aba ativa
 * @returns {'ranking' | 'painel' | 'nova-venda'} Aba efetivamente ativada
 */
export function ativarAbaUI(abaDestino, opcoes = {}) {
  const { atualizarHash = true, focarAba = false } = opcoes;
  const abaFinal = ABAS_VALIDAS.includes(abaDestino) ? abaDestino : ABA_PADRAO;

  const botoesAba = document.querySelectorAll('[role="tab"][data-tab]');
  const paineisAba = document.querySelectorAll('[role="tabpanel"][data-tabpanel]');

  botoesAba.forEach((btn) => {
    const isSelecionada = btn.dataset.tab === abaFinal;
    btn.classList.toggle('active', isSelecionada);
    btn.setAttribute('aria-selected', isSelecionada ? 'true' : 'false');
    btn.setAttribute('tabindex', isSelecionada ? '0' : '-1');
    if (isSelecionada && focarAba && !btn.classList.contains('hidden')) {
      btn.focus();
    }
  });

  paineisAba.forEach((painel) => {
    const isPainelAtivo = painel.dataset.tabpanel === abaFinal;
    painel.classList.toggle('hidden', !isPainelAtivo);
  });

  if (atualizarHash) {
    const hashNovo = `#${abaFinal}`;
    if (window.location.hash !== hashNovo) {
      const novaUrl = `${window.location.pathname}${window.location.search}${hashNovo}`;
      window.history.replaceState(null, '', novaUrl);
    }
  }

  return abaFinal;
}

/**
 * Configura eventos de clique e navegação por teclado (Setas, Home, End) nas abas do cabeçalho.
 * @param {function(string): void} onTabSelect Callback disparado quando uma aba é selecionada
 */
export function inicializarNavegacaoAbas(onTabSelect) {
  const botoesAba = Array.from(document.querySelectorAll('[role="tab"][data-tab]'));

  botoesAba.forEach((btn) => {
    btn.addEventListener('click', () => {
      const aba = btn.dataset.tab;
      if (aba && typeof onTabSelect === 'function') {
        onTabSelect(aba, { atualizarHash: true, focarAba: false });
      }
    });

    btn.addEventListener('keydown', (e) => {
      const abasVisiveis = botoesAba.filter((b) => !b.classList.contains('hidden'));
      const idxAtual = abasVisiveis.indexOf(btn);
      if (idxAtual === -1) return;

      let novoIdx = -1;
      if (e.key === 'ArrowRight') {
        novoIdx = (idxAtual + 1) % abasVisiveis.length;
      } else if (e.key === 'ArrowLeft') {
        novoIdx = (idxAtual - 1 + abasVisiveis.length) % abasVisiveis.length;
      } else if (e.key === 'Home') {
        novoIdx = 0;
      } else if (e.key === 'End') {
        novoIdx = abasVisiveis.length - 1;
      }

      if (novoIdx !== -1) {
        e.preventDefault();
        const abaAlvo = abasVisiveis[novoIdx].dataset.tab;
        if (abaAlvo && typeof onTabSelect === 'function') {
          onTabSelect(abaAlvo, { atualizarHash: true, focarAba: true });
        }
      }
    });
  });
}
