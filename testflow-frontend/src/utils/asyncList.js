const VIEW_CONTEXT_PREFIX = 'testflow:view:';

export function clampPage(page, totalItems, itemsPerPage) {
  const safeTotal = Math.max(0, Number(totalItems) || 0);
  const safePerPage = Math.max(1, Number(itemsPerPage) || 1);
  const pageCount = Math.max(1, Math.ceil(safeTotal / safePerPage));
  const safePage = Number.isFinite(page) ? Math.floor(page) : 1;
  return Math.min(Math.max(1, safePage), pageCount);
}

export function isRequestCanceled(error, signal) {
  return Boolean(
    signal?.aborted ||
    error?.code === 'ERR_CANCELED' ||
    error?.name === 'CanceledError' ||
    error?.name === 'AbortError'
  );
}

export function extractErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

export function loadViewContext(key, defaults) {
  try {
    const raw = sessionStorage.getItem(`${VIEW_CONTEXT_PREFIX}${key}`);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...defaults };
    const merged = { ...defaults, ...parsed };
    if ('currentPage' in merged) {
      const page = Number(merged.currentPage);
      merged.currentPage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
    }
    return merged;
  } catch {
    return { ...defaults };
  }
}

export function saveViewContext(key, value) {
  try {
    sessionStorage.setItem(`${VIEW_CONTEXT_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Armazenamento indisponível não impede o uso da tela.
  }
}
