import mongoose, { Document, Schema } from 'mongoose';

export interface IWeeklyLeaderboard extends Document {
  guildId: string;
  weekStart: Date;
  weekEnd: Date;
  entries: {
    userId: string;
    messages: number;
    voiceMinutes: number;
    coinsEarned: number;
    gambleWins: number;
    score: number;
  }[];
  prizes: {
    rank: number;
    coins: number;
  }[];
  finalized: boolean;
}

const WeeklyLeaderboardSchema = new Schema<IWeeklyLeaderboard>(
  {
    guildId: { type: String, required: true, index: true },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    entries: [{
      userId: { type: String, required: true },
      messages: { type: Number, default: 0 },
      voiceMinutes: { type: Number, default: 0 },
      coinsEarned: { type: Number, default: 0 },
      gambleWins: { type: Number, default: 0 },
      score: { type: Number, default: 0 },
    }],
    prizes: [{
      rank: { type: Number, required: true },
      coins: { type: Number, required: true },
    }],
    finalized: { type: Boolean, default: false },
  },
  { timestamps: true }
);

WeeklyLeaderboardSchema.index({ guildId: 1, weekStart: 1 }, { unique: true });

export const WeeklyLeaderboardModel = mongoose.model<IWeeklyLeaderboard>('WeeklyLeaderboard', WeeklyLeaderboardSchema);

export interface IWeeklyStats extends Document {
  guildId: string;
  userId: string;
  weekStart: Date;
  messages: number;
  voiceMinutes: number;
  coinsEarned: number;
  gambleWins: number;
  lastUpdated: Date;
}

const WeeklyStatsSchema = new Schema<IWeeklyStats>(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    weekStart: { type: Date, required: true },
    messages: { type: Number, default: 0 },
    voiceMinutes: { type: Number, default: 0 },
    coinsEarned: { type: Number, default: 0 },
    gambleWins: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

WeeklyStatsSchema.index({ guildId: 1, userId: 1, weekStart: 1 }, { unique: true });

export const WeeklyStatsModel = mongoose.model<IWeeklyStats>('WeeklyStats', WeeklyStatsSchema);
