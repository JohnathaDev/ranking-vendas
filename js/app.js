/**
 * Orquestrador principal da aplicação MotoRanking (app.js):
 * Coordena inicialização de dados/migração, autenticação compartilhada (auth.js),
 * aba Ranking Geral com BI (ranking.js), aba Painel do Consultor (painel.js),
 * aba Nova Venda (formVenda.js), modais (modais.js), sessão (sessao.js) e sincronização entre abas.
 */

import {
  STORAGE_KEYS,
  inicializarSeedSeNecessario,
  setConsultorAtivoId,
  getSessaoAtiva,
  limparSessaoInvalida
} from './storage.js';
import {
  showToast,
  obterAbaDaURL,
  ativarAbaUI,
  inicializarNavegacaoAbas,
  sincronizarSecoesRecolhiveis
} from './ui.js';
import {
  initAuth,
  atualizarUIEstadoAutenticacao,
  fecharModalLogin,
  verificarEIniciarContagemBloqueio
} from './auth.js';
import { initRanking, renderRankingGeral, sincronizarRankingComURL } from './ranking.js';
import { appState } from './state.js';
import {
  initMonitorSessao,
  agendarVerificacaoExpiracaoSessao,
  limparTimerExpiracaoSessao
} from './sessao.js';
import { initFormVenda, recalcularLimitesDataVenda, resetarFormularioVenda } from './formVenda.js';
import { initModais, abrirModalExclusao } from './modais.js';
import { initPainel, carregarListaConsultores, atualizarPainelConsultor } from './painel.js';

function handleSessaoExpiradaUI() {
  limparTimerExpiracaoSessao();
  limparSessaoInvalida();
  atualizarUIEstadoAutenticacao();
  resetarFormularioVenda();
  carregarListaConsultores(appState.consultorAtivoId);

  if (appState.abaAtiva === 'nova-venda' || window.location.hash === '#nova-venda') {
    selecionarAba('ranking', { atualizarHash: true });
  }

  renderRankingGeral();
  atualizarPainelConsultor();
  showToast('Sua sessão expirou. Faça login novamente.', 'info');
}

function initApp() {
  inicializarSeedSeNecessario();
  limparSessaoInvalida();
  initMonitorSessao({ onSessaoExpirada: handleSessaoExpiradaUI });
  initFormVenda({
    onVendaSalva: () => {
      renderRankingGeral();
      atualizarPainelConsultor();
    }
  });
  initModais({
    onVendaExcluida: () => {
      renderRankingGeral();
      atualizarPainelConsultor();
    },
    onDemoResetada: (sessaoNova) => {
      agendarVerificacaoExpiracaoSessao();
      carregarListaConsultores(sessaoNova ? sessaoNova.consultorId : null);
      resetarFormularioVenda();
      renderRankingGeral();
      atualizarPainelConsultor();
    }
  });
  initPainel({
    onSolicitarExclusao: (venda) => abrirModalExclusao(venda)
  });

  // Item 1.3: Seções Matriz, Vendas gerais e BI abertas no desktop e fechadas no celular
  sincronizarSecoesRecolhiveis('.collapsible-section');

  initAuth({
    onLoginSuccess: (usuarioLogado) => {
      agendarVerificacaoExpiracaoSessao();
      appState.consultorAtivoId = usuarioLogado.consultorId;
      setConsultorAtivoId(usuarioLogado.consultorId);
      carregarListaConsultores(usuarioLogado.consultorId);

      renderRankingGeral();
      atualizarPainelConsultor();
      selecionarAba('nova-venda', { atualizarHash: true });
    },
    onLogoutSuccess: () => {
      limparTimerExpiracaoSessao();
      resetarFormularioVenda();
      atualizarUIEstadoAutenticacao();
      renderRankingGeral();
      atualizarPainelConsultor();
      selecionarAba('ranking', { atualizarHash: true });
    }
  });

  const sessaoInicial = getSessaoAtiva();
  agendarVerificacaoExpiracaoSessao();
  carregarListaConsultores(sessaoInicial ? sessaoInicial.consultorId : null);

  initRanking();
  setupEventListeners();

  const abaInicial = obterAbaDaURL(window.location.hash);
  selecionarAba(abaInicial, { atualizarHash: Boolean(window.location.hash) });

  atualizarPainelConsultor();
}

function selecionarAba(abaId, opcoes = {}) {
  atualizarUIEstadoAutenticacao();
  appState.abaAtiva = ativarAbaUI(abaId, opcoes);

  if (appState.abaAtiva === 'ranking') {
    renderRankingGeral();
  } else if (appState.abaAtiva === 'painel') {
    atualizarPainelConsultor();
  } else if (appState.abaAtiva === 'nova-venda') {
    recalcularLimitesDataVenda();
  }
}

function setupEventListeners() {
  inicializarNavegacaoAbas((abaEscolhida, opcoes) => {
    selecionarAba(abaEscolhida, opcoes);
  });

  window.addEventListener('hashchange', () => {
    const abaHash = obterAbaDaURL(window.location.hash);
    selecionarAba(abaHash, { atualizarHash: false });
  });

  window.addEventListener('popstate', () => {
    const abaHash = obterAbaDaURL(window.location.hash);
    selecionarAba(abaHash, { atualizarHash: false });
    sincronizarRankingComURL();
  });

  // Atualiza <details> e gráficos ao cruzar o breakpoint 600px (Item 1.3 e 2.5)
  window.addEventListener('resize', () => {
    const agoraCelular = window.innerWidth <= 600;
    if (agoraCelular !== appState.eraCelular600) {
      appState.eraCelular600 = agoraCelular;
      sincronizarSecoesRecolhiveis('.collapsible-section');
      renderRankingGeral();
      atualizarPainelConsultor();
    }
  });

  // Sincronização entre abas (Itens 1.1, 1.2, 2.3 e F)
  window.addEventListener('storage', (event) => {
    // Item 1.1: Bloqueio de tentativas de login sincronizado entre abas
    if (event.key === STORAGE_KEYS.TENTATIVAS_LOGIN) {
      verificarEIniciarContagemBloqueio();
      return;
    }

    // Item 1.2: Sessão compartilhada entre abas (login/logout em uma aba reflete nas outras)
    if (event.key === STORAGE_KEYS.SESSAO) {
      const sessaoAtual = getSessaoAtiva();
      agendarVerificacaoExpiracaoSessao();
      atualizarUIEstadoAutenticacao();

      if (sessaoAtual) {
        fecharModalLogin();
        appState.consultorAtivoId = sessaoAtual.consultorId;
        carregarListaConsultores(sessaoAtual.consultorId);
      } else {
        resetarFormularioVenda();
        carregarListaConsultores(appState.consultorAtivoId);
        // Se estava em #nova-venda e a sessão acabou, voltar para #ranking
        if (appState.abaAtiva === 'nova-venda' || window.location.hash === '#nova-venda') {
          selecionarAba('ranking', { atualizarHash: true });
        }
      }

      renderRankingGeral();
      atualizarPainelConsultor();
      return;
    }

    if (
      !event.key ||
      event.key === STORAGE_KEYS.VENDAS ||
      event.key === STORAGE_KEYS.CONSULTORES ||
      event.key === STORAGE_KEYS.USUARIOS ||
      event.key === STORAGE_KEYS.SCHEMA
    ) {
      atualizarUIEstadoAutenticacao();
      carregarListaConsultores(appState.consultorAtivoId);
      renderRankingGeral();
      atualizarPainelConsultor();
    }
  });
}

document.addEventListener('DOMContentLoaded', initApp);
