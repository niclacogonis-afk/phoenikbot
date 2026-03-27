import {
  Guild, TextChannel, GuildMember, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
} from 'discord.js';
import { GiveawayModel, IGiveaway } from '../../database/models/Giveaway';
import { formatDuration } from '../../utils/formatters';
import { logger } from '../../utils/logger';

export class GiveawayManager {
  static async create(options: {
    guild: Guild;
    channelId: string;
    hostId: string;
    prize: string;
    description?: string;
    winnerCount: number;
    durationMs: number;
    requiredRole?: string | null;
    isRigged?: boolean;
    riggedWinner?: string | null;
  }): Promise<IGiveaway> {
    const endsAt = new Date(Date.now() + options.durationMs);

    const giveaway = await GiveawayModel.create({
      guildId: options.guild.id,
      channelId: options.channelId,
      hostId: options.hostId,
      prize: options.prize,
      description: options.description ?? null,
      winnerCount: options.winnerCount,
      endsAt,
      requiredRole: options.requiredRole ?? null,
      isRigged: options.isRigged ?? false,
      riggedWinner: options.riggedWinner ?? null,
    });

    const channel = options.guild.channels.cache.get(options.channelId) as TextChannel | undefined;
    if (!channel) return giveaway;

    const embed = GiveawayManager.buildEmbed(giveaway);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`giveaway:enter:${giveaway._id}`).setLabel('Enter').setEmoji('🎉').setStyle(ButtonStyle.Primary)
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });
    giveaway.messageId = msg.id;
    await giveaway.save();

    return giveaway;
  }

  static buildEmbed(giveaway: IGiveaway): EmbedBuilder {
    const timeLeft = Math.max(0, giveaway.endsAt.getTime() - Date.now());
    return new EmbedBuilder()
      .setColor(0xFF73FA)
      .setTitle(`🎉 GIVEAWAY: ${giveaway.prize}`)
      .setDescription([
        giveaway.description ?? '',
        `**Ends:** <t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>`,
        `**Winners:** ${giveaway.winnerCount}`,
        `**Entries:** ${giveaway.entries.length}`,
        giveaway.requiredRole ? `**Required Role:** <@&${giveaway.requiredRole}>` : '',
        `**Hosted by:** <@${giveaway.hostId}>`,
      ].filter(Boolean).join('\n'))
      .setTimestamp(giveaway.endsAt);
  }

  static async end(giveaway: IGiveaway, guild: Guild): Promise<string[]> {
    giveaway.status = 'ended';

    let winners: string[] = [];

    if (giveaway.isRigged && giveaway.riggedWinner) {
      winners = [giveaway.riggedWinner];
    } else {
      const eligible = giveaway.entries.filter((e) => !giveaway.blacklist.includes(e));
      const shuffled = eligible.sort(() => Math.random() - 0.5);
      winners = shuffled.slice(0, giveaway.winnerCount);
    }

    giveaway.winners = winners;
    await giveaway.save();

    const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel | undefined;
    if (channel && giveaway.messageId) {
      try {
        const msg = await channel.messages.fetch(giveaway.messageId);
        const endedEmbed = new EmbedBuilder()
          .setColor(0x99AAB5)
          .setTitle(`🎉 GIVEAWAY ENDED: ${giveaway.prize}`)
          .setDescription(winners.length > 0
            ? `**Winners:** ${winners.map((w) => `<@${w}>`).join(', ')}`
            : 'No eligible winners.')
          .setTimestamp();
        await msg.edit({ embeds: [endedEmbed], components: [] });

        if (winners.length > 0) {
          await channel.send({
            content: `🎉 Congratulations ${winners.map((w) => `<@${w}>`).join(', ')}! You won **${giveaway.prize}**!`,
          });
        }
      } catch (err) {
        logger.debug('Giveaway end message error:', err instanceof Error ? err : new Error(String(err)));
      }
    }

    return winners;
  }

  static async enter(giveawayId: string, userId: string, member: GuildMember): Promise<{ success: boolean; reason?: string }> {
    const giveaway = await GiveawayModel.findById(giveawayId);
    if (!giveaway || giveaway.status !== 'active') return { success: false, reason: 'This giveaway has ended.' };
    if (giveaway.entries.includes(userId)) return { success: false, reason: 'You already entered this giveaway.' };
    if (giveaway.blacklist.includes(userId)) return { success: false, reason: 'You are blacklisted from this giveaway.' };
    if (giveaway.requiredRole && !member.roles.cache.has(giveaway.requiredRole)) {
      return { success: false, reason: `You need the <@&${giveaway.requiredRole}> role to enter.` };
    }
    const accountAge = Date.now() - member.user.createdTimestamp;
    if (accountAge < 7 * 24 * 60 * 60 * 1000) {
      return { success: false, reason: 'Your account is too new to enter giveaways.' };
    }

    giveaway.entries.push(userId);
    await giveaway.save();

    const channel = member.guild.channels.cache.get(giveaway.channelId) as TextChannel | undefined;
    if (channel && giveaway.messageId) {
      const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (msg) {
        const embed = GiveawayManager.buildEmbed(giveaway);
        await msg.edit({ embeds: [embed] }).catch(() => null);
      }
    }

    return { success: true };
  }

  static async reroll(giveaway: IGiveaway, guild: Guild, count = 1): Promise<string[]> {
    const nonWinners = giveaway.entries.filter((e) => !giveaway.winners.includes(e) && !giveaway.blacklist.includes(e));
    const newWinners = nonWinners.sort(() => Math.random() - 0.5).slice(0, count);

    const channel = guild.channels.cache.get(giveaway.channelId) as TextChannel | undefined;
    if (channel && newWinners.length > 0) {
      await channel.send({
        content: `🎉 Reroll! New winner(s): ${newWinners.map((w) => `<@${w}>`).join(', ')}! Congratulations!`,
      });
    }

    return newWinners;
  }

  static async checkExpired(client: import('discord.js').Client): Promise<void> {
    const expired = await GiveawayModel.find({
      status: 'active',
      endsAt: { $lte: new Date() },
    });

    for (const giveaway of expired) {
      try {
        const guild = client.guilds.cache.get(giveaway.guildId);
        if (!guild) continue;
        await GiveawayManager.end(giveaway, guild);
      } catch (err) {
        logger.error('Error ending giveaway:', err instanceof Error ? err : new Error(String(err)));
      }
    }
  }
}
