import { GuildMember } from 'discord.js';
import { PhoenikLicenseModel } from '../../database/models/PhoenikLicense';
import { logger } from '../../utils/logger';

const API_URL = 'https://phoenik-key-system-production-1c2c.up.railway.app';

export class PhoenikLicenseManager {

  static async validateKey(key: string): Promise<{ valid: boolean; type?: string; expiresAt?: string; message?: string }> {
    try {
      const res = await fetch(`${API_URL}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, hwid: 'discord-bot-verification' }),
      });

      const data = await res.json() as { status: string; type?: string; expiresAt?: string; message?: string };

      if (data.status === 'valid') {
        return { valid: true, type: data.type, expiresAt: data.expiresAt };
      }

      return { valid: false, message: data.message || 'Invalid key' };
    } catch (err) {
      logger.error('Phoenik API error:', err instanceof Error ? err : new Error(String(err)));
      return { valid: false, message: 'Cannot connect to license server' };
    }
  }

  static async verifyAndGrant(member: GuildMember, key: string, roleId: string): Promise<{ success: boolean; message: string }> {
    const validation = await this.validateKey(key);

    if (!validation.valid) {
      return { success: false, message: validation.message || 'Invalid key' };
    }

    // Check if this Discord user already has an active license in this guild
    const existing = await PhoenikLicenseModel.findOne({
      guildId: member.guild.id,
      discordId: member.user.id,
      active: true,
    });

    if (existing) {
      // Check if still valid
      if (existing.expiresAt > new Date()) {
        return { success: false, message: `You already have an active license until ${existing.expiresAt.toLocaleDateString()}` };
      }
      // Expired, deactivate
      existing.active = false;
      await existing.save();
      await member.roles.remove(existing.roleId, 'License expired').catch(() => null);
    }

    // Calculate expiry
    const expiresAt = validation.expiresAt ? new Date(validation.expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create license record
    await PhoenikLicenseModel.create({
      guildId: member.guild.id,
      discordId: member.user.id,
      key: key.toUpperCase(),
      type: validation.type || 'free',
      expiresAt,
      roleId,
      active: true,
    });

    // Grant role
    await member.roles.add(roleId, 'Phoenik license verified').catch(() => {
      return { success: false, message: 'Failed to add role. Check bot permissions.' };
    });

    return {
      success: true,
      message: `License verified! Role granted until ${expiresAt.toLocaleDateString()}. Type: ${validation.type || 'free'}`,
    };
  }

  static async checkExpiredLicenses(guild: import('discord.js').Guild, roleId: string): Promise<number> {
    const expired = await PhoenikLicenseModel.find({
      guildId: guild.id,
      active: true,
      expiresAt: { $lte: new Date() },
    });

    let removed = 0;
    for (const license of expired) {
      license.active = false;
      await license.save();

      const member = await guild.members.fetch(license.discordId).catch(() => null);
      if (member) {
        await member.roles.remove(license.roleId, 'Phoenik license expired').catch(() => null);
        removed++;
      }
    }

    return removed;
  }

  static async getActiveLicenses(guildId: string) {
    return PhoenikLicenseModel.find({ guildId, active: true }).sort({ expiresAt: 1 });
  }
}
