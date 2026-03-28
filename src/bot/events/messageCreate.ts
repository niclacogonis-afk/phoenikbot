import { Message } from 'discord.js';
import { BotEvent } from '../../types';
import { isModuleEnabled } from '../../modules/cache/CacheManager';
import { incrementDailyStat } from '../../database/models/Stats';
import { AutoResponseModel } from '../../database/models/AutoResponse';

const event: BotEvent = {
  name: 'messageCreate',
  async execute(message: Message) {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;

    if (await isModuleEnabled(guildId, 'stats')) {
      await incrementDailyStat(guildId, 'messages').catch(() => null);
    }

    if (await isModuleEnabled(guildId, 'antilink')) {
      const { AntiLink } = await import('../../modules/antilink/AntiLink');
      await AntiLink.check(message).catch(() => null);
    }

    if (await isModuleEnabled(guildId, 'ai')) {
      const { AIModeration } = await import('../../modules/ai/AIModeration');
      await AIModeration.analyze(message).catch(() => null);
    }

    if (await isModuleEnabled(guildId, 'moderation')) {
      await checkAutoResponse(message).catch(() => null);
    }
  },
};

async function checkAutoResponse(message: Message) {
  if (!message.guild) return;
  const guildId = message.guild.id;
  const content = message.content.toLowerCase();

  const responses = await AutoResponseModel.find({ guildId });
  for (const ar of responses) {
    const triggered = ar.triggers.some((t) => content.includes(t.toLowerCase()));
    if (!triggered) continue;

    const channelKey = `${guildId}:${message.channel.id}`;
    const lastTime = ar.lastTriggered.get(channelKey) ?? 0;
    if (Date.now() - lastTime < ar.cooldownSeconds * 1000) continue;

    ar.lastTriggered.set(channelKey, Date.now());
    await ar.save();

    if (ar.isEmbed && ar.embedData) {
      const { EmbedBuilder } = await import('discord.js');
      const embed = new EmbedBuilder();
      const d = ar.embedData as Record<string, string>;
      if (d['title']) embed.setTitle(d['title']);
      if (d['description']) embed.setDescription(d['description']);
      if (d['color']) embed.setColor(d['color'] as `#${string}`);
      await message.reply({ embeds: [embed] });
    } else {
      await message.reply(ar.response);
    }
    break;
  }
}

export default event;
