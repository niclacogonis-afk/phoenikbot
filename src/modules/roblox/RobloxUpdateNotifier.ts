import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger';
import { getGuild } from '../../database/models/Guild';

const ROBLOX_VERSION_API = 'https://clientsettings.roblox.com/v2/client-version/WindowsPlayer/channel/LIVE';

interface RobloxVersion {
  version: string;
  clientVersionUpload: string;
}

let lastKnownVersion: string | null = null;

export class RobloxUpdateNotifier {

  static async checkForUpdates(client: Client): Promise<void> {
    try {
      const res = await fetch(ROBLOX_VERSION_API);
      if (!res.ok) return;

      const data = await res.json() as { version?: string; clientVersionUpload?: string };
      const currentVersion = data.version;

      if (!currentVersion) return;

      // First run - just store the version
      if (!lastKnownVersion) {
        lastKnownVersion = currentVersion;
        logger.info(`Roblox version loaded: ${currentVersion}`);
        return;
      }

      // Version changed - notify!
      if (currentVersion !== lastKnownVersion) {
        const oldVersion = lastKnownVersion;
        lastKnownVersion = currentVersion;

        logger.info(`Roblox update detected: ${oldVersion} → ${currentVersion}`);

        // Notify all guilds that have the roblox module enabled
        for (const guild of client.guilds.cache.values()) {
          try {
            const config = await getGuild(guild.id);
            if (!(config as any).robloxUpdatesChannel) continue;

            const channel = guild.channels.cache.get((config as any).robloxUpdatesChannel as string) as TextChannel | undefined;
            if (!channel) continue;

            const embed = new EmbedBuilder()
              .setColor(0xFF3B3B)
              .setTitle('Roblox Update Detected!')
              .setDescription(
                `**Roblox has been updated!**\n\n` +
                `**Old version:** \`${oldVersion}\`\n` +
                `**New version:** \`${currentVersion}\`\n\n` +
                `Executor may need updating. Check for updates in the Phoenik Discord.`
              )
              .setTimestamp()
              .setFooter({ text: 'Phoenik Update Notifier' });

            await channel.send({ embeds: [embed] });
          } catch { }
        }
      }
    } catch (err) {
      logger.error('Roblox update check error:', err instanceof Error ? err : new Error(String(err)));
    }
  }

  static async getCurrentVersion(): Promise<string | null> {
    try {
      const res = await fetch(ROBLOX_VERSION_API);
      if (!res.ok) return null;
      const data = await res.json() as { version?: string };
      return data.version || null;
    } catch {
      return null;
    }
  }
}
