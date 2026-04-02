import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { Command } from '../../../types';
import { LevelManager } from '../../../modules/leveling/LevelManager';
import { getLevelConfig } from '../../../database/models/LevelConfig';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server XP leaderboard')
    .addIntegerOption(option =>
      option.setName('page')
        .setDescription('Page number (default: 1)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const page = interaction.options.getInteger('page') || 1;

    const config = await getLevelConfig(guildId);
    if (!config.enabled) {
      await interaction.reply({ content: '❌ The leveling system is not enabled on this server.', ephemeral: true });
      return;
    }

    const leaderboard = await LevelManager.getLeaderboard(guildId, 10);
    
    if (leaderboard.length === 0) {
      await interaction.reply({ content: '❌ No one has earned XP yet!', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🏆 XP Leaderboard - Page ${page}`)
      .setDescription('');

    let description = '';
    for (const entry of leaderboard) {
      const member = await interaction.guild?.members.fetch(entry.userId).catch(() => null);
      const displayName = member?.displayName || `<@${entry.userId}>`;
      
      let medal = '';
      if (entry.rank === 1) medal = '🥇';
      else if (entry.rank === 2) medal = '🥈';
      else if (entry.rank === 3) medal = '🥉';
      else medal = `#${entry.rank}`;
      
      description += `${medal} **${displayName}** - Level ${entry.level} (${entry.xp} XP)\n`;
    }

    embed.setDescription(description);
    embed.setFooter({ text: `Use /rank to check your own rank!` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
