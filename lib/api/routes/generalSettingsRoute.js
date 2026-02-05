/*
 * Copyright (c) 2026 by Christian Kellner.
 * Licensed under Apache-2.0 with Commons Clause and Attribution/Naming Clause
 */

import restana from 'restana';
import { getDirName, readConfigFromStorage } from '../../utils.js';
import { DEFAULT_CONFIG } from '../../defaultConfig.js';
import fs from 'fs';
import { ensureDemoUserExists } from '../../services/storage/userStorage.js';
import logger from '../../services/logger.js';
import { getSettings, upsertSettings } from '../../services/storage/settingsStorage.js';
const service = restana();
const generalSettingsRouter = service.newRouter();

generalSettingsRouter.get('/', async (req, res) => {
  res.body = Object.assign({}, await getSettings());
  res.send();
});
generalSettingsRouter.post('/', async (req, res) => {
  const { sqlitepath, baseUrl, ...appSettings } = req.body || {};
  const localSettings = await getSettings();

  if (localSettings.demoMode) {
    res.send(new Error('In demo mode, it is not allowed to change these settings.'));
    return;
  }

  try {
    if (typeof sqlitepath !== 'undefined' || typeof baseUrl !== 'undefined') {
      let existingConfig = {};
      try {
        existingConfig = await readConfigFromStorage();
      } catch {
        existingConfig = { ...DEFAULT_CONFIG };
      }
      const nextSqlitePath =
        typeof sqlitepath !== 'undefined' ? sqlitepath : existingConfig.sqlitepath ?? DEFAULT_CONFIG.sqlitepath;
      const nextBaseUrl = typeof baseUrl !== 'undefined' ? baseUrl : existingConfig.baseUrl ?? DEFAULT_CONFIG.baseUrl;
      fs.writeFileSync(`${getDirName()}/../conf/config.json`, JSON.stringify({ sqlitepath: nextSqlitePath, baseUrl: nextBaseUrl }));
    }
    upsertSettings(appSettings);
    ensureDemoUserExists();
  } catch (err) {
    logger.error(err);
    res.send(new Error('Error while trying to write settings.'));
    return;
  }
  res.send();
});
export { generalSettingsRouter };
