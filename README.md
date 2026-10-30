# Ranking de Vendas

Sistema web para registrar e acompanhar vendas de motos por consultor, com ranking geral, painel individual e gráficos.

**Demonstração:** https://johnathadev.github.io/ranking-vendas/
Usuário `JoaoVitor` · senha `123456`

## Funcionalidades

- **Ranking geral:** classificação dos consultores com filtros por período (dia, semana e mês), modelo e ano modelo.
- **BI:** gráficos de colunas, barras, pizza, rosca, colunas empilhadas, linha e dispersão, que acompanham os filtros e podem ser baixados em PNG.
- **Matriz de vendas:** consultor × modelo ou ano modelo, com totais.
- **Painel do consultor:** vendas, indicadores e gráfico por modelo ou ano de cada consultor.
- **Cadastro de vendas:** placa, contrato, modelo, ano modelo e data, disponível apenas com login.
- **Login demonstrativo:** quem não está logado pode só consultar; cada consultor exclui apenas as próprias vendas.

## Tecnologias

- HTML5, CSS3 e JavaScript (ES Modules)
- [Chart.js 4.4.1](https://www.chartjs.org/) (via CDN)
- localStorage para guardar os dados no navegador
- GitHub Pages para a hospedagem

## Estrutura

```text
├── index.html        # Página única com as abas Ranking geral, Painel e Nova venda
├── css/
│   └── style.css     # Estilos e responsividade
└── js/
    ├── app.js        # Inicialização, painel do consultor e cadastro de vendas
    ├── auth.js       # Login e logout
    ├── catalog.js    # Modelos, anos e cores dos gráficos
    ├── charts.js     # Gráficos (Chart.js)
    ├── ranking.js    # Aba Ranking geral
    ├── storage.js    # Dados, sessão e regras de permissão
    ├── ui.js         # Componentes de interface
    └── utils.js      # Validações, filtros e cálculos
```

> O login é apenas demonstrativo: sem servidor, os dados ficam no navegador de cada visitante.
