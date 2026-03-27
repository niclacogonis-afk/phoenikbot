import { Message, PartialMessage, EmbedBuilder } from 'discord.js';
import { BotEvent } from '../../types';
import { isModuleEnabled } from '../cache/CacheManager';
import { sendLog } from '../logging/LogManager';
import { truncate } from '../../utils/formatters';

const event: BotEvent = {
  name: 'messageDelete',
  async execute(message: Message | PartialMessage) {
    if (!message.guild || message.author?.bot) return;
    if (!await isModuleEnabled(message.guild.id, 'logging')) return;

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🗑️ Message Deleted')
      .addFields(
        { name: 'Author', value: message.author ? `${message.author.tag} (${message.author.id})` : 'Unknown', inline: true },
        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
        { name: 'Content', value: truncate(message.content ?? '[no content]', 1024) }
      )
      .setTimestamp();

    if (message.attachments.size > 0) {
      embed.addFields({ name: 'Attachments', value: `${message.attachments.size} attachment(s)` });
    }

    await sendLog(message.guild, embed);
  },
};

export default event;
