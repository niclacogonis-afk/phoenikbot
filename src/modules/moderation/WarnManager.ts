import { GuildMember } from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import { getUser } from '../../database/models/User';
import { getGuild } from '../../database/models/Guild';
import { incrementStat } from '../../database/models/StaffStats';
import { incrementDailyStat } from '../../database/models/Stats';
import { sendLog, modEmbed } from '../logging/LogManager';
import { formatDuration } from '../../utils/formatters';

export class WarnManager {
  static async addWarn(
    member: GuildMember,
    reason: string,
    moderatorId: string
  ): Promise<{ warnId: string; totalWarns: number; action: string | null }> {
    const user = await getUser(member.guild.id, member.user.id);
    const warnId = uuidv4().split('-')[0]!;

    user.warns.push({ id: warnId, reason, moderatorId, timestamp: new Date() });
    await user.save();

    const guild = await getGuild(member.guild.id);
    const totalWarns = user.warns.length;
    let action: string | null = null;

    if (totalWarns >= guild.autoModThresholds.warnBanThreshold) {
      await member.ban({ reason: `Auto-ban: ${totalWarns} warns` }).catch(() => null);
      action = 'banned';
      await incrementDailyStat(member.guild.id, 'bans').catch(() => null);
    } else if (totalWarns >= guild.autoModThresholds.warnMuteThreshold) {
      const muteDuration = guild.autoModThresholds.muteDuration;
      await member.timeout(muteDuration, `Auto-mute: ${totalWarns} warns`).catch(() => null);
      action = `muted for ${formatDuration(muteDuration)}`;
    }

    await incrementStat(member.guild.id, moderatorId, 'warns').catch(() => null);
    await incrementDailyStat(member.guild.id, 'warns').catch(() => null);
    await incrementDailyStat(member.guild.id, 'modActions').catch(() => null);

    const embed = modEmbed('⚠️ Member Warned', [
      { name: 'User', value: `${member.user.tag} (${member.user.id})`, inline: true },
      { name: 'Moderator', value: `<@${moderatorId}>`, inline: true },
      { name: 'Reason', value: reason },
      { name: 'Warn ID', value: warnId, inline: true },
      { name: 'Total Warns', value: `${totalWarns}`, inline: true },
      ...(action ? [{ name: 'Auto Action', value: action }] : []),
    ], 0xFEE75C);
    await sendLog(member.guild, embed, 'modlog');

    return { warnId, totalWarns, action };
  }

  static async removeWarn(guildId: string, userId: string, warnId: string): Promise<boolean> {
    const user = await getUser(guildId, userId);
    const before = user.warns.length;
    user.warns = user.warns.filter((w) => w.id !== warnId);
    if (user.warns.length === before) return false;
    await user.save();
    return true;
  }

  static async getWarns(guildId: string, userId: string) {
    const user = await getUser(guildId, userId);
    return user.warns;
  }
}
