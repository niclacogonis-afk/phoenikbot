import mongoose, { Document, Schema } from 'mongoose';

export interface ILevelConfig extends Document {
  guildId: string;
  enabled: boolean;
  xpPerMessage: number;
  xpPerMinuteVoice: number;
  cooldownMs: number;
  levelUpChannelId: string | null;
  levelUpMessage: string;
  excludeChannels: string[];
  excludeRoles: string[];
  minMessageLength: number;
  rewardsEnabled: boolean;
}

const LevelConfigSchema = new Schema<ILevelConfig>({
  guildId: { type: String, required: true, unique: true, index: true },
  enabled: { type: Boolean, default: false },
  xpPerMessage: { type: Number, default: 15 },
  xpPerMinuteVoice: { type: Number, default: 10 },
  cooldownMs: { type: Number, default: 30000 },
  levelUpChannelId: { type: String, default: null },
  levelUpMessage: { type: String, default: '🎉 {user} has reached level {level}!' },
  excludeChannels: { type: [String], default: [] },
  excludeRoles: { type: [String], default: [] },
  minMessageLength: { type: Number, default: 5 },
  rewardsEnabled: { type: Boolean, default: false },
}, { timestamps: true });

export const LevelConfigModel = mongoose.model<ILevelConfig>('LevelConfig', LevelConfigSchema);

export async function getLevelConfig(guildId: string): Promise<ILevelConfig> {
  let config = await LevelConfigModel.findOne({ guildId });
  if (!config) {
    config = await LevelConfigModel.create({ guildId });
  }
  return config;
}

// XP/User Level tracking
export interface IUserLevel extends Document {
  guildId: string;
  userId: string;
  xp: number;
  level: number;
  lastMessageTime: number;
  totalMessages: number;
  totalVoiceMinutes: number;
}

const UserLevelSchema = new Schema<IUserLevel>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
  lastMessageTime: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },
  totalVoiceMinutes: { type: Number, default: 0 },
}, { timestamps: true });

UserLevelSchema.index({ guildId: 1, userId: 1 }, { unique: true });
UserLevelSchema.index({ guildId: 1, level: -1 });

export const UserLevelModel = mongoose.model<IUserLevel>('UserLevel', UserLevelSchema);

export async function getUserLevel(guildId: string, userId: string): Promise<IUserLevel> {
  let userLevel = await UserLevelModel.findOne({ guildId, userId });
  if (!userLevel) {
    userLevel = await UserLevelModel.create({ guildId, userId });
  }
  return userLevel;
}

// Level up rewards
export interface ILevelReward extends Document {
  guildId: string;
  level: number;
  roleId: string;
}

const LevelRewardSchema = new Schema<ILevelReward>({
  guildId: { type: String, required: true, index: true },
  level: { type: Number, required: true },
  roleId: { type: String, required: true },
});

LevelRewardSchema.index({ guildId: 1, level: 1 }, { unique: true });

export const LevelRewardModel = mongoose.model<ILevelReward>('LevelReward', LevelRewardSchema);

/**
 * Calculate XP needed for a specific level
 * Formula: 100 * level + 50 * level^1.5 (adjustable)
 */
export function xpForLevel(level: number): number {
  return Math.floor(100 * level + 50 * Math.pow(level, 1.5));
}

/**
 * Calculate level from total XP
 */
export function levelFromXp(totalXp: number): { level: number; currentXp: number; xpToNext: number } {
  let level = 0;
  let xpNeeded = 0;
  
  while (xpNeeded + xpForLevel(level + 1) <= totalXp) {
    xpNeeded += xpForLevel(level + 1);
    level++;
  }
  
  const currentXp = totalXp - xpNeeded;
  const xpToNext = xpForLevel(level + 1);
  
  return { level, currentXp, xpToNext };
}
