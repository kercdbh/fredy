/*
 * Copyright (c) 2026 by Christian Kellner.
 * Licensed under Apache-2.0 with Commons Clause and Attribution/Naming Clause
 */

import { notificationAdapterRouter } from './routes/notificationAdapterRouter.js';
import { authInterceptor, cookieSession, adminInterceptor } from './security.js';
import { generalSettingsRouter } from './routes/generalSettingsRoute.js';
import { providerRouter } from './routes/providerRouter.js';
import { versionRouter } from './routes/versionRouter.js';
import { loginRouter } from './routes/loginRoute.js';
import { userRouter } from './routes/userRoute.js';
import { userSettingsRouter } from './routes/userSettingsRoute.js';
import { jobRouter } from './routes/jobRouter.js';
import bodyParser from 'body-parser';
import restana from 'restana';
import files from 'serve-static';
import path from 'path';
import fs from 'fs';
import { getDirName, normalizeBaseUrl } from '../utils.js';
import { demoRouter } from './routes/demoRouter.js';
import logger from '../services/logger.js';
import { listingsRouter } from './routes/listingsRouter.js';
import { getSettings } from '../services/storage/settingsStorage.js';
import { dashboardRouter } from './routes/dashboardRouter.js';
import { backupRouter } from './routes/backupRouter.js';
const service = restana();
const staticRoot = path.join(getDirName(), '../ui/public');
const staticService = files(staticRoot);
const settings = await getSettings();
const PORT = settings.port || 9998;
const baseUrl = normalizeBaseUrl(settings.baseUrl);
const apiBase = baseUrl ? `${baseUrl}/api` : '/api';

let cachedIndexHtml = null;
const loadIndexHtml = () => {
  if (cachedIndexHtml != null) return cachedIndexHtml;
  try {
    cachedIndexHtml = fs.readFileSync(path.join(staticRoot, 'index.html'), 'utf8');
  } catch {
    cachedIndexHtml = null;
  }
  return cachedIndexHtml;
};

const applyBaseUrlToHtml = (html, basePath) => {
  if (!basePath) return html;
  let body = html;
  if (!/\\<base\\s/i.test(body)) {
    const baseTag = `<base href=\"${basePath}/\">`;
    if (body.includes('</head>')) {
      body = body.replace('</head>', `  ${baseTag}\n</head>`);
    } else {
      body = `${baseTag}\n${body}`;
    }
  }
  body = body.replaceAll('./assets/', `${basePath}/assets/`);
  body = body.replaceAll('"/assets/', `"${basePath}/assets/`);
  body = body.replaceAll("'/assets/", `'${basePath}/assets/`);
  return body;
};

service.use(bodyParser.json());
service.use(cookieSession());
const serveIndex = (req, res) => {
  const indexHtml = loadIndexHtml();
  if (!indexHtml) {
    res.statusCode = 404;
    res.end();
    return;
  }
  const body = applyBaseUrlToHtml(indexHtml, baseUrl);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
};

const mountStatic = () => {
  if (!baseUrl) {
    service.use(staticService);
    return;
  }
  // Serve index for both /baseUrl and /baseUrl/ to avoid redirect loops behind proxies.
  service.get(baseUrl, serveIndex);
  service.get(`${baseUrl}/`, serveIndex);
  const staticWithPrefix = (req, res, next) => {
    if (!req.url || !req.url.startsWith(baseUrl)) {
      return next();
    }
    if (req.url.startsWith(`${baseUrl}/api`)) {
      return next();
    }
    const originalUrl = req.url;
    const stripped = req.url.slice(baseUrl.length);
    req.url = stripped.length === 0 ? '/' : stripped;
    return staticService(req, res, (err) => {
      req.url = originalUrl;
      if (err) return next(err);
      return next();
    });
  };
  service.use(baseUrl, staticWithPrefix);
};

mountStatic();
service.use(`${apiBase}/admin`, authInterceptor());
service.use(`${apiBase}/jobs`, authInterceptor());
service.use(`${apiBase}/version`, authInterceptor());
service.use(`${apiBase}/listings`, authInterceptor());
service.use(`${apiBase}/dashboard`, authInterceptor());
service.use(`${apiBase}/user/settings`, authInterceptor());

// /admin can only be accessed when user is having admin permissions
service.use(`${apiBase}/admin`, adminInterceptor());
service.use(`${apiBase}/jobs/notificationAdapter`, notificationAdapterRouter);
service.use(`${apiBase}/admin/generalSettings`, generalSettingsRouter);
service.use(`${apiBase}/admin/backup`, backupRouter);
service.use(`${apiBase}/jobs/provider`, providerRouter);
service.use(`${apiBase}/admin/users`, userRouter);
service.use(`${apiBase}/user/settings`, userSettingsRouter);
service.use(`${apiBase}/version`, versionRouter);
service.use(`${apiBase}/jobs`, jobRouter);
service.use(`${apiBase}/login`, loginRouter);
service.use(`${apiBase}/listings`, listingsRouter);
service.use(`${apiBase}/dashboard`, dashboardRouter);
//this route is unsecured intentionally as it is being queried from the login page
service.use(`${apiBase}/demo`, demoRouter);

service.start(PORT).then(() => {
  logger.debug(`Started API service on port ${PORT}`);
});
