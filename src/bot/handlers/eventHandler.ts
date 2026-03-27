import { BotClient } from '../client';
import { BotEvent } from '../../types';
import { logger } from '../../utils/logger';
import path from 'path';
import fs from 'fs';

export async function loadEvents(client: BotClient): Promise<void> {
  const eventsPath = path.join(__dirname, '..', 'events');
  const files = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

  for (const file of files) {
    try {
      const mod = await import(path.join(eventsPath, file));
      const event: BotEvent = mod.default ?? mod;
      if (!event?.name || !event?.execute) continue;

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }
      logger.debug(`Loaded event: ${event.name}`);
    } catch (err) {
      logger.error(`Failed to load event ${file}:`, err instanceof Error ? err : new Error(String(err)));
    }
  }

  logger.info(`✅ Loaded ${files.length} events`);
}
