import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { WeeklyLeaderboardModel, WeeklyStatsModel } from '../../database/models/WeeklyLeaderboard';
import { getUserWallet } from '../../database/models/Economy';
import { logger } from '../../utils/logger';

const DEFAULT_PRIZES = [
  { rank: 1, coins: 1000 },
  { rank: 2, coins: 500 },
  { rank: 3, coins: 250 },
  { rank: 4, coins: 100 },
  { rank: 5, coins: 50 },
];

export class WeeklyLeaderboardManager {

  static getWeekStart(): Date {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  static getWeekEnd(): Date {
    const start = this.getWeekStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return end;
  }

  static async trackMessage(guildId: string, userId: string): Promise<void> {
    const weekStart = this.getWeekStart();
    await WeeklyStatsModel.findOneAndUpdate(
      { guildId, userId, weekStart },
      { $inc: { messages: 1 }, $set: { lastUpdated: new Date() } },
      { upsert: true }
    );
  }

  static async trackCoinEarn(guildId: string, userId: string, amount: number): Promise<void> {
    const weekStart = this.getWeekStart();
    await WeeklyStatsModel.findOneAndUpdate(
      { guildId, userId, weekStart },
      { $inc: { coinsEarned: amount }, $set: { lastUpdated: new Date() } },
      { upsert: true }
    );
  }

  static async trackGambleWin(guildId: string, userId: string): Promise<void> {
    const weekStart = this.getWeekStart();
    await WeeklyStatsModel.findOneAndUpdate(
      { guildId, userId, weekStart },
      { $inc: { gambleWins: 1 }, $set: { lastUpdated: new Date() } },
      { upsert: true }
    );
  }

  static async getLeaderboard(guildId: string) {
    const weekStart = this.getWeekStart();
    const stats = await WeeklyStatsModel.find({ guildId, weekStart })
      .sort({ messages: -1 })
      .limit(10);

    return stats.map((s, i) => ({
      rank: i + 1,
      userId: s.userId,
      messages: s.messages,
      coinsEarned: s.coinsEarned,
      gambleWins: s.gambleWins,
      score: s.messages * 1 + s.coinsEarned * 0.1 + s.gambleWins * 10,
    }));
  }

  static async finalizeWeek(client: Client): Promise<void> {
    const weekStart = this.getWeekStart();
    const weekEnd = this.getWeekEnd();
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    for (const guild of client.guilds.cache.values()) {
      try {
        // Check if already finalized
        const existing = await WeeklyLeaderboardModel.findOne({ guildId: guild.id, weekStart: previousWeekStart });
        if (existing?.finalized) continue;

        // Get stats for previous week
        const stats = await WeeklyStatsModel.find({ guildId: guild.id, weekStart: previousWeekStart })
          .sort({ messages: -1 })
          .limit(10);

        if (stats.length === 0) continue;

        const entries = stats.map(s => ({
          userId: s.userId,
          messages: s.messages,
          voiceMinutes: s.voiceMinutes,
          coinsEarned: s.coinsEarned,
          gambleWins: s.gambleWins,
          score: s.messages * 1 + s.coinsEarned * 0.1 + s.gambleWins * 10,
        }));

        // Give prizes
        for (const entry of entries) {
          const prize = DEFAULT_PRIZES.find(p => p.rank === entries.indexOf(entry) + 1);
          if (prize) {
            const wallet = await getUserWallet(guild.id, entry.userId);
            wallet.balance += prize.coins;
            wallet.totalEarned += prize.coins;
            await wallet.save();
          }
        }

        // Save finalized leaderboard
        await WeeklyLeaderboardModel.findOneAndUpdate(
          { guildId: guild.id, weekStart: previousWeekStart },
          { entries, prizes: DEFAULT_PRIZES, weekEnd: weekStart, finalized: true },
          { upsert: true }
        );

        logger.info(`Weekly leaderboard finalized for ${guild.name}`);
      } catch (err) {
        logger.error(`Weekly leaderboard error for ${guild.name}:`, err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  static async announceLeaderboard(client: Client): Promise<void> {
    const weekStart = this.getWeekStart();
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    for (const guild of client.guilds.cache.values()) {
      try {
        const lb = await WeeklyLeaderboardModel.findOne({ guildId: guild.id, weekStart: previousWeekStart, finalized: true });
        if (!lb || lb.entries.length === 0) continue;

        const lines = lb.entries.slice(0, 5).map((e, i) => {
          const prize = DEFAULT_PRIZES.find(p => p.rank === i + 1);
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**#${i + 1}**`;
          return `${medal} <@${e.userId}> — ${e.messages} messages — **${prize?.coins || 0}** coins`;
        });

        const embed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('Weekly Leaderboard - Final Results')
          .setDescription(lines.join('\n'))
          .setFooter({ text: 'New week has started! Compete for the top spots!' })
          .setTimestamp();

        // Try to find a general channel
        const channel = guild.channels.cache.find(c =>
          c.isTextBased() && (c.name === 'general' || c.name === 'chat' || c.name === 'lobby')
        ) as TextChannel | undefined;

        if (channel) {
          await channel.send({ embeds: [embed] });
        }
      } catch { }
    }
  }
}
