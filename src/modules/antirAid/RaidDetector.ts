import { GuildMember, TextChannel, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getGuild } from '../../database/models/Guild';
import { getCachedGuild } from '../cache/CacheManager';
import { incrementDailyStat } from '../../database/models/Stats';
import { logger } from '../../utils/logger';

const joinWindows = new Map<string, number[]>();

export class RaidDetector {
  static async onMemberJoin(member: GuildMember): Promise<void> {
    const guildId = member.guild.id;
    const now = Date.now();

    if (!joinWindows.has(guildId)) joinWindows.set(guildId, []);
    const window = joinWindows.get(guildId)!;
    window.push(now);

    const guild = await getGuild(guildId);
    const { raidJoins, raidSeconds } = guild.autoModThresholds;
    const cutoff = now - raidSeconds * 1000;
    const recent = window.filter((t) => t >= cutoff);
    joinWindows.set(guildId, recent);

    if (recent.length >= raidJoins) {
      logger.warn(`🚨 Raid detected in ${member.guild.name} (${recent.length} joins in ${raidSeconds}s)`);
      await RaidDetector.activateLockdown(member.guild as import('discord.js').Guild);
      joinWindows.set(guildId, []);
      await incrementDailyStat(guildId, 'raidsBlocked').catch(() => null);
    }
  }

  static async activateLockdown(guild: import('discord.js').Guild): Promise<void> {
    try {
      const everyoneRole = guild.roles.everyone;
      const textChannels = guild.channels.cache.filter(
        (c) => c.isTextBased() && !c.isDMBased()
      );

      for (const [, channel] of textChannels) {
        await (channel as TextChannel).permissionOverwrites.edit(everyoneRole, {
          SendMessages: false,
        }).catch(() => null);
      }

      await guild.disableInvites(true).catch(() => null);

      const cached = await getCachedGuild(guild.id);
      const logChannelId = cached.logChannel;
      if (logChannelId) {
        const logChannel = guild.channels.cache.get(logChannelId) as TextChannel | undefined;
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('🚨 RAID DETECTED — LOCKDOWN ACTIVATED')
            .setDescription('Multiple users joined in a short time. Server is now in lockdown mode.\nUse `/lockdown unlock` to restore access.')
            .setTimestamp();

          const staffPings = cached.staffRoles.map((r) => `<@&${r}>`).join(' ');
          await logChannel.send({ content: staffPings || undefined, embeds: [embed] });
        }
      }
    } catch (err) {
      logger.error('Lockdown error:', err instanceof Error ? err : new Error(String(err)));
    }
  }

  static async deactivateLockdown(guild: import('discord.js').Guild): Promise<void> {
    try {
      const everyoneRole = guild.roles.everyone;
      const textChannels = guild.channels.cache.filter((c) => c.isTextBased() && !c.isDMBased());

      for (const [, channel] of textChannels) {
        await (channel as TextChannel).permissionOverwrites.edit(everyoneRole, {
          SendMessages: null,
        }).catch(() => null);
      }

      await guild.disableInvites(false).catch(() => null);
    } catch (err) {
      logger.error('Deactivate lockdown error:', err instanceof Error ? err : new Error(String(err)));
    }
  }
}
