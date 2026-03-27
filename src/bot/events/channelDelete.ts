import { GuildChannel, EmbedBuilder } from 'discord.js';
import { BotEvent } from '../../types';
import { isModuleEnabled } from '../cache/CacheManager';
import { sendLog } from '../logging/LogManager';

const event: BotEvent = {
  name: 'channelDelete',
  async execute(channel: GuildChannel) {
    if (!channel.guild) return;
    const guildId = channel.guild.id;

    if (await isModuleEnabled(guildId, 'antinuke')) {
      const { AntiNuke } = await import('../antirAid/AntiNuke');
      await AntiNuke.onChannelDelete(channel).catch(() => null);
    }

    if (await isModuleEnabled(guildId, 'logging')) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('📛 Channel Deleted')
        .addFields(
          { name: 'Name', value: channel.name, inline: true },
          { name: 'Type', value: String(channel.type), inline: true },
          { name: 'ID', value: channel.id, inline: true }
        )
        .setTimestamp();
      await sendLog(channel.guild, embed);
    }
  },
};

export default event;
