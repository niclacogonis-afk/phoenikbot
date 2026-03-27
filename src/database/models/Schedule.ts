import mongoose, { Document, Schema } from 'mongoose';

export interface ISchedule extends Document {
  guildId: string;
  channelId: string;
  userId: string;
  message: string;
  isEmbed: boolean;
  embedData: Record<string, string> | null;
  sendAt: Date;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  lastSentAt: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduleSchema = new Schema<ISchedule>(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    userId: { type: String, required: true },
    message: { type: String, required: true },
    isEmbed: { type: Boolean, default: false },
    embedData: { type: Schema.Types.Mixed, default: null },
    sendAt: { type: Date, required: true },
    repeat: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
    lastSentAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ScheduleModel = mongoose.model<ISchedule>('Schedule', ScheduleSchema);
