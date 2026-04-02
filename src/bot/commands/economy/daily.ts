import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../../types';
import { EconomyManager } from '../../../modules/economy/EconomyManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward'),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;

    const result = await EconomyManager.claimDaily(interaction.member as any);

    const embed = new EmbedBuilder()
      .setColor(result.success ? 0x57F287 : 0xED4245)
      .setTitle(result.success ? '🎉 Daily Reward Claimed!' : '⏰ Cooldown')
      .setDescription(result.message);

    if (result.success) {
      embed.addFields({ name: '🔥 Streak', value: `${result.streak} days`, inline: true });
    }

    await interaction.reply({ embeds: [embed], ephemeral: !result.success });
  },
};

export default command;
