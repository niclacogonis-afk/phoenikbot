import { BotClient } from '../client';
import { ButtonHandler } from '../../types';
import { logger } from '../../utils/logger';
import path from 'path';
import fs from 'fs';

export async function loadButtons(client: BotClient): Promise<void> {
  const buttonsPath = path.join(__dirname, '..', 'buttons');
  if (!fs.existsSync(buttonsPath)) return;

  const files = fs.readdirSync(buttonsPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = await import(path.join(buttonsPath, file));
      const handler: ButtonHandler = mod.default ?? mod;
      if (!handler?.customId || !handler?.execute) continue;
      client.buttons.set(handler.customId, handler);
      logger.debug(`Loaded button: ${handler.customId}`);
    } catch (err) {
      logger.error(`Failed to load button ${file}:`, err instanceof Error ? err : new Error(String(err)));
    }
  }
}
