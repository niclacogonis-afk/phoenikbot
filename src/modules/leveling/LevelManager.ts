import { Message, GuildMember, TextChannel, Role, EmbedBuilder } from 'discord.js';
import { 
  getLevelConfig, 
  getUserLevel, 
  UserLevelModel, 
  LevelRewardModel,
  xpForLevel,
  levelFromXp 
} from '../../database/models/LevelConfig';
import { logger } from '../../utils/logger';

/**
 * Leveling System Manager
 * Handles XP gain, level ups, and rewards
 */
export class LevelManager {
  /**
   * Process a message and award XP if eligible
   */
  static async onMessage(message: Message): Promise<{ xpGained: number; leveledUp: boolean; newLevel: number } | null> {
    if (message.author.bot || !message.guild) return null;

    const config = await getLevelConfig(message.guild.id);
    if (!config.enabled) return null;

    // Check exclusions
    if (config.excludeChannels.includes(message.channelId)) return null;
    if (message.member && config.excludeRoles.some(roleId => message.member!.roles.cache.has(roleId))) return null;
    
    // Check message length
    if (message.content.length < config.minMessageLength) return null;

    // Check cooldown
    const userLevel = await getUserLevel(message.guild.id, message.author.id);
    const now = Date.now();
    if (now - userLevel.lastMessageTime < config.cooldownMs) return null;

    // Award XP
    const xpGained = config.xpPerMessage;
    userLevel.xp += xpGained;
    userLevel.lastMessageTime = now;
    userLevel.totalMessages += 1;
    
    const oldLevel = userLevel.level;
    const { level: newLevel } = levelFromXp(userLevel.xp);
    userLevel.level = newLevel;
    
    await userLevel.save();

    const leveledUp = newLevel > oldLevel;

    if (leveledUp) {
      await LevelManager.handleLevelUp(message, newLevel, userLevel);
    }

    return { xpGained, leveledUp, newLevel };
  }

  /**
   * Handle level up - send message and grant rewards
   */
  static async handleLevelUp(context: Message | GuildMember, newLevel: number, userLevel: any): Promise<void> {
    let guildId: string;
    let userId: string;
    let guild = null as any;
    let member = null as any;

    if (typeof context === 'string') {
      guildId = context;
      userId = '';
    } else if (context instanceof Message) {
      guildId = context.guild?.id || '';
      userId = context.author?.id || '';
      guild = context.guild;
      member = context.member;
    } else {
      guildId = context.guild?.id || '';
      userId = context.user?.id || '';
      guild = context.guild;
      member = context;
    }

    const config = await getLevelConfig(guildId);

    // Send level up notification
    if (config.levelUpChannelId && guild) {
      const channel = guild.channels.cache.get(config.levelUpChannelId) as TextChannel;
      if (channel) {
        const message = config.levelUpMessage
          .replace('{user}', `<@${userId}>`)
          .replace('{level}', String(newLevel))
          .replace('{xp}', String(userLevel.xp));
        
        await channel.send(message).catch(() => {});
      }
    }

    // Grant level rewards
    if (config.rewardsEnabled && guild && member) {
      const rewards = await LevelRewardModel.find({ guildId, level: newLevel });
      for (const reward of rewards) {
        const role = guild.roles.cache.get(reward.roleId);
        if (role && !member.roles.cache.has(reward.roleId)) {
          await member.roles.add(role).catch(() => {});
        }
      }
    }

    logger.debug(`User ${userId} leveled up to ${newLevel} in guild ${guildId}`);
  }

  /**
   * Get user's rank in the server
   */
  static async getUserRank(guildId: string, userId: string): Promise<{ rank: number; total: number } | null> {
    const userLevel = await getUserLevel(guildId, userId);
    if (userLevel.xp === 0) return null;

    const higherOrEqual = await UserLevelModel.countDocuments({ 
      guildId, 
      xp: { $gte: userLevel.xp } 
    });
    const total = await UserLevelModel.countDocuments({ guildId });

    return { rank: higherOrEqual, total };
  }

  /**
   * Get leaderboard for a server
   */
  static async getLeaderboard(guildId: string, limit: number = 10): Promise<any[]> {
    const topUsers = await UserLevelModel.find({ guildId })
      .sort({ xp: -1 })
      .limit(limit);
    
    return topUsers.map((u, index) => ({
      rank: index + 1,
      userId: u.userId,
      xp: u.xp,
      level: u.level,
      totalMessages: u.totalMessages,
    }));
  }

  /**
   * Build a rank card embed for a user
   */
  static async buildRankEmbed(guildId: string, userId: string): Promise<EmbedBuilder | null> {
    const userLevel = await getUserLevel(guildId, userId);
    if (userLevel.xp === 0) return null;

    const { level, currentXp, xpToNext } = levelFromXp(userLevel.xp);
    const rank = await LevelManager.getUserRank(guildId, userId);
    const progress = Math.round((currentXp / xpToNext) * 100);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`Level ${level} | ${progress}% to Level ${level + 1}`)
      .addFields(
        { name: 'XP Progress', value: `${currentXp} / ${xpToNext} XP`, inline: true },
        { name: 'Total XP', value: `${userLevel.xp} XP`, inline: true },
        { name: 'Rank', value: rank ? `#${rank.rank} of ${rank.total}` : 'Unranked', inline: true },
        { name: 'Total Messages', value: String(userLevel.totalMessages), inline: true },
        { name: 'Voice Minutes', value: String(userLevel.totalVoiceMinutes), inline: true }
      )
      .setFooter({ text: 'Keep chatting to gain more XP!' });

    return embed;
  }

  /**
   * Reset user's level data
   */
  static async resetUserLevel(guildId: string, userId: string): Promise<void> {
    await UserLevelModel.deleteOne({ guildId, userId });
  }

  /**
   * Reset all level data for a server
   */
  static async resetServerLevels(guildId: string): Promise<number> {
    const result = await UserLevelModel.deleteMany({ guildId });
    return result.deletedCount || 0;
  }
}
