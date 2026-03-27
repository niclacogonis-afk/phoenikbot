import { ActivityType } from 'discord.js';
import { BotEvent } from '../../types';
import { BotClient } from '../client';
import { logger } from '../../utils/logger';

const event: BotEvent = {
  name: 'ready',
  once: true,
  async execute(client: BotClient) {
    logger.info(`✅ Logged in as ${client.user?.tag}`);
    logger.info(`📊 Serving ${client.guilds.cache.size} guilds`);

    client.user?.setPresence({
      activities: [{ name: '/help | PhoenikBot', type: ActivityType.Watching }],
      status: 'online',
    });
  },
};

export default event;
