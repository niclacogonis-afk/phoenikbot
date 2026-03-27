import { EmbedBuilder, Guild, TextChannel, ColorResolvable } from 'discord.js';
import { getCachedGuild } from '../cache/CacheManager';
import { logger } from '../../utils/logger';

export async function sendLog(
  guild: Guild,
  embed: EmbedBuilder,
  type: 'log' | 'modlog' = 'log'
): Promise<void> {
  try {
    const cached = await getCachedGuild(guild.id);
    const channelId = type === 'modlog' ? cached.modLogChannel : cached.logChannel;
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel) return;

    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.debug('Failed to send log:', err instanceof Error ? err : new Error(String(err)));
  }
}

export function modEmbed(
  title: string,
  fields: { name: string; value: string; inline?: boolean }[],
  color: ColorResolvable = 0xED4245
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(fields)
    .setTimestamp();
}
