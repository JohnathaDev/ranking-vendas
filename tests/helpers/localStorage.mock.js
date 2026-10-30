/**
 * Implementação em memória de localStorage para ambiente de testes no Node.js.
 */
export function criarLocalStorageMock() {
  const store = new Map();

  return {
    get length() {
      return store.size;
    },
    key(index) {
      const idx = Number(index);
      if (isNaN(idx) || idx < 0 || idx >= store.size) {
        return null;
      }
      return Array.from(store.keys())[idx] ?? null;
    },
    getItem(key) {
      const k = String(key);
      return store.has(k) ? store.get(k) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    }
  };
}

export function instalarLocalStorageMock() {
  const storage = criarLocalStorageMock();
  globalThis.localStorage = storage;
  return storage;
}

if (typeof globalThis.localStorage === 'undefined') {
  instalarLocalStorageMock();
}
