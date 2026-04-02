import mongoose, { Document, Schema } from 'mongoose';

export interface IPermissionOverride extends Document {
  guildId: string;
  commandName: string;
  allowedRoles: string[];
  disallowedRoles: string[];
  allowedChannels: string[];
  disallowedChannels: string[];
  cooldownSeconds: number;
  enabled: boolean;
}

const PermissionOverrideSchema = new Schema<IPermissionOverride>({
  guildId: { type: String, required: true, index: true },
  commandName: { type: String, required: true },
  allowedRoles: { type: [String], default: [] },
  disallowedRoles: { type: [String], default: [] },
  allowedChannels: { type: [String], default: [] },
  disallowedChannels: { type: [String], default: [] },
  cooldownSeconds: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

// Compound index for fast lookups
PermissionOverrideSchema.index({ guildId: 1, commandName: 1 }, { unique: true });

export const PermissionOverrideModel = mongoose.model<IPermissionOverride>('PermissionOverride', PermissionOverrideSchema);

// All available commands with their default settings
export const COMMAND_PERMISSIONS = {
  // Moderation
  warn: { category: 'Moderation', defaultCooldown: 5 },
  warnings: { category: 'Moderation', defaultCooldown: 3 },
  removewarning: { category: 'Moderation', defaultCooldown: 5 },
  clearwarnings: { category: 'Moderation', defaultCooldown: 10 },
  mute: { category: 'Moderation', defaultCooldown: 5 },
  unmute: { category: 'Moderation', defaultCooldown: 5 },
  kick: { category: 'Moderation', defaultCooldown: 5 },
  ban: { category: 'Moderation', defaultCooldown: 5 },
  unban: { category: 'Moderation', defaultCooldown: 5 },
  softban: { category: 'Moderation', defaultCooldown: 5 },
  timeout: { category: 'Moderation', defaultCooldown: 5 },
  lock: { category: 'Moderation', defaultCooldown: 10 },
  unlock: { category: 'Moderation', defaultCooldown: 10 },
  slowmode: { category: 'Moderation', defaultCooldown: 5 },
  purge: { category: 'Moderation', defaultCooldown: 10 },
  nuke: { category: 'Moderation', defaultCooldown: 60 },
  
  // Ticket
  'ticket-setup': { category: 'Ticket', defaultCooldown: 10 },
  'ticket-add': { category: 'Ticket', defaultCooldown: 5 },
  'ticket-remove': { category: 'Ticket', defaultCooldown: 5 },
  'ticket-close': { category: 'Ticket', defaultCooldown: 5 },
  
  // Giveaway
  'giveaway-create': { category: 'Giveaway', defaultCooldown: 30 },
  'giveaway-end': { category: 'Giveaway', defaultCooldown: 5 },
  'giveaway-reroll': { category: 'Giveaway', defaultCooldown: 5 },
  
  // Leveling
  rank: { category: 'Leveling', defaultCooldown: 5 },
  leaderboard: { category: 'Leveling', defaultCooldown: 10 },
  
  // Economy
  balance: { category: 'Economy', defaultCooldown: 5 },
  daily: { category: 'Economy', defaultCooldown: 86400 },
  gamble: { category: 'Economy', defaultCooldown: 10 },
  pay: { category: 'Economy', defaultCooldown: 5 },
  shop: { category: 'Economy', defaultCooldown: 10 },
  
  // Utility
  verify: { category: 'Utility', defaultCooldown: 30 },
  'verify-setup': { category: 'Utility', defaultCooldown: 60 },
  suggest: { category: 'Utility', defaultCooldown: 60 },
  'suggestion-accept': { category: 'Utility', defaultCooldown: 5 },
  'suggestion-decline': { category: 'Utility', defaultCooldown: 5 },
  'suggestion-consider': { category: 'Utility', defaultCooldown: 5 },
  userinfo: { category: 'Utility', defaultCooldown: 5 },
  serverinfo: { category: 'Utility', defaultCooldown: 10 },
  avatar: { category: 'Utility', defaultCooldown: 5 },
  banner: { category: 'Utility', defaultCooldown: 5 },
  roleinfo: { category: 'Utility', defaultCooldown: 5 },
  channelinfo: { category: 'Utility', defaultCooldown: 5 },
  permissions: { category: 'Utility', defaultCooldown: 5 },
  invite: { category: 'Utility', defaultCooldown: 10 },
  ping: { category: 'Utility', defaultCooldown: 5 },
  uptime: { category: 'Utility', defaultCooldown: 10 },
  
  // Custom Commands
  custom: { category: 'Custom', defaultCooldown: 3 },
};

export async function getPermissionOverride(guildId: string, commandName: string): Promise<IPermissionOverride | null> {
  return PermissionOverrideModel.findOne({ guildId, commandName });
}

export async function setPermissionOverride(
  guildId: string, 
  commandName: string, 
  settings: Partial<IPermissionOverride>
): Promise<IPermissionOverride> {
  return PermissionOverrideModel.findOneAndUpdate(
    { guildId, commandName },
    { ...settings, guildId, commandName },
    { upsert: true, new: true }
  );
}

export async function deletePermissionOverride(guildId: string, commandName: string): Promise<void> {
  await PermissionOverrideModel.deleteOne({ guildId, commandName });
}

export async function getAllPermissionOverrides(guildId: string): Promise<IPermissionOverride[]> {
  return PermissionOverrideModel.find({ guildId });
}
