import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, User } from 'discord.js';
import { Command } from '../../../types';
import { LevelManager } from '../../../modules/leveling/LevelManager';
import { getLevelConfig, levelFromXp } from '../../../database/models/LevelConfig';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your or another user\'s rank and XP')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to check rank for (default: yourself)')
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId!;

    const config = await getLevelConfig(guildId);
    if (!config.enabled) {
      await interaction.reply({ content: '❌ The leveling system is not enabled on this server.', ephemeral: true });
      return;
    }

    const embed = await LevelManager.buildRankEmbed(guildId, user.id);
    
    if (!embed) {
      await interaction.reply({ content: `❌ ${user.username} hasn't earned any XP yet!`, ephemeral: true });
      return;
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
