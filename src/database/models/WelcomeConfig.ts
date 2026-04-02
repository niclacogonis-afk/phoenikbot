import mongoose, { Document, Schema } from 'mongoose';

export interface IWelcomeConfig extends Document {
  guildId: string;
  welcomeChannelId: string | null;
  welcomeMessageEnabled: boolean;
  welcomeMessage: string;
  welcomeEmbedEnabled: boolean;
  welcomeEmbedTitle: string;
  welcomeEmbedDescription: string;
  welcomeEmbedColor: string;
  welcomeEmbedImage: string | null;
  welcomeEmbedThumbnail: string | null;
  welcomeEmbedFooter: string | null;
  autoRoleIds: string[];
  autoRoleDelay: number; // ms before applying roles (0 = immediately)
  leaveMessageEnabled: boolean;
  leaveChannelId: string | null;
  leaveMessage: string;
  leaveEmbedEnabled: boolean;
  leaveEmbedTitle: string;
  leaveEmbedDescription: string;
  leaveEmbedColor: string;
  createdAt: Date;
  updatedAt: Date;
}

const WelcomeConfigSchema = new Schema<IWelcomeConfig>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    welcomeChannelId: { type: String, default: null },
    welcomeMessageEnabled: { type: Boolean, default: true },
    welcomeMessage: {
      type: String,
      default: 'Welcome {user} to {server}! You are member #{count}!'
    },
    welcomeEmbedEnabled: { type: Boolean, default: true },
    welcomeEmbedTitle: { type: String, default: '🎉 Welcome!' },
    welcomeEmbedDescription: { 
      type: String, 
      default: 'Welcome {user} to **{server}**!\n\n{member_count} members total. Make sure to read the rules!' 
    },
    welcomeEmbedColor: { type: String, default: '#5865F2' },
    welcomeEmbedImage: { type: String, default: null },
    welcomeEmbedThumbnail: { type: String, default: null },
    welcomeEmbedFooter: { type: String, default: null },
    autoRoleIds: { type: [String], default: [] },
    autoRoleDelay: { type: Number, default: 0 },
    leaveMessageEnabled: { type: Boolean, default: false },
    leaveChannelId: { type: String, default: null },
    leaveMessage: { type: String, default: '{user} left {server}.' },
    leaveEmbedEnabled: { type: Boolean, default: true },
    leaveEmbedTitle: { type: String, default: '👋 Member Left' },
    leaveEmbedDescription: { type: String, default: '{user} left the server.' },
    leaveEmbedColor: { type: String, default: '#ED4245' },
  },
  { timestamps: true }
);

export const WelcomeConfigModel = mongoose.model<IWelcomeConfig>('WelcomeConfig', WelcomeConfigSchema);

export async function getWelcomeConfig(guildId: string): Promise<IWelcomeConfig> {
  let config = await WelcomeConfigModel.findOne({ guildId });
  if (!config) {
    config = await WelcomeConfigModel.create({ guildId });
  }
  return config;
}
