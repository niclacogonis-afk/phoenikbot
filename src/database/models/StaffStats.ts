import mongoose, { Document, Schema } from 'mongoose';

export interface IStaffStats extends Document {
  guildId: string;
  userId: string;
  warns: number;
  mutes: number;
  bans: number;
  kicks: number;
  ticketsHandled: number;
  ticketsClaimed: number;
  messagesDeleted: number;
  createdAt: Date;
  updatedAt: Date;
}

const StaffStatsSchema = new Schema<IStaffStats>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    warns: { type: Number, default: 0 },
    mutes: { type: Number, default: 0 },
    bans: { type: Number, default: 0 },
    kicks: { type: Number, default: 0 },
    ticketsHandled: { type: Number, default: 0 },
    ticketsClaimed: { type: Number, default: 0 },
    messagesDeleted: { type: Number, default: 0 },
  },
  { timestamps: true }
);

StaffStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const StaffStatsModel = mongoose.model<IStaffStats>('StaffStats', StaffStatsSchema);

export async function incrementStat(
  guildId: string,
  userId: string,
  stat: keyof Omit<IStaffStats, keyof Document | 'guildId' | 'userId' | 'createdAt' | 'updatedAt'>,
  amount = 1
): Promise<void> {
  await StaffStatsModel.findOneAndUpdate(
    { guildId, userId },
    { $inc: { [stat]: amount } },
    { upsert: true }
  );
}
