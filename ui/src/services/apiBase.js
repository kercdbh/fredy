/*
 * Copyright (c) 2026 by Christian Kellner.
 * Licensed under Apache-2.0 with Commons Clause and Attribution/Naming Clause
 */

function normalizeBasePath(basePath) {
  if (typeof basePath !== 'string') return '';
  let normalized = basePath.trim();
  if (!normalized) return '';
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized === '/' ? '' : normalized;
}

export function getApiBasePath() {
  if (typeof window === 'undefined') return '';
  const fromGlobal = window.__FREDY_BASE_URL__;
  if (typeof fromGlobal === 'string') return normalizeBasePath(fromGlobal);
  const path = window.location?.pathname || '';
  if (!path || path === '/') return '';
  const withoutIndex = path.replace(/\/index\.html$/, '');
  return normalizeBasePath(withoutIndex);
}

export function apiUrl(url) {
  if (typeof url !== 'string') return url;
  if (/^https?:\/\//i.test(url)) return url;
  const basePath = getApiBasePath();
  if (!basePath) return url;
  if (url.startsWith('/')) return `${basePath}${url}`;
  return `${basePath}/${url}`;
}
