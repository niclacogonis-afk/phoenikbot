import mongoose, { Document, Schema } from 'mongoose';

export interface IStats extends Document {
  guildId: string;
  date: string;
  messages: number;
  joins: number;
  leaves: number;
  bans: number;
  warns: number;
  ticketsOpened: number;
  ticketsClosed: number;
  raidsBlocked: number;
  modActions: number;
  createdAt: Date;
  updatedAt: Date;
}

const StatsSchema = new Schema<IStats>(
  {
    guildId: { type: String, required: true, index: true },
    date: { type: String, required: true },
    messages: { type: Number, default: 0 },
    joins: { type: Number, default: 0 },
    leaves: { type: Number, default: 0 },
    bans: { type: Number, default: 0 },
    warns: { type: Number, default: 0 },
    ticketsOpened: { type: Number, default: 0 },
    ticketsClosed: { type: Number, default: 0 },
    raidsBlocked: { type: Number, default: 0 },
    modActions: { type: Number, default: 0 },
  },
  { timestamps: true }
);

StatsSchema.index({ guildId: 1, date: 1 }, { unique: true });

export const StatsModel = mongoose.model<IStats>('Stats', StatsSchema);

export async function incrementDailyStat(
  guildId: string,
  stat: keyof Omit<IStats, keyof Document | 'guildId' | 'date' | 'createdAt' | 'updatedAt'>,
  amount = 1
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]!;
  await StatsModel.findOneAndUpdate(
    { guildId, date: today },
    { $inc: { [stat]: amount } },
    { upsert: true }
  );
}
