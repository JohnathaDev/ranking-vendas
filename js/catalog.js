/**
 * Catálogo fixo de modelos de motocicletas e respectivos anos modelo disponíveis.
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
