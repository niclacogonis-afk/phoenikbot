import { GuildMember } from 'discord.js';
import { GuildModel } from '../../database/models/Guild';

// Export functions directly for easier imports
export async function isStaff(member: GuildMember): Promise<boolean> {
  const guildConfig = await GuildModel.findOne({ guildId: member.guild.id });
  if (!guildConfig) return false;
  
  const staffRoleIds = guildConfig.staffRoles || [];
  const adminRoleIds = guildConfig.adminRoles || [];
  
  return member.roles.cache.some(role => 
    staffRoleIds.includes(role.id) || adminRoleIds.includes(role.id)
  );
}

export async function isAdmin(member: GuildMember): Promise<boolean> {
  const guildConfig = await GuildModel.findOne({ guildId: member.guild.id });
  if (!guildConfig) return false;
  
  const adminRoleIds = guildConfig.adminRoles || [];
  return member.roles.cache.some(role => adminRoleIds.includes(role.id));
}

export async function getPermissionLevel(member: GuildMember): Promise<'user' | 'staff' | 'admin' | 'owner'> {
  if (member.guild.ownerId === member.id) return 'owner';
  const isAdminUser = await isAdmin(member);
  if (isAdminUser) return 'admin';
  const isStaffUser = await isStaff(member);
  if (isStaffUser) return 'staff';
  return 'user';
}

// Also export as class for backward compatibility
export class PermissionManager {
  static async isStaff(member: GuildMember): Promise<boolean> {
    return isStaff(member);
  }
  
  static async isAdmin(member: GuildMember): Promise<boolean> {
    return isAdmin(member);
  }
  
  static async getPermissionLevel(member: GuildMember): Promise<'user' | 'staff' | 'admin' | 'owner'> {
    return getPermissionLevel(member);
  }
}

export const PERMISSION_LEVELS = {
  user: 0,
  staff: 1,
  admin: 2,
  owner: 3,
} as const;

export const COMMAND_PERMISSION_REQUIREMENTS: Record<string, keyof typeof PERMISSION_LEVELS> = {
  'ticket-setup': 'staff',
  'giveaway-create': 'staff',
  'giveaway-end': 'staff',
  'giveaway-reroll': 'staff',
  'verify-setup': 'staff',
  'nuke': 'admin',
  ban: 'admin',
  unban: 'admin',
  softban: 'admin',
  kick: 'staff',
  mute: 'staff',
  unmute: 'staff',
  timeout: 'staff',
  lock: 'staff',
  unlock: 'staff',
  slowmode: 'staff',
  purge: 'staff',
  clearwarnings: 'admin',
  warn: 'staff',
  removewarning: 'staff',
};
