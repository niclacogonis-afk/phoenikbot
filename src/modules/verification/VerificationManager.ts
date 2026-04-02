import { GuildMember, Guild, TextChannel, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { getUser } from '../../database/models/User';
import { GlobalBanModel } from '../../database/models/GlobalBan';
import { getGuild } from '../../database/models/Guild';
import { logger } from '../../utils/logger';

export class VerificationManager {
  static generateCode(length = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  static async startCaptcha(member: GuildMember): Promise<string> {
    const code = VerificationManager.generateCode(6);
    await VerificationManager.startCaptchaWithCode(member, code);
    return code;
  }

  static async startCaptchaWithCode(member: GuildMember, code: string): Promise<void> {
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    const user = await getUser(member.guild.id, member.user.id);
    user.captchaCode = code;
    user.captchaExpires = expires;
    user.captchaAttempts = 0;
    await user.save();
  }

  static async verifyCaptcha(member: GuildMember, input: string, verifiedRoleId: string): Promise<{ success: boolean; reason?: string }> {
    const user = await getUser(member.guild.id, member.user.id);

    if (!user.captchaCode || !user.captchaExpires) {
      return { success: false, reason: 'No active captcha. Please start verification again.' };
    }

    if (new Date() > user.captchaExpires) {
      user.captchaCode = null;
      await user.save();
      return { success: false, reason: 'Captcha expired. Please start verification again.' };
    }

    // Normalize input: trim whitespace and convert to uppercase
    const normalizedInput = input.trim().toUpperCase();
    const storedCode = user.captchaCode.toUpperCase();

    // Check if code is correct BEFORE incrementing attempts
    if (normalizedInput === storedCode) {
      await VerificationManager.grantVerification(member, verifiedRoleId, user);
      return { success: true };
    }

    // Only increment attempts if code was wrong
    user.captchaAttempts++;
    await user.save();

    // Check if too many attempts AFTER saving
    if (user.captchaAttempts >= 5) {
      await member.kick('Failed captcha verification too many times').catch(() => null);
      return { success: false, reason: 'Too many failed attempts. You have been kicked.' };
    }

    return { success: false, reason: `Incorrect code. ${5 - user.captchaAttempts} attempts remaining.` };
  }

  static async startRobloxVerify(member: GuildMember): Promise<string> {
    const code = `VERIFY-${VerificationManager.generateCode(8)}`;
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    const user = await getUser(member.guild.id, member.user.id);
    user.verificationCode = code;
    user.verificationExpires = expires;
    await user.save();

    return code;
  }

  static async checkRobloxVerify(member: GuildMember, robloxUsername: string, verifiedRoleId: string): Promise<{ success: boolean; reason?: string }> {
    const user = await getUser(member.guild.id, member.user.id);

    if (!user.verificationCode || !user.verificationExpires) {
      return { success: false, reason: 'No active verification session.' };
    }
    if (new Date() > user.verificationExpires) {
      return { success: false, reason: 'Verification code expired. Please start again.' };
    }

    try {
      const axios = (await import('axios')).default;
      const searchRes = await axios.get(`https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(robloxUsername)}`);
      const robloxId = searchRes.data?.Id;
      if (!robloxId) return { success: false, reason: 'Roblox user not found.' };

      const profileRes = await axios.get(`https://users.roblox.com/v1/users/${robloxId}`);
      const bio: string = profileRes.data?.description ?? '';

      if (!bio.includes(user.verificationCode)) {
        return { success: false, reason: `Code not found in bio. Add \`${user.verificationCode}\` to your Roblox profile bio.` };
      }

      const existingLink = await import('../../database/models/User').then(({ UserModel }) =>
        UserModel.findOne({ guildId: member.guild.id, robloxId: String(robloxId), userId: { $ne: member.user.id } })
      );
      if (existingLink) {
        return { success: false, reason: 'This Roblox account is already linked to another Discord user.' };
      }

      const globalBan = await GlobalBanModel.findOne({ robloxId: String(robloxId) });
      if (globalBan) {
        await member.ban({ reason: `Global ban: Roblox account ${robloxUsername} is banned` }).catch(() => null);
        return { success: false, reason: 'Your Roblox account is globally banned from this server.' };
      }

      const accountCreated = new Date(profileRes.data?.created ?? Date.now());
      const accountAgeDays = (Date.now() - accountCreated.getTime()) / (1000 * 60 * 60 * 24);
      user.robloxId = String(robloxId);
      user.robloxUsername = robloxUsername;
      user.verificationCode = null;

      if (accountAgeDays < 30) {
        user.riskFlags = [...new Set([...user.riskFlags, 'new-roblox-account'])];
        user.riskScore = Math.min(100, user.riskScore + 15);
      }

      await VerificationManager.grantVerification(member, verifiedRoleId, user);
      return { success: true };
    } catch (err) {
      logger.error('Roblox verify error:', err instanceof Error ? err : new Error(String(err)));
      return { success: false, reason: 'Failed to verify with Roblox API. Please try again later.' };
    }
  }

  public static async grantVerification(member: GuildMember, roleId: string, user?: import('../../database/models/User').IUser): Promise<void> {
    // Add verified role
    await member.roles.add(roleId, 'Verification').catch(() => null);
    
    // Remove unverified role if configured
    const guild = await getGuild(member.guild.id);
    const unverifiedRole = (guild as any).unverifiedRole as string | undefined;
    if (unverifiedRole) {
      await member.roles.remove(unverifiedRole, 'Verification completed').catch(() => null);
    }
    
    if (user) {
      user.verified = true;
      user.verifiedAt = new Date();
      user.captchaCode = null;
      user.captchaExpires = null;
      user.riskScore = Math.max(0, user.riskScore - 10);
      await user.save();
    }
  }
}
