import { Guild, User, GuildChannel, AuditLogEvent, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getGuild } from '../../database/models/Guild';
import { getCachedGuild } from '../cache/CacheManager';
import { logger } from '../../utils/logger';

const actionWindows = new Map<string, Map<string, number[]>>();

function trackAction(guildId: string, userId: string, action: string): number {
  if (!actionWindows.has(guildId)) actionWindows.set(guildId, new Map());
  const guildMap = actionWindows.get(guildId)!;
  const key = `${userId}:${action}`;
  if (!guildMap.has(key)) guildMap.set(key, []);
  const times = guildMap.get(key)!;
  const now = Date.now();
  times.push(now);
  const recent = times.filter((t) => t > now - 30000);
  guildMap.set(key, recent);
  return recent.length;
}

export class AntiNuke {
  static async onChannelDelete(channel: GuildChannel): Promise<void> {
    try {
      const audit = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 });
      const entry = audit.entries.first();
      if (!entry || !entry.executor) return;

      const guild = await getGuild(channel.guild.id);
      const threshold = guild.autoModThresholds.nukeChannelDeletes;
      const count = trackAction(channel.guild.id, entry.executor.id, 'channel_delete');

      if (count >= threshold) {
        await AntiNuke.punishUser(channel.guild, entry.executor);
      }
    } catch (err) {
      logger.debug('AntiNuke channel delete error:', err instanceof Error ? err : new Error(String(err)));
    }
  }

  static async onBan(guild: Guild, user: User): Promise<void> {
    try {
      const audit = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
      const entry = audit.entries.first();
      if (!entry || !entry.executor) return;

      const guildConfig = await getGuild(guild.id);
      const threshold = guildConfig.autoModThresholds.nukeBans;
      const count = trackAction(guild.id, entry.executor.id, 'ban');

      if (count >= threshold) {
        await AntiNuke.punishUser(guild, entry.executor);
      }
    } catch (err) {
      logger.debug('AntiNuke ban error:', err instanceof Error ? err : new Error(String(err)));
    }
  }

  static async punishUser(guild: Guild, executor: User): Promise<void> {
    try {
      const cached = await getCachedGuild(guild.id);
      if (cached.adminRoles.length > 0 || cached.staffRoles.length > 0) {
        const isProtected = cached.adminRoles.includes(executor.id) || cached.staffRoles.includes(executor.id);
        if (isProtected) return;
      }

      const member = await guild.members.fetch(executor.id).catch(() => null);
      if (!member) return;

      await member.roles.cache.forEach(async (role) => {
        if (role.permissions.has(PermissionFlagsBits.Administrator) ||
          role.permissions.has(PermissionFlagsBits.ManageGuild) ||
          role.permissions.has(PermissionFlagsBits.BanMembers)) {
          await member.roles.remove(role).catch(() => null);
        }
      });

      await member.kick('Anti-Nuke: Detected mass destructive actions').catch(() => null);

      const logChannelId = cached.logChannel;
      if (logChannelId) {
        const logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel?.isTextBased()) {
          const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('🛡️ Anti-Nuke Triggered')
            .setDescription(`**${executor.tag}** was detected performing mass destructive actions and has been kicked/stripped of permissions.`)
            .setTimestamp();
          await (logChannel as import('discord.js').TextChannel).send({ embeds: [embed] });
        }
      }
    } catch (err) {
      logger.error('AntiNuke punish error:', err instanceof Error ? err : new Error(String(err)));
    }
  }
}
