import mongoose, { Document, Schema } from 'mongoose';

export interface IYouTubeConfig extends Document {
  guildId: string;
  channelId: string;
  youtubeChannelId: string;
  youtubeChannelName: string;
  discordChannelId: string;
  pingRoleId: string | null;
  customMessage: string | null;
  filterShorts: boolean;
  filterLives: boolean;
  lastVideoId: string | null;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const YouTubeConfigSchema = new Schema<IYouTubeConfig>(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    youtubeChannelId: { type: String, required: true },
    youtubeChannelName: { type: String, required: true },
    discordChannelId: { type: String, required: true },
    pingRoleId: { type: String, default: null },
    customMessage: { type: String, default: null },
    filterShorts: { type: Boolean, default: true },
    filterLives: { type: Boolean, default: false },
    lastVideoId: { type: String, default: null },
    lastCheckedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

YouTubeConfigSchema.index({ guildId: 1, youtubeChannelId: 1 }, { unique: true });

export const YouTubeConfigModel = mongoose.model<IYouTubeConfig>('YouTubeConfig', YouTubeConfigSchema);
