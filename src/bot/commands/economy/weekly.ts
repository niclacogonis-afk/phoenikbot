import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../../types';
import { BotClient } from '../../client';
import { WeeklyLeaderboardManager } from '../../../modules/leaderboard/WeeklyLeaderboardManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('weekly')
    .setDescription('View the weekly leaderboard and compete for prizes!') as SlashCommandBuilder,

  category: 'Economy',

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guildId) return;

    const entries = await WeeklyLeaderboardManager.getLeaderboard(interaction.guildId);

    if (entries.length === 0) {
      await interaction.reply({ content: 'No activity this week yet. Start chatting, gambling, or earning coins to appear on the leaderboard!', ephemeral: true });
      return;
    }

    const prizes = [
      { rank: 1, coins: 1000, medal: '🥇' },
      { rank: 2, coins: 500, medal: '🥈' },
      { rank: 3, coins: 250, medal: '🥉' },
      { rank: 4, coins: 100, medal: '4️⃣' },
      { rank: 5, coins: 50, medal: '5️⃣' },
    ];

    const lines = entries.map((e, i) => {
      const prize = prizes.find(p => p.rank === i + 1);
      const prizeText = prize ? ` — Prize: **${prize.coins}** coins` : '';
      const medal = i < 5 ? prizes[i]!.medal : `**#${i + 1}**`;
      return `${medal} <@${e.userId}> — ${e.messages} msgs | ${e.coinsEarned} coins earned | ${e.gambleWins} wins${prizeText}`;
    });

    const weekStart = WeeklyLeaderboardManager.getWeekStart();
    const weekEnd = WeeklyLeaderboardManager.getWeekEnd();

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('Weekly Leaderboard')
      .setDescription(lines.join('\n\n'))
      .addFields({
        name: 'Prizes',
        value: prizes.map(p => `${p.medal} #${p.rank}: **${p.coins}** coins`).join('\n'),
        inline: false
      })
      .setFooter({ text: `Week: ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()} | Ends Sunday at midnight` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
