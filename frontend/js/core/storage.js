/**
 * ECHODESK — Storage Adapter
 * Provides robust localStorage persistence with schema isolation and privacy erasure.
 */

class StorageAdapter {
  constructor(namespace = 'echodesk_') {
    this.prefix = namespace;
  }

  _key(key) {
    return `${this.prefix}${key}`;
  }

  get(key, defaultValue = null) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return defaultValue;
      }
      const raw = window.localStorage.getItem(this._key(key));
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`[Storage] Failed to read key "${key}":`, err);
      return defaultValue;
    }
  }

  set(key, value) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      window.localStorage.setItem(this._key(key), JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`[Storage] Failed to write key "${key}":`, err);
      return false;
    }
  }

  remove(key) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.removeItem(this._key(key));
    } catch (err) {
      console.error(`[Storage] Failed to delete key "${key}":`, err);
    }
  }

  clearAll() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const keysToRemove = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    } catch (err) {
      console.error('[Storage] Failed to clear storage:', err);
    }
  }
}

if (typeof window !== 'undefined') {
  window.StorageAdapter = StorageAdapter;
  window.appStorage = window.appStorage || new StorageAdapter();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageAdapter };
}
