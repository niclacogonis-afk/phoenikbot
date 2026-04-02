import { BotClient } from '../client';
import { SelectMenuHandler } from '../../types';
import { logger } from '../../utils/logger';
import { isHandlerSourceFile } from '../../utils/handlerFiles';
import path from 'path';
import fs from 'fs';

export async function loadSelectMenus(client: BotClient): Promise<void> {
  const menusPath = path.join(__dirname, '..', 'selectMenus');
  if (!fs.existsSync(menusPath)) return;

  const files = fs.readdirSync(menusPath).filter(isHandlerSourceFile);
  for (const file of files) {
    try {
      const mod = await import(path.join(menusPath, file));
      const handler: SelectMenuHandler = mod.default ?? mod;
      if (!handler?.customId || !handler?.execute) continue;
      client.selectMenus.set(handler.customId, handler);
    } catch (err) {
      logger.error(`Failed to load select menu ${file}:`, err instanceof Error ? err : new Error(String(err)));
    }
  }
}
