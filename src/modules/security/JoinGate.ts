import { GuildMember } from 'discord.js';
import { getGuild } from '../../database/models/Guild';
import { isModuleEnabled } from '../cache/CacheManager';
import { logger } from '../../utils/logger';

const INVITE_IN_NAME = /(discord\.(gg|io|me|li)\/|discordapp\.com\/invite)/i;

/**
 * Anti-raid: se l'account è più recente di N ore, applica timeout (richiede ModerateMembers).
 * Imposta `raidMinAccountAgeHours` nella dashboard (0 = disattivo).
 */
export async function applyRaidJoinAccountGate(member: GuildMember): Promise<void> {
  const guildId = member.guild.id;
  if (!(await isModuleEnabled(guildId, 'antirAid'))) return;

  const guildDoc = await getGuild(guildId);
  const minH = guildDoc.autoModThresholds.raidMinAccountAgeHours ?? 0;
  if (minH > 0) {
    const ageMs = Date.now() - member.user.createdTimestamp;
    if (ageMs < minH * 3600000) {
      const duration = Math.min(24 * 60 * 60 * 1000, Math.max(60 * 60 * 1000, minH * 3600000));
      await member.timeout(duration, 'PhoenikBot · account troppo nuovo (anti-raid)').catch((e) => {
        logger.debug(`JoinGate timeout: ${e instanceof Error ? e.message : String(e)}`);
      });
    }
  }

  if (INVITE_IN_NAME.test(member.user.username) || INVITE_IN_NAME.test(member.displayName)) {
    await member.kick('PhoenikBot · nome sospetto (link invito)').catch(() => null);
  }
}
