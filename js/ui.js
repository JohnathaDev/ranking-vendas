/**
 * Utilitários compartilhados de Interface do Usuário (UI):
 * - Notificações Toast seguras contra XSS (showToast)
 * - Controles segmentados de período/dimensão com aria-pressed
 * - Gerenciamento de abas acessíveis (role="tablist" / "tab" / "tabpanel") e sincronização de hash na URL
 * - Helpers de erro inline em campos de formulário
 * - Sincronização de seções recolhíveis (<details>/<summary>) entre desktop e celular (Item 1.3)
 */

export const ABAS_VALIDAS = ['ranking', 'painel', 'nova-venda'];
export const ABA_PADRAO = 'ranking';

export function showToast(mensagem, tipo = 'success', duracaoMs = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${tipo === 'error' ? 'toast-error' : ''}`;
  toast.setAttribute('role', 'status');

  const iconeSpan = document.createElement('span');
  iconeSpan.setAttribute('aria-hidden', 'true');
  iconeSpan.textContent = '';

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

export function exibirErroCampo(inputEl, erroEl, mensagem) {
  if (inputEl) {
    inputEl.classList.add('is-invalid');
    inputEl.setAttribute('aria-invalid', 'true');
  }
  if (erroEl) {
    erroEl.textContent = String(mensagem ?? '');
  }
}

export function limparErroCampo(inputEl, erroEl) {
  if (inputEl) {
    inputEl.classList.remove('is-invalid');
    inputEl.removeAttribute('aria-invalid');
  }
  if (erroEl) {
    erroEl.textContent = '';
  }
}

export function atualizarBotoesSegmentados(botoes, valorAtivo, dataKey = 'period') {
  if (!botoes) return;
  Array.from(botoes).forEach((btn) => {
    const isAtivo = btn.dataset[dataKey] === valorAtivo;
    btn.classList.toggle('active', isAtivo);
    btn.setAttribute('aria-pressed', isAtivo ? 'true' : 'false');
  });
}

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

export function obterAbaDaURL(hashStr = window.location.hash) {
  if (!hashStr || typeof hashStr !== 'string') return ABA_PADRAO;
  const limpo = hashStr.replace(/^#/, '').trim().toLowerCase();
  if (ABAS_VALIDAS.includes(limpo)) {
    return limpo;
  }
  return ABA_PADRAO;
}

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

/**
 * Define o estado inicial de elementos <details> recolhíveis da aba Ranking Geral (Item 1.3):
 * Abertos por padrão no desktop (> 600px) e fechados por padrão no celular (<= 600px).
 * @param {string} [seletor='.collapsible-section']
 */
export function sincronizarSecoesRecolhiveis(seletor = '.collapsible-section') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const isCelular = window.innerWidth <= 600;
  const secoes = document.querySelectorAll(seletor);
  secoes.forEach((detailsEl) => {
    detailsEl.open = !isCelular;
  });
}
