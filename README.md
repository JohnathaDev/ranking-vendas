# Ranking de Vendas

[![CI](https://github.com/johnathadev/ranking-vendas/actions/workflows/ci.yml/badge.svg)](https://github.com/johnathadev/ranking-vendas/actions/workflows/ci.yml)

Sistema web para registrar e acompanhar vendas de motos por consultor, com ranking geral, painel individual e gráficos.

**Demonstração:** https://johnathadev.github.io/ranking-vendas/
Usuário `JoaoVitor` · senha `123456`

## Funcionalidades

- **Ranking geral:** classificação dos consultores com filtros por período (dia, semana e mês), modelo e ano modelo.
- **BI:** gráficos de colunas, pizza, colunas empilhadas, linha e dispersão, que acompanham os filtros e podem ser baixados em PNG.
- **Matriz de vendas:** consultor × modelo ou ano modelo, com totais.
- **Painel do consultor:** vendas, indicadores e gráfico por modelo ou ano de cada consultor.
- **Cadastro de vendas:** placa, contrato, modelo, ano modelo e data, disponível apenas com login.
- **Login demonstrativo:** quem não está logado pode só consultar; cada consultor exclui apenas as próprias vendas.

## Tecnologias

- HTML5, CSS3, Tailwind CSS v4 e JavaScript (ES Modules)
- [Chart.js 4.4.1](https://www.chartjs.org/) (servido localmente em `vendor/`)
- localStorage para guardar os dados no navegador
- GitHub Pages para a hospedagem

## Estrutura

```text
├── .github/workflows/ci.yml  # Pipeline de CI (lint, format:check e testes)
├── index.html                # Página única com as abas Ranking geral, Painel e Nova venda
├── package.json              # Scripts e dependências de desenvolvimento (ESLint e Prettier)
├── eslint.config.js          # Configuração do ESLint (flat config)
├── .prettierrc.json          # Configuração do Prettier
├── css/
│   ├── tailwind.css          # Estilos-fonte em Tailwind CSS v4 (@theme, @layer components)
│   └── style.css             # CSS compilado e minificado para produção
├── docs/
│   └── CONTEXTO.md           # Documentação de arquitetura, módulos e convenções
├── js/
│   ├── app.js                # Bootstrap, roteamento de abas e eventos globais
│   ├── auth.js               # Login, logout e contagem de bloqueio
│   ├── catalog.js            # Modelos, anos e cores dos gráficos
│   ├── charts.js             # Gráficos (Chart.js) e exportação em PNG
│   ├── formVenda.js          # Formulário e validação da aba Nova venda
│   ├── modais.js             # Modais de exclusão de venda e restauração da demo
│   ├── painel.js             # Aba Painel do consultor (KPIs, gráfico e tabelas)
│   ├── ranking.js            # Aba Ranking geral, matriz e gráficos de BI
│   ├── sessao.js             # Monitoramento proativo de expiração da sessão
│   ├── state.js              # Estado compartilhado (appState) e referências DOM
│   ├── storage.js            # Dados no localStorage, sessão e regras de permissão
│   ├── ui.js                 # Componentes de interface (toast, abas, controles)
│   └── utils.js              # Funções puras de validação, filtros e cálculos
├── tests/
│   ├── helpers/              # Mocks utilitários para ambiente Node (localStorage)
│   ├── storage.test.js       # Testes de autenticação, sessão, vendas, seed e migração
│   └── utils.test.js         # Testes de validação, datas, filtros, ranking e séries BI
└── vendor/
    └── chart.js/             # Cópia local fixada do Chart.js 4.4.1 (UMD) e licença
```

## Desenvolvimento

```bash
npm ci                 # Instala dependências de desenvolvimento
npm run build:css      # Compila e minifica css/tailwind.css para css/style.css
npm run dev:css        # Observa alterações em css/tailwind.css e recompila
npm test               # Executa a suíte de testes (node --test)
npm run lint           # Verifica regras do ESLint
npm run format         # Formata o código com Prettier
npm run format:check   # Checa a formatação sem alterar arquivos
npx serve .            # Inicia um servidor HTTP local (ou: python -m http.server)
```

> O login é apenas demonstrativo: sem servidor, os dados ficam no navegador de cada visitante.
