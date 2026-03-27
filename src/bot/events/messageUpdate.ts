import { Message, PartialMessage, EmbedBuilder } from 'discord.js';
import { BotEvent } from '../../types';
import { isModuleEnabled } from '../cache/CacheManager';
import { sendLog } from '../logging/LogManager';
import { truncate } from '../../utils/formatters';

const event: BotEvent = {
  name: 'messageUpdate',
  async execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    if (!await isModuleEnabled(newMessage.guild.id, 'logging')) return;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('✏️ Message Edited')
      .setURL(newMessage.url)
      .addFields(
        { name: 'Author', value: newMessage.author ? `${newMessage.author.tag} (${newMessage.author.id})` : 'Unknown', inline: true },
        { name: 'Channel', value: `<#${newMessage.channel.id}>`, inline: true },
        { name: 'Before', value: truncate(oldMessage.content ?? '[no content]', 512) },
        { name: 'After', value: truncate(newMessage.content ?? '[no content]', 512) }
      )
      .setTimestamp();

    await sendLog(newMessage.guild, embed);
  },
};

export default event;
