import { BotClient } from '../client';
import { Command } from '../../types';
import { logger } from '../../utils/logger';
import { isHandlerSourceFile } from '../../utils/handlerFiles';
import path from 'path';
import fs from 'fs';

export async function loadCommands(client: BotClient): Promise<void> {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const categories = fs.readdirSync(commandsPath);

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const files = fs.readdirSync(categoryPath).filter(isHandlerSourceFile);
    for (const file of files) {
      try {
        const mod = await import(path.join(categoryPath, file));
        const command: Command = mod.default ?? mod;
        if (!command?.data || !command?.execute) {
          logger.warn(`Skipping invalid command file: ${file}`);
          continue;
        }
        client.commands.set(command.data.name, command);
        logger.debug(`Loaded command: ${command.data.name}`);
      } catch (err) {
        logger.error(`Failed to load command ${file}:`, err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  logger.info(`✅ Loaded ${client.commands.size} commands`);
}
