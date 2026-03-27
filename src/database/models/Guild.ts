import mongoose, { Document, Schema } from 'mongoose';
import { GuildModules } from '../../types';

export interface IGuild extends Document {
  guildId: string;
  modules: GuildModules;
  logChannel: string | null;
  modLogChannel: string | null;
  suggestionsChannel: string | null;
  staffRoles: string[];
  adminRoles: string[];
  autoModThresholds: {
    raidJoins: number;
    raidSeconds: number;
    nukeChannelDeletes: number;
    nukeBans: number;
    nukeRoleDeletes: number;
    nukeWindowSeconds: number;
    warnMuteThreshold: number;
    warnBanThreshold: number;
    muteDuration: number;
  };
  antilink: {
    whitelist: string[];
    blacklist: string[];
    enabled: boolean;
    action: 'delete' | 'delete_warn' | 'delete_timeout';
  };
  createdAt: Date;
  updatedAt: Date;
}

const GuildSchema = new Schema<IGuild>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    modules: {
      ticket: { type: Boolean, default: false },
      giveaway: { type: Boolean, default: false },
      verification: { type: Boolean, default: false },
      antirAid: { type: Boolean, default: false },
      antinuke: { type: Boolean, default: false },
      antilink: { type: Boolean, default: false },
      logging: { type: Boolean, default: false },
      youtube: { type: Boolean, default: false },
      twitch: { type: Boolean, default: false },
      roblox: { type: Boolean, default: false },
      ai: { type: Boolean, default: false },
      suggestions: { type: Boolean, default: false },
      reactionRoles: { type: Boolean, default: false },
      stats: { type: Boolean, default: false },
      schedule: { type: Boolean, default: false },
      backup: { type: Boolean, default: false },
      minigames: { type: Boolean, default: false },
      moderation: { type: Boolean, default: true },
    },
    logChannel: { type: String, default: null },
    modLogChannel: { type: String, default: null },
    suggestionsChannel: { type: String, default: null },
    staffRoles: { type: [String], default: [] },
    adminRoles: { type: [String], default: [] },
    autoModThresholds: {
      raidJoins: { type: Number, default: 10 },
      raidSeconds: { type: Number, default: 5 },
      nukeChannelDeletes: { type: Number, default: 3 },
      nukeBans: { type: Number, default: 5 },
      nukeRoleDeletes: { type: Number, default: 3 },
      nukeWindowSeconds: { type: Number, default: 30 },
      warnMuteThreshold: { type: Number, default: 3 },
      warnBanThreshold: { type: Number, default: 5 },
      muteDuration: { type: Number, default: 3600000 },
    },
    antilink: {
      whitelist: { type: [String], default: ['youtube.com', 'youtu.be', 'roblox.com', 'discord.com', 'discord.gg', 'twitch.tv'] },
      blacklist: { type: [String], default: [] },
      enabled: { type: Boolean, default: false },
      action: { type: String, enum: ['delete', 'delete_warn', 'delete_timeout'], default: 'delete_warn' },
    },
  },
  { timestamps: true }
);

export const GuildModel = mongoose.model<IGuild>('Guild', GuildSchema);

export async function getGuild(guildId: string): Promise<IGuild> {
  let guild = await GuildModel.findOne({ guildId });
  if (!guild) {
    guild = await GuildModel.create({ guildId });
  }
  return guild;
}
