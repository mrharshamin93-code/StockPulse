const isNode = typeof window === "undefined";

const memoryStorage = {
  store: new Map(),
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  },
  setItem(key, value) {
    this.store.set(key, String(value));
  },
  removeItem(key) {
    this.store.delete(key);
  },
};

const storage = isNode ? memoryStorage : window.localStorage;

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
  if (isNode) {
    return defaultValue ?? null;
  }

  const storageKey = `stockpulse_${paramName}`;
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);

  if (removeFromUrl) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${
      urlParams.toString() ? `?${urlParams.toString()}` : ""
    }${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }

  if (searchParam) {
    storage.setItem(storageKey, searchParam);
    return searchParam;
  }

  if (defaultValue !== undefined) {
    const storedValue = storage.getItem(storageKey);
    if (!storedValue) {
      storage.setItem(storageKey, defaultValue);
      return defaultValue;
    }
  }

  const storedValue = storage.getItem(storageKey);
  if (storedValue) {
    return storedValue;
  }

  return defaultValue ?? null;
};

const getAppParams = () => {
  return {
    fromUrl: getAppParamValue("from_url", {
      defaultValue: isNode ? "" : window.location.href,
    }),
  };
};

export const appParams = {
  ...getAppParams(),
};
