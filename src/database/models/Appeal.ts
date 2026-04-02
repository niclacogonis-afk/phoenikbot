import mongoose, { Document, Schema } from 'mongoose';

export type AppealStatus = 'pending' | 'approved' | 'rejected';

export interface IAppeal extends Document {
  guildId: string;
  userId: string;
  userTag: string;
  appealType: 'ban' | 'mute' | 'timeout' | 'warn';
  reason: string;
  appealMessage: string;
  status: AppealStatus;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

const AppealSchema = new Schema<IAppeal>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  userTag: { type: String, required: true },
  appealType: { type: String, enum: ['ban', 'mute', 'timeout', 'warn'], required: true },
  reason: { type: String, required: true },
  appealMessage: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: { type: String, default: null },
  reviewNote: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date, default: null },
});

AppealSchema.index({ guildId: 1, status: 1 });

export const AppealModel = mongoose.model<IAppeal>('Appeal', AppealSchema);

// Helper functions
export async function createAppeal(
  guildId: string,
  userId: string,
  userTag: string,
  appealType: IAppeal['appealType'],
  reason: string,
  appealMessage: string
): Promise<IAppeal> {
  return AppealModel.create({
    guildId,
    userId,
    userTag,
    appealType,
    reason,
    appealMessage,
    status: 'pending',
    reviewedBy: null,
    reviewNote: null,
    createdAt: new Date(),
    reviewedAt: null,
  });
}

export async function getPendingAppeals(guildId: string): Promise<IAppeal[]> {
  return AppealModel.find({ guildId, status: 'pending' }).sort({ createdAt: -1 });
}

export async function getUserAppeal(guildId: string, userId: string): Promise<IAppeal | null> {
  return AppealModel.findOne({ guildId, userId, status: 'pending' });
}

export async function hasActiveAppeal(guildId: string, userId: string): Promise<boolean> {
  const appeal = await AppealModel.findOne({ guildId, userId, status: 'pending' });
  return !!appeal;
}

export async function reviewAppeal(
  appealId: string,
  status: AppealStatus,
  reviewedBy: string,
  reviewNote?: string
): Promise<IAppeal | null> {
  return AppealModel.findByIdAndUpdate(
    appealId,
    {
      status,
      reviewedBy,
      reviewNote: reviewNote || null,
      reviewedAt: new Date(),
    },
    { new: true }
  );
}

export async function getAppealHistory(guildId: string, userId: string): Promise<IAppeal[]> {
  return AppealModel.find({ guildId, userId }).sort({ createdAt: -1 });
}

export async function getGuildAppealStats(guildId: string): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}> {
  const stats = await AppealModel.aggregate([
    { $match: { guildId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
  
  const result = { pending: 0, approved: 0, rejected: 0, total: 0 };
  for (const stat of stats) {
    result[stat._id as AppealStatus] = stat.count;
    result.total += stat.count;
  }
  
  return result;
}
