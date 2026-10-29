/**
 * Catálogo fixo de modelos de motocicletas, anos modelo disponíveis
 * e paletas de cores consistentes para os gráficos de BI (Item 2.5).
 */
export const MOTOS_CATALOG = [
  {
    modelo: 'Factor 150',
    anos: [2024, 2025, 2026]
  },
  {
    modelo: 'Start 160',
    anos: [2024, 2025, 2026]
  },
  {
    modelo: 'Fan 160',
    anos: [2025, 2026]
  },
  {
    modelo: 'Bros 160',
    anos: [2025, 2026]
  },
  {
    modelo: 'Pop 110i',
    anos: [2026]
  }
];

/**
 * Paleta fixa por modelo de motocicleta (Item 2.5).
 * Garante que o mesmo modelo tenha sempre a mesma cor em qualquer gráfico do sistema.
 */
export const CORES_MODELO = {
  'Factor 150': '#2563eb', // Azul Royal
  'Start 160': '#f59e0b', // Âmbar
  'Fan 160': '#d90429', // Vermelho Automotivo (Primária)
  'Bros 160': '#10b981', // Esmeralda
  'Pop 110i': '#7c3aed', // Violeta
  Outros: '#64748b' // Cinza Ardósia
};

/**
 * Paleta fixa por ano modelo (Item 2.5).
 */
export const CORES_ANO = {
  2024: '#0284c7', // Azul Céu Escuro
  2025: '#0d9488', // Verde-azulado (Teal)
  2026: '#d90429', // Vermelho Automotivo
  Outros: '#64748b'
};

/**
 * Paleta consistente para consultores e séries adicionais (Item 2.5).
 */
export const PALETA_CONSULTORES = [
  '#d90429', // Vermelho
  '#2563eb', // Azul
  '#059669', // Verde
  '#d97706', // Laranja
  '#7c3aed', // Roxo
  '#0891b2', // Ciano
  '#db2777', // Rosa Escuro
  '#4f46e5' // Índigo
];

/**
 * Mapa nome do consultor -> cor, montado pela ordem de cadastro dos consultores.
 * Evita que dois consultores recebam a mesma cor (o que acontecia com o hash do nome).
 */
const mapaCoresConsultores = new Map();

/**
 * Define as cores dos consultores pela ordem da lista (1º consultor = 1ª cor da paleta, etc.).
 * Deve ser chamada antes de desenhar gráficos agrupados por consultor.
 * @param {Array<{ id: string, nome: string }>} consultores
 */
export function definirCoresConsultores(consultores) {
  mapaCoresConsultores.clear();
  if (!Array.isArray(consultores)) return;
  consultores.filter(Boolean).forEach((c, idx) => {
    mapaCoresConsultores.set(String(c.nome), PALETA_CONSULTORES[idx % PALETA_CONSULTORES.length]);
  });
}

/**
 * Retorna todos os modelos cadastrados no catálogo.
 * @returns {string[]} Lista com nomes dos modelos
 */
export function getModelos() {
  return MOTOS_CATALOG.map((item) => item.modelo);
}

/**
 * Retorna a lista de anos disponíveis para determinado modelo.
 * @param {string} modeloNome Nome do modelo
 * @returns {number[]} Lista de anos correspondentes ou array vazio
 */
export function getAnosPorModelo(modeloNome) {
  const moto = MOTOS_CATALOG.find((item) => item.modelo === modeloNome);
  return moto ? [...moto.anos] : [];
}

/**
 * Retorna todos os anos únicos disponíveis no catálogo em ordem crescente.
 * @returns {number[]} Lista de anos únicos
 */
export function getTodosAnos() {
  const anosSet = new Set();
  MOTOS_CATALOG.forEach((item) => {
    item.anos.forEach((ano) => anosSet.add(ano));
  });
  return Array.from(anosSet).sort((a, b) => a - b);
}

/**
 * Retorna a cor fixa associada a um modelo, ano ou consultor de forma determinística (Item 2.5).
 * @param {'modelo' | 'anoModelo' | 'consultor'} dimensao
 * @param {string|number} chave Nome do modelo, ano ou nome do consultor
 * @returns {string} Código hexadecimal da cor
 */
export function getCorConsistente(dimensao, chave) {
  const chaveStr = String(chave ?? '');
  if (chaveStr === 'Outros') {
    return '#64748b';
  }
  if (chaveStr === 'Total') {
    return '#0f172a';
  }

  if (dimensao === 'modelo' && CORES_MODELO[chaveStr]) {
    return CORES_MODELO[chaveStr];
  }

  if (dimensao === 'anoModelo' && CORES_ANO[chaveStr]) {
    return CORES_ANO[chaveStr];
  }

  if (dimensao === 'consultor' && mapaCoresConsultores.has(chaveStr)) {
    return mapaCoresConsultores.get(chaveStr);
  }

  // Hash determinístico pelo texto da chave para que o mesmo consultor tenha sempre a mesma cor
  let hash = 0;
  for (let i = 0; i < chaveStr.length; i++) {
    hash = (hash * 31 + chaveStr.charCodeAt(i)) >>> 0;
  }
  return PALETA_CONSULTORES[hash % PALETA_CONSULTORES.length];
}
