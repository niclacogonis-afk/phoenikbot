import mongoose, { Document, Schema } from 'mongoose';

interface IWarn {
  id: string;
  reason: string;
  moderatorId: string;
  timestamp: Date;
}

interface IMute {
  reason: string;
  moderatorId: string;
  duration: number;
  endsAt: Date;
  timestamp: Date;
}

export interface IUser extends Document {
  guildId: string;
  userId: string;
  warns: IWarn[];
  mutes: IMute[];
  riskScore: number;
  riskFlags: string[];
  robloxId: string | null;
  robloxUsername: string | null;
  verified: boolean;
  verifiedAt: Date | null;
  verificationCode: string | null;
  verificationExpires: Date | null;
  captchaCode: string | null;
  captchaExpires: Date | null;
  captchaAttempts: number;
  lastMessageAt: Date | null;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    warns: [
      {
        id: String,
        reason: String,
        moderatorId: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    mutes: [
      {
        reason: String,
        moderatorId: String,
        duration: Number,
        endsAt: Date,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    riskFlags: { type: [String], default: [] },
    robloxId: { type: String, default: null },
    robloxUsername: { type: String, default: null },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    verificationCode: { type: String, default: null },
    verificationExpires: { type: Date, default: null },
    captchaCode: { type: String, default: null },
    captchaExpires: { type: Date, default: null },
    captchaAttempts: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: null },
    messageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

UserSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const UserModel = mongoose.model<IUser>('User', UserSchema);

export async function getUser(guildId: string, userId: string): Promise<IUser> {
  let user = await UserModel.findOne({ guildId, userId });
  if (!user) {
    user = await UserModel.create({ guildId, userId });
  }
  return user;
}
