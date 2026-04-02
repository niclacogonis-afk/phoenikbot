import mongoose, { Document, Schema } from 'mongoose';

export interface IChallenge extends Document {
  guildId: string;
  name: string;
  description: string;
  type: 'messages' | 'voice_minutes' | 'daily_streak' | 'wins' | 'custom';
  target: number;
  reward: number;
  active: boolean;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface IUserQuest extends Document {
  guildId: string;
  userId: string;
  challengeId: string;
  progress: number;
  completed: boolean;
  completedAt: Date | null;
  claimedAt: Date | null;
}

const ChallengeSchema = new Schema<IChallenge>(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['messages', 'voice_minutes', 'daily_streak', 'wins', 'custom'], required: true },
    target: { type: Number, required: true },
    reward: { type: Number, required: true },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const UserQuestSchema = new Schema<IUserQuest>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    challengeId: { type: String, required: true },
    progress: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    claimedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

UserQuestSchema.index({ guildId: 1, userId: 1, challengeId: 1 }, { unique: true });

export const ChallengeModel = mongoose.model<IChallenge>('Challenge', ChallengeSchema);
export const UserQuestModel = mongoose.model<IUserQuest>('UserQuest', UserQuestSchema);
