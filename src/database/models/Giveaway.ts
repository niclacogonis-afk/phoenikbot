import mongoose, { Document, Schema } from 'mongoose';

export interface IGiveaway extends Document {
  guildId: string;
  channelId: string;
  messageId: string | null;
  hostId: string;
  prize: string;
  description: string | null;
  winnerCount: number;
  entries: string[];
  blacklist: string[];
  winners: string[];
  requiredRole: string | null;
  endsAt: Date;
  status: 'active' | 'ended' | 'cancelled';
  isRigged: boolean;
  riggedWinner: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const GiveawaySchema = new Schema<IGiveaway>(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    hostId: { type: String, required: true },
    prize: { type: String, required: true },
    description: { type: String, default: null },
    winnerCount: { type: Number, default: 1, min: 1 },
    entries: { type: [String], default: [] },
    blacklist: { type: [String], default: [] },
    winners: { type: [String], default: [] },
    requiredRole: { type: String, default: null },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'ended', 'cancelled'], default: 'active' },
    isRigged: { type: Boolean, default: false },
    riggedWinner: { type: String, default: null },
  },
  { timestamps: true }
);

export const GiveawayModel = mongoose.model<IGiveaway>('Giveaway', GiveawaySchema);
