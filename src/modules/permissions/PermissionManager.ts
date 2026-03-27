import { GuildMember, PermissionFlagsBits } from 'discord.js';
import { getCachedGuild } from '../cache/CacheManager';
import { PermissionModel } from '../../database/models/Permission';
import { config } from '../../config';

export async function isStaff(member: GuildMember): Promise<boolean> {
  if (config.ownerIds.includes(member.user.id)) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const guild = await getCachedGuild(member.guild.id);
  return member.roles.cache.some((r) => guild.staffRoles.includes(r.id) || guild.adminRoles.includes(r.id));
}

export async function isAdmin(member: GuildMember): Promise<boolean> {
  if (config.ownerIds.includes(member.user.id)) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  const guild = await getCachedGuild(member.guild.id);
  return member.roles.cache.some((r) => guild.adminRoles.includes(r.id));
}

export function isBotOwner(userId: string): boolean {
  return config.ownerIds.includes(userId);
}

export async function canUseCommand(member: GuildMember, command: string): Promise<boolean> {
  if (isBotOwner(member.user.id)) return true;

  const override = await PermissionModel.findOne({ guildId: member.guild.id, command });
  if (!override) return true;

  if (override.usersBlocked.includes(member.user.id)) return false;
  if (override.usersAllowed.includes(member.user.id)) return true;

  const memberRoles = [...member.roles.cache.keys()];
  if (memberRoles.some((r) => override.rolesBlocked.includes(r))) return false;
  if (override.rolesAllowed.length > 0) {
    return memberRoles.some((r) => override.rolesAllowed.includes(r));
  }

  return true;
}
