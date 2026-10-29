# 🏍️ MotoRanking — Sistema de Ranking e Gestão de Vendas de Motos (Etapa 2)

Sistema web front-end puro (HTML5, CSS3 e JavaScript ES Modules sem dependências externas) para acompanhamento de ranking geral de vendas, matriz analítica cruzada, painel individual por consultor e cadastro autenticado de vendas em uma concessionária de motocicletas.

Nesta **Etapa 2**, toda a experiência está consolidada em uma única página (`index.html`) organizada por abas acessíveis (`#ranking`, `#painel`, `#nova-venda`), contando com autenticação demonstrativa via hash SHA-256, migração automática de schema no `localStorage` e sincronização em tempo real entre abas do navegador.

---

## 🚀 Como Executar o Projeto

Por utilizar **Módulos Nativos do JavaScript (ES Modules)** (`import` / `export`) e a **Web Crypto API** (`crypto.subtle.digest`), os arquivos devem ser servidos via protocolo HTTP/HTTPS (`localhost` ou `127.0.0.1`) e não diretamente via `file://`.

### Opção 1: Usando `npx serve` (Node.js)
```bash
npx serve . -l 3000
```
Acesse `http://localhost:3000` no navegador.

### Opção 2: Usando a extensão Live Server (VS Code)
1. Clique com o botão direito sobre `index.html` e selecione **"Open with Live Server"**.
2. Acesse `http://127.0.0.1:5500/index.html`.

### Opção 3: Usando Python 3
```bash
python -m http.server 8000
```
Acesse `http://localhost:8000` no navegador.

---

## 📁 Estrutura de Arquivos

```text
/
├── index.html          # Aplicação unificada (Abas: Ranking geral, Painel do consultor e Nova venda)
├── css/
│   └── style.css       # Design system, medalhas, matriz, modais e responsividade (cards a partir de 360px)
├── js/
│   ├── catalog.js      # Catálogo oficial de modelos de motocicletas e anos válidos
│   ├── storage.js      # Camada isolada de persistência (localStorage/sessionStorage), seed, migração v2 e permissões
│   ├── utils.js        # Funções puras de validação, datas, filtros combinados, ranking de competição e matriz
│   ├── ui.js           # Utilitários de interface (showToast sem XSS, controles segmentados aria-pressed e abas)
│   ├── auth.js         # Fluxo de login/logout, modal de autenticação e bloqueio progressivo por tentativas
│   ├── ranking.js      # Aba Ranking Geral (filtros na URL, KPIs, tabela de competição, matriz e vendas paginadas)
│   └── app.js          # Orquestrador geral da aplicação, Painel do Consultor, Nova Venda e evento storage
└── README.md           # Documentação do projeto, credenciais de demonstração e regras de negócio
```

---

## 🔐 Como Entrar com o Usuário de Demonstração

Ao iniciar a aplicação (ou após a migração automática de dados da Etapa 1), o sistema disponibiliza o consultor e usuário de demonstração:

| Campo | Valor | Observação |
| :--- | :--- | :--- |
| **Usuário** | `JoaoVitor` | Não diferencia maiúsculas/minúsculas (`joaovitor` ou `JOAOVITOR` funcionam) |
| **Nome de Exibição** | `João Vitor` | Vinculado automaticamente ao consultor homônimo |
| **Senha** | `123456` | Diferencia maiúsculas/minúsculas (armazenada apenas como hash SHA-256 hex) |

### Passo a passo para acessar:
1. No cabeçalho superior (ou no card da aba `#nova-venda`), clique no botão **"Entrar"**.
2. Preencha o usuário `JoaoVitor` e a senha `123456` (use o botão **"👁️ Mostrar"** se desejar conferir a senha digitada).
3. Clique em **"Entrar"**.
4. Após o login:
   - O cabeçalho passará a exibir `"Olá, João Vitor"` e o botão **"Sair"**.
   - A aplicação navegará automaticamente para a aba **"Nova venda"** (`#nova-venda`).
   - O rodapé exibirá o botão **"Restaurar dados de demonstração"**.

---

## 🛡️ Regras de Permissão e Segurança de Dados

As regras de autorização são aplicadas tanto na **interface (UI)** quanto diretamente na camada de dados (**`storage.js`**):

