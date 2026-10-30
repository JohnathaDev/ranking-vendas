/**
 * Estado reativo da aplicação e referências de elementos do DOM (state.js).
 * Módulo folha compartilhado entre os submódulos da aplicação.
 */

export const appState = {
  abaAtiva: 'ranking',
  consultorAtivoId: null,
  periodoPainel: 'mes',
  tipoGraficoPainel: 'colunas', // 'colunas' | 'pizza' | 'linha' (Item 2.4)
  dimensaoGraficoPainel: 'modelo', // 'modelo' | 'anoModelo' (Item 2.4)
  sortModeloOrdem: 'desc',
  sortAnoOrdem: 'desc',
  vendaParaExcluir: null,
  eraCelular600: typeof window !== 'undefined' ? window.innerWidth <= 600 : false
};

export const DOM = {
  selectConsultor: document.getElementById('selectConsultor'),
  labelNomeConsultor: document.getElementById('labelNomeConsultor'),
  badgeModoPainel: document.getElementById('badgeModoPainel'),

  formCadastroVenda: document.getElementById('formCadastroVenda'),
  inputDataVenda: document.getElementById('inputDataVenda'),
  inputPlaca: document.getElementById('inputPlaca'),
  inputContrato: document.getElementById('inputContrato'),
  selectModelo: document.getElementById('selectModelo'),
  selectAnoModelo: document.getElementById('selectAnoModelo'),

  erroDataVenda: document.getElementById('erroDataVenda'),
  erroPlaca: document.getElementById('erroPlaca'),
  erroContrato: document.getElementById('erroContrato'),
  erroModelo: document.getElementById('erroModelo'),
  erroAnoModelo: document.getElementById('erroAnoModelo'),

  botoesPeriodoPainel: document.querySelectorAll('.btn-painel-period'),

  kpiTotalVendas: document.getElementById('kpiTotalVendas'),
  kpiPeriodoTexto: document.getElementById('kpiPeriodoTexto'),
  kpiModeloMaisVendido: document.getElementById('kpiModeloMaisVendido'),
  kpiModeloDetalhe: document.getElementById('kpiModeloDetalhe'),
  kpiAnoMaisVendido: document.getElementById('kpiAnoMaisVendido'),
  kpiAnoDetalhe: document.getElementById('kpiAnoDetalhe'),

  // Controles do Gráfico do Consultor (Item 2.4)
  selectPainelGraficoDimensao: document.getElementById('selectPainelGraficoDimensao'),
  selectPainelGraficoTipo: document.getElementById('selectPainelGraficoTipo'),
  helperPainelGraficoDimensao: document.getElementById('helperPainelGraficoDimensao'),
  btnBaixarPNGPainel: document.getElementById('btnBaixarPNGPainel'),
  canvasGraficoPainel: document.getElementById('canvasGraficoPainel'),
  containerCanvasPainel: document.getElementById('containerCanvasPainel'),
  emptyStateGraficoPainel: document.getElementById('emptyStateGraficoPainel'),
  erroCDNGraficoPainel: document.getElementById('erroCDNGraficoPainel'),
  detailsTabelaDadosPainel: document.getElementById('detailsTabelaDadosPainel'),
  theadTabelaDadosPainel: document.getElementById('theadTabelaDadosPainel'),
  tbodyTabelaDadosPainel: document.getElementById('tbodyTabelaDadosPainel'),

  tbodyVendasPorModelo: document.getElementById('tbodyVendasPorModelo'),
  tbodyVendasPorAno: document.getElementById('tbodyVendasPorAno'),
  thSortModelo: document.getElementById('thSortModelo'),
  thSortAno: document.getElementById('thSortAno'),
  btnSortModeloQtd: document.getElementById('btnSortModeloQtd'),
  btnSortAnoQtd: document.getElementById('btnSortAnoQtd'),
  sortIconModelo: document.getElementById('sortIconModelo'),
  sortIconAno: document.getElementById('sortIconAno'),

  tabelaListaVendas: document.getElementById('tabelaListaVendas'),
  thColunaAcoesPainel: document.getElementById('thColunaAcoesPainel'),
  tbodyListaVendas: document.getElementById('tbodyListaVendas'),
  emptyStateVendas: document.getElementById('emptyStateVendas'),
  emptyStateTextoPainel: document.getElementById('emptyStateTextoPainel'),

  modalConfirmarExclusao: document.getElementById('modalConfirmarExclusao'),
  formConfirmarExclusao: document.getElementById('formConfirmarExclusao'),
  excluirPlacaModal: document.getElementById('excluirPlacaModal'),
  excluirContratoModal: document.getElementById('excluirContratoModal'),
  btnCancelarExclusao: document.getElementById('btnCancelarExclusao'),
  btnConfirmarExclusaoFinal: document.getElementById('btnConfirmarExclusaoFinal'),

  btnRestaurarDemo: document.getElementById('btnRestaurarDemo'),
  modalConfirmarReset: document.getElementById('modalConfirmarReset'),
  formConfirmarReset: document.getElementById('formConfirmarReset'),
  btnCancelarReset: document.getElementById('btnCancelarReset')
};
