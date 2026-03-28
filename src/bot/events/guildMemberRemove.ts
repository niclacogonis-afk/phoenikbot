import { GuildMember, PartialGuildMember, EmbedBuilder } from 'discord.js';
import { BotEvent } from '../../types';
import { isModuleEnabled } from '../../modules/cache/CacheManager';
import { incrementDailyStat } from '../../database/models/Stats';
import { sendLog } from '../../modules/logging/LogManager';

const event: BotEvent = {
  name: 'guildMemberRemove',
  async execute(member: GuildMember | PartialGuildMember) {
    const guildId = member.guild.id;

    if (await isModuleEnabled(guildId, 'stats')) {
      await incrementDailyStat(guildId, 'leaves').catch(() => null);
    }

    if (await isModuleEnabled(guildId, 'logging')) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('👋 Member Left')
        .setThumbnail(member.user?.displayAvatarURL() ?? null)
        .addFields(
          { name: 'User', value: member.user ? `${member.user.tag}` : 'Unknown', inline: true },
          { name: 'ID', value: member.user?.id ?? 'Unknown', inline: true },
          { name: 'Members', value: `${member.guild.memberCount}`, inline: true }
        )
        .setTimestamp();
      await sendLog(member.guild, embed);
    }
  },
};

export default event;
