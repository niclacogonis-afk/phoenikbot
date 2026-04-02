import 'dotenv/config';
import { setupErrorHandlers } from './utils/errorHandler';
import { logger } from './utils/logger';
import { connectDatabase } from './database/connection';
import { BotClient } from './bot/client';
import { loadCommands } from './bot/handlers/commandHandler';
import { loadEvents } from './bot/handlers/eventHandler';
import { loadButtons } from './bot/handlers/buttonHandler';
import { loadSelectMenus } from './bot/handlers/selectMenuHandler';
import { loadModals } from './bot/handlers/modalHandler';
import { config } from './config';
import type { TextChannel } from 'discord.js';
import cron from 'node-cron';

setupErrorHandlers();

async function main() {
  logger.info('🚀 Starting PhoenikBot...');

  await connectDatabase();

  const client = new BotClient();

  await loadCommands(client);
  await loadButtons(client);
  await loadSelectMenus(client);
  await loadModals(client);
  await loadEvents(client);

  setupCronJobs(client);

  await client.login(config.token);

  if (config.port) {
    const { createWebServer } = await import('./web/server');
    createWebServer(client).listen(config.port, () => {
      logger.info(`🌐 Dashboard running on port ${config.port}`);
    });
  }
}

function setupCronJobs(client: BotClient) {
  cron.schedule('*/10 * * * *', async () => {
    try {
      const { YouTubeNotifier } = await import('./modules/youtube/YouTubeNotifier');
      await YouTubeNotifier.checkAll(client);
    } catch (err) {
      logger.error('YouTube cron error:', err instanceof Error ? err : new Error(String(err)));
    }
  });

  cron.schedule('*/5 * * * *', async () => {
    try {
      const { TwitchNotifier } = await import('./modules/twitch/TwitchNotifier');
      await TwitchNotifier.checkAll(client);
    } catch (err) {
      logger.error('Twitch cron error:', err instanceof Error ? err : new Error(String(err)));
    }
  });

  cron.schedule('*/1 * * * *', async () => {
    try {
      const { GiveawayManager } = await import('./modules/giveaway/GiveawayManager');
      await GiveawayManager.checkExpired(client);
    } catch (err) {
      logger.error('Giveaway cron error:', err instanceof Error ? err : new Error(String(err)));
    }
  });

  cron.schedule('*/30 * * * *', async () => {
    try {
      await checkAutoCloseTickets(client);
    } catch (err) {
      logger.error('Auto-close cron error:', err instanceof Error ? err : new Error(String(err)));
    }
  });

  cron.schedule('*/1 * * * *', async () => {
    try {
      await checkScheduledMessages(client);
    } catch (err) {
      logger.error('Schedule cron error:', err instanceof Error ? err : new Error(String(err)));
    }
  });

  // Check expired Phoenik licenses every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      const { PhoenikLicenseModel } = await import('./database/models/PhoenikLicense');

      const expired = await PhoenikLicenseModel.find({
        active: true,
        expiresAt: { $lte: new Date() },
      });

      for (const license of expired) {
        license.active = false;
        await license.save();

        const guild = client.guilds.cache.get(license.guildId);
        if (guild) {
          const member = await guild.members.fetch(license.discordId).catch(() => null);
          if (member) {
            await member.roles.remove(license.roleId, 'Phoenik license expired').catch(() => null);
            logger.info(`Removed expired Phoenik license from ${member.user.tag} in ${guild.name}`);
          }
        }
      }
    } catch (err) {
      logger.error('Phoenik license cron error:', err instanceof Error ? err : new Error(String(err)));
    }
  });

  // Check Roblox updates every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      const { RobloxUpdateNotifier } = await import('./modules/roblox/RobloxUpdateNotifier');
      await RobloxUpdateNotifier.checkForUpdates(client);
    } catch (err) {
      logger.error('Roblox update cron error:', err instanceof Error ? err : new Error(String(err)));
    }
  });

  // Weekly leaderboard: finalize and announce every Monday at 00:01
  cron.schedule('1 0 * * 1', async () => {
    try {
      const { WeeklyLeaderboardManager } = await import('./modules/leaderboard/WeeklyLeaderboardManager');
      await WeeklyLeaderboardManager.finalizeWeek(client);
      await WeeklyLeaderboardManager.announceLeaderboard(client);
      logger.info('Weekly leaderboard finalized and announced');
    } catch (err) {
      logger.error('Weekly leaderboard cron error:', err instanceof Error ? err : new Error(String(err)));
    }
  });

  logger.info('⏰ Cron jobs started');
}

async function checkAutoCloseTickets(client: BotClient) {
  const { TicketModel } = await import('./database/models/Ticket');
  const { getTicketConfig } = await import('./database/models/TicketConfig');
  const { TicketManager } = await import('./modules/ticket/TicketManager');

  const openTickets = await TicketModel.find({ status: 'open' });

  for (const ticket of openTickets) {
    const config = await getTicketConfig(ticket.guildId).catch(() => null);
    if (!config) continue;

    const guild = client.guilds.cache.get(ticket.guildId);
    if (!guild) continue;

    const inactiveMs = config.autoCloseHours * 60 * 60 * 1000;
    const lastActivity = ticket.lastActivityAt ?? ticket.createdAt;
    const timeSince = Date.now() - lastActivity.getTime();

    if (timeSince >= inactiveMs) {
      const thread = guild.channels.cache.get(ticket.threadId ?? ticket.channelId);
      if (thread?.isThread()) {
        await TicketManager.closeTicket(thread, client.user?.id ?? 'BOT', guild);
      }
    } else if (!ticket.autoCloseWarned && timeSince >= inactiveMs - 30 * 60 * 1000) {
      ticket.autoCloseWarned = true;
      await ticket.save();
      try {
        const user = await client.users.fetch(ticket.userId);
        await user.send(`⚠️ Your ticket in **${guild.name}** will be automatically closed in 30 minutes due to inactivity.`);
      } catch { /* DMs disabled */ }
    }
  }
}

async function checkScheduledMessages(client: BotClient) {
  const { ScheduleModel } = await import('./database/models/Schedule');
  const { TextChannel } = await import('discord.js');

  const due = await ScheduleModel.find({
    active: true,
    sendAt: { $lte: new Date() },
  });

  for (const schedule of due) {
    try {
      const guild = client.guilds.cache.get(schedule.guildId);
      if (!guild) continue;
      const channel = guild.channels.cache.get(schedule.channelId) as TextChannel | undefined;
      if (!channel) continue;

      await channel.send(schedule.message);

      if (schedule.repeat === 'none') {
        schedule.active = false;
      } else {
        const ms = schedule.repeat === 'daily' ? 86400000 : schedule.repeat === 'weekly' ? 604800000 : 2592000000;
        schedule.sendAt = new Date(schedule.sendAt.getTime() + ms);
        schedule.lastSentAt = new Date();
      }
      await schedule.save();
    } catch (err) {
      logger.error('Schedule send error:', err instanceof Error ? err : new Error(String(err)));
    }
  }
}

main().catch((err) => {
  logger.error('Fatal error during startup:', err);
  process.exit(1);
});
