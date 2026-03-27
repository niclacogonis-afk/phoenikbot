import mongoose, { Document, Schema } from 'mongoose';

export interface IGlobalBan extends Document {
  discordId: string;
  robloxId: string | null;
  reason: string;
  bannedBy: string;
  bannedAt: Date;
}

const GlobalBanSchema = new Schema<IGlobalBan>({
  discordId: { type: String, required: true, unique: true, index: true },
  robloxId: { type: String, default: null, index: true },
  reason: { type: String, required: true },
  bannedBy: { type: String, required: true },
  bannedAt: { type: Date, default: Date.now },
});

export const GlobalBanModel = mongoose.model<IGlobalBan>('GlobalBan', GlobalBanSchema);
