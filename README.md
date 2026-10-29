# 🏍️ MotoRanking — Sistema de Ranking, BI e Gestão de Vendas de Motos (Etapa 2 + BI)

Sistema web front-end em HTML5, CSS3 e JavaScript (ES Modules) para acompanhamento de ranking geral de vendas, análise visual de Business Intelligence (BI), matriz analítica cruzada, painel individual por consultor e cadastro autenticado de vendas em uma concessionária de motocicletas.

Toda a aplicação está consolidada em uma única página (`index.html`) organizada por abas acessíveis (`#ranking`, `#painel`, `#nova-venda`), com autenticação demonstrativa via hash SHA-256, sessão e bloqueio de tentativas compartilhados entre abas via `localStorage` e gráficos interativos com **Chart.js 4.4.1**.

---

## 📦 Dependência Externa (CDN)

- **Chart.js 4.4.1 (`chart.umd.js`, já minificado)**: carregado via CDN (`https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js`) no `index.html` antes dos módulos da aplicação.
- **Tolerância a Falhas Offline**: todo o acesso ao `window.Chart` é isolado no módulo `/js/charts.js`. Caso o navegador esteja sem internet ou o CDN esteja bloqueado, cada área de gráfico exibe a mensagem amigável *"Não foi possível carregar os gráficos. Verifique sua conexão."* e o restante do sistema (KPIs, tabelas, filtros, login, cadastro e exclusão) continua funcionando normalmente.

---

## 📊 Módulo de BI · Análise Visual

### 1. BI na Aba "Ranking geral" (`#ranking`)
Localizado logo abaixo dos KPIs gerais e alimentado exatamente pelo mesmo recorte filtrado (`filtrarVendas`):
- **Tipos de Gráfico**:
  - `Colunas` | `Barras horizontais` | `Pizza` | `Rosca`: agrupados pela dimensão escolhida (*Consultor*, *Modelo* ou *Ano modelo*). Em Pizza/Rosca, se houver mais de 6 fatias, as menores são agrupadas automaticamente em **"Outros"**.
  - `Colunas empilhadas`: eixo X com os consultores e pilhas por *Modelo* ou *Ano modelo* (se *Consultor* estiver selecionado, o sistema alterna para *Modelo* e exibe a dica *"Empilhado por modelo"*).
  - `Linha (evolução)`: exibe a linha **Total** + até 5 itens com mais vendas na dimensão escolhida (e o excedente somado em **"Outros"**), respeitando a escala do período (*Dia*: `00h–23h`, *Semana*: `Seg–Dom`, *Mês*: `1..último dia`).
  - `Dispersão (horário das vendas)`: cada ponto representa uma venda (`x` = dia, `y` = hora decimal), colorido pela dimensão escolhida e com tooltip detalhando data/hora, consultor, modelo e placa.
- **Sincronização com a URL**: escolhas refletidas nos parâmetros `?grafico=<tipo>&dim=<dimensao>` junto aos filtros (`?periodo=...&modelo=...&ano=...`), validadas na leitura.
- **Exportação PNG**: botão **"Baixar PNG"** (`chart.toBase64Image()`) gerando arquivo `motoranking-<tipo>-<data>.png`.
- **Acessibilidade**: `<canvas role="img">` com `aria-label` dinâmico resumindo os dados e seção `<details>` *"Ver dados em tabela"* logo abaixo de cada gráfico.

### 2. Gráfico no "Painel do consultor" (`#painel`)
- Card **"Gráfico do consultor"** disponível tanto para visitantes quanto para o consultor logado.
- Controles **"Ver por"** (*Modelo* | *Ano modelo*) e **"Tipo"** (*Colunas* | *Pizza* | *Rosca* | *Linha — evolução no período*), sincronizados com o consultor e período selecionados, com botão **"Baixar PNG"** e tabela acessível em `<details>`.

---

## 🚀 Como Executar o Projeto

Por utilizar **ES Modules** (`import` / `export`) e a **Web Crypto API** (`crypto.subtle.digest`), sirva a pasta via HTTP local:

```bash
npx serve . -l 3000
# ou
python -m http.server 8000
```

---

## 📁 Estrutura de Arquivos

```text
/
├── index.html          # Aplicação unificada (Abas: Ranking geral, Painel do consultor e Nova venda + CDN Chart.js)
├── css/
│   └── style.css       # Design system, BI, matriz com coluna Consultor sticky, details recolhíveis e responsividade (360px+)
├── js/
│   ├── catalog.js      # Catálogo oficial de modelos/anos e paleta de cores consistente (CORES_MODELO, CORES_ANO)
│   ├── storage.js      # Persistência isolada (localStorage), seed, migração v2, sessão 8h e bloqueio de login entre abas
│   ├── utils.js        # Funções puras de validação, datas, filtros, ranking, matriz e séries de dados do BI
│   ├── charts.js       # Módulo exclusivo de gráficos (Chart.js), destroy(), fallback offline, PNG e tabela acessível
│   ├── ui.js           # Utilitários de interface (showToast, controles segmentados, abas e details responsivos)
│   ├── auth.js         # Fluxo de login/logout, modal de autenticação e contagem regressiva de bloqueio
│   ├── ranking.js      # Aba Ranking Geral (filtros e BI na URL, KPIs, gráfico BI, competição, matriz e vendas gerais)
│   └── app.js          # Orquestrador geral da aplicação, Painel do Consultor, Nova Venda e sincronização storage
└── README.md           # Documentação do projeto
```

---

## 🔐 Credenciais de Demonstração e Segurança

| Campo | Valor | Observação |
| :--- | :--- | :--- |
| **Usuário** | `JoaoVitor` | Case-insensitive |
| **Nome de Exibição** | `João Vitor` | Vinculado automaticamente ao consultor homônimo |
| **Senha** | `123456` | Case-sensitive (armazenada como hash SHA-256 hex) |

- **Sessão e Bloqueio Compartilhados (`localStorage`)**: a sessão (`ranking_motos_sessao`, expira em 8h) e o contador de tentativas (`ranking_motos_login_tentativas`, 5 erros -> bloqueio de 60s) ficam no `localStorage`. Fazer login ou logout em uma aba atualiza instantaneamente o cabeçalho, abas e permissões nas outras abas abertas (retornando de `#nova-venda` para `#ranking` ao deslogar).
- **Aviso Arquitetural**: este login é demonstrativo (front-end sem servidor, contornável via DevTools). Em produção real, autenticação, hash de senha (Argon2/bcrypt), rate-limiting e autorização devem ocorrer no backend.
