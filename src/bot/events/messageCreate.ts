import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BotEvent } from '../../types';
import { LevelManager } from '../../modules/leveling/LevelManager';
import { EconomyManager } from '../../modules/economy/EconomyManager';
import { ChallengeManager } from '../../modules/challenges/ChallengeManager';
import { WeeklyLeaderboardManager } from '../../modules/leaderboard/WeeklyLeaderboardManager';
import { AutoResponseModel } from '../../database/models/AutoResponse';

const event: BotEvent = {
  name: 'messageCreate',
  async execute(message: Message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    try { await LevelManager.onMessage(message); } catch { }
    try { await EconomyManager.onMessage(message); } catch { }
    try { await ChallengeManager.onMessage(message); } catch { }
    try { await WeeklyLeaderboardManager.trackMessage(message.guild.id, message.author.id); } catch { }

    // Check auto-responses
    try {
      const content = message.content.toLowerCase().trim();
      if (!content) return;

      const responses = await AutoResponseModel.find({ guildId: message.guild.id });
      if (!responses.length) return;

      for (const ar of responses) {
        const triggered = ar.triggers.some(trigger => {
          const t = trigger.toLowerCase();
          return content === t || content.includes(t);
        });

        if (!triggered) continue;

        // Check cooldown
        const lastTrigger = ar.lastTriggered?.get(message.author.id) ?? 0;
        const cooldownMs = (ar.cooldownSeconds || 30) * 1000;
        if (Date.now() - lastTrigger < cooldownMs) continue;

        // Update cooldown
        if (!ar.lastTriggered) ar.lastTriggered = new Map();
        ar.lastTriggered.set(message.author.id, Date.now());
        await ar.save();

        // Send response
        if (ar.isEmbed && ar.embedData) {
          const embed = new EmbedBuilder();
          if (ar.embedData.title) embed.setTitle(ar.embedData.title);
          if (ar.embedData.description) embed.setDescription(ar.embedData.description);
          if (ar.embedData.color) embed.setColor(ar.embedData.color as any);
          if (ar.embedData.footer) embed.setFooter({ text: ar.embedData.footer });
          if (ar.embedData.thumbnail) embed.setThumbnail(ar.embedData.thumbnail);
          if (ar.embedData.image) embed.setImage(ar.embedData.image);

          const components: ActionRowBuilder<ButtonBuilder>[] = [];
          if (ar.includeTicketButton) {
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('ticket:create')
                .setLabel('Open Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫')
            );
            components.push(row);
          }

          if ('send' in message.channel) {
            await message.channel.send({
              embeds: [embed],
              components: components.length ? components : undefined,
            });
          }
        } else {
          let text = ar.response
            .replace(/{user}/g, `<@${message.author.id}>`)
            .replace(/{username}/g, message.author.username)
            .replace(/{server}/g, message.guild.name)
            .replace(/{channel}/g, `<#${message.channel.id}>`);

          const components: ActionRowBuilder<ButtonBuilder>[] = [];
          if (ar.includeTicketButton) {
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('ticket:create')
                .setLabel('Open Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫')
            );
            components.push(row);
          }

          if ('send' in message.channel) {
            await message.channel.send({
              content: text,
              components: components.length ? components : undefined,
            });
          }
        }

        break; // Only trigger one response per message
      }
    } catch { }
  },
};

export default event;
