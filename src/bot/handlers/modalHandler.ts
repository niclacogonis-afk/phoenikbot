import { BotClient } from '../client';
import { ModalHandler } from '../../types';
import { logger } from '../../utils/logger';
import path from 'path';
import fs from 'fs';

export async function loadModals(client: BotClient): Promise<void> {
  const modalsPath = path.join(__dirname, '..', 'modals');
  if (!fs.existsSync(modalsPath)) return;

  const files = fs.readdirSync(modalsPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = await import(path.join(modalsPath, file));
      const handler: ModalHandler = mod.default ?? mod;
      if (!handler?.customId || !handler?.execute) continue;
      client.modals.set(handler.customId, handler);
    } catch (err) {
      logger.error(`Failed to load modal ${file}:`, err instanceof Error ? err : new Error(String(err)));
    }
  }
}
