import mongoose, { Document, Schema } from 'mongoose';

export interface ITwitchConfig extends Document {
  guildId: string;
  streamerName: string;
  streamerId: string | null;
  discordChannelId: string;
  pingRoleId: string | null;
  filterGames: string[];
  autoDeleteWhenOffline: boolean;
  lastMessageId: string | null;
  isLive: boolean;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TwitchConfigSchema = new Schema<ITwitchConfig>(
  {
    guildId: { type: String, required: true, index: true },
    streamerName: { type: String, required: true },
    streamerId: { type: String, default: null },
    discordChannelId: { type: String, required: true },
    pingRoleId: { type: String, default: null },
    filterGames: { type: [String], default: [] },
    autoDeleteWhenOffline: { type: Boolean, default: true },
    lastMessageId: { type: String, default: null },
    isLive: { type: Boolean, default: false },
    lastCheckedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

TwitchConfigSchema.index({ guildId: 1, streamerName: 1 }, { unique: true });

export const TwitchConfigModel = mongoose.model<ITwitchConfig>('TwitchConfig', TwitchConfigSchema);