1. **Visitante (Deslogado — Modo Somente Visualização):**
   - Pode explorar livremente a aba **Ranking geral** (`#ranking`) e consultar qualquer consultor na aba **Painel do consultor** (`#painel`) através do seletor *"Ver consultor"*.
   - **Não vê** a aba *"Nova venda"* no menu, o formulário de cadastro nem os botões de exclusão.
   - Se acessar `#nova-venda` diretamente pela URL, verá um card de bloqueio (*"Faça login para cadastrar vendas"*) com botão para abrir o modal de login.
2. **Consultor Autenticado (Logado):**
   - Na aba **Painel do consultor**, visualiza por padrão as suas próprias vendas, podendo alternar o seletor *"Ver consultor"* para consultar colegas em modo somente leitura.
   - O botão **"Excluir"** é renderizado exclusivamente nas vendas pertencentes ao próprio usuário logado.
   - No `storage.js`:
     - `addVenda()` exige sessão ativa válida e grava obrigatoriamente `consultorId = usuarioLogado.consultorId` (ignorando qualquer `consultorId` externo).
     - `deleteVenda()` exige sessão ativa válida e lança erro caso a venda pertença a outro consultor.
3. **Proteção contra Força Bruta no Login:**
   - Mensagem genérica única (`"Usuário ou senha inválidos."`) sem revelar qual campo falhou.
   - Após **5 tentativas incorretas seguidas**, o login é bloqueado por **60 segundos** com contagem regressiva em tempo real.
4. **Expiração da Sessão:**
   - A sessão é gravada no `sessionStorage` com validade de **8 horas**. Sessões expiradas ou de usuários inexistentes são descartadas automaticamente por `getSessaoAtiva()`.

---

## ⚠️ Aviso Importante sobre o Login Demonstrativo (Front-end)

> **ATENÇÃO:** O mecanismo de autenticação implementado nesta Etapa 2 é **estritamente demonstrativo e didático**, operando 100% no navegador (sem servidor backend).
>
> Embora a senha nunca seja salva em texto puro (utilizando hash SHA-256 via `crypto.subtle.digest`) e o módulo `storage.js` valide a sessão ativa antes de gravar ou remover vendas, qualquer aplicação puramente client-side que armazena dados em `localStorage` e `sessionStorage` pode ser inspecionada, editada ou contornada localmente pelo próprio usuário através das ferramentas de desenvolvedor do navegador (**DevTools**).
>
> **Em um ambiente de produção real:**
> - A autenticação deve ocorrer em um **servidor backend** com armazenamento seguro de senhas (ex.: Argon2id ou bcrypt com salt).
> - O controle de sessão deve utilizar tokens assinados no servidor (ex.: cookies `HttpOnly`, `Secure`, `SameSite`).
> - O rate-limiting de tentativas de login e a validação de permissões (`consultorId` da venda e propriedade na exclusão) devem ser impostos pela API/banco de dados no backend.

---

## 📋 Regras de Validação de Vendas (Placas, Contratos e Datas)

- **Data da Venda:**
  - Deve estar compreendida entre **`01/01/2023`** (`min="2023-01-01"`) e a **data de hoje** (`max` recalculado dinamicamente no foco do campo e no envio do formulário).
  - Validada no formulário (`validarDataInput`) e na camada de persistência (`addVenda`).
- **Placa do Veículo (Placas Repetidas Permitidas):**
  - Aceita padrão **Mercosul** (`ABC1D23` ou `ABC-1D23`) e **antigo** (`ABC1234` ou `ABC-1234`), apenas com hífen opcional.
  - **Placas repetidas são permitidas** (inclusive para o mesmo consultor ou consultores diferentes, contemplando revendas e trocas).
- **Número do Contrato (Único no Sistema):**
  - Aceita apenas letras e números, sem espaços internos.
  - **Estritamente único em todo o sistema:** a verificação ignora espaços nas pontas e não diferencia maiúsculas de minúsculas (`ct1050` e `CT1050` são tratados como o mesmo contrato), validada tanto no formulário quanto em `addVenda`.
- **Sincronização entre Abas:**
  - Alterações de vendas realizadas em outra aba do navegador disparam o evento `storage` do `window`, atualizando automaticamente o Ranking Geral e o Painel do Consultor.
