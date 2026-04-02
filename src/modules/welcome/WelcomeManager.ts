import { 
  Guild, GuildMember, TextChannel, 
  EmbedBuilder, ChannelType 
} from 'discord.js';
import { getWelcomeConfig } from '../../database/models/WelcomeConfig';
import { sendLog } from '../logging/LogManager';
import { safeEmbedMediaUrl } from '../../utils/embedUrl';
import { formatDate } from '../../utils/formatters';
import { logger } from '../../utils/logger';

/**
 * Welcome and Auto-role Manager
 * Handles welcome messages, goodbye messages, and auto-roles for new members
 */
export class WelcomeManager {
  /**
   * Process a new member joining the server
   */
  static async onMemberJoin(member: GuildMember): Promise<void> {
    const guildId = member.guild.id;

    try {
      // Apply auto-roles
      await WelcomeManager.applyAutoRoles(member);

      // Send welcome message
      await WelcomeManager.sendWelcomeMessage(member);
    } catch (err) {
      logger.error('WelcomeManager.onMemberJoin error:', err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Process a member leaving the server
   */
  static async onMemberLeave(member: GuildMember): Promise<void> {
    const guildId = member.guild.id;

    try {
      const config = await getWelcomeConfig(guildId);

      if (!config.leaveMessageEnabled || !config.leaveChannelId) return;

      const channel = member.guild.channels.cache.get(config.leaveChannelId) as TextChannel | undefined;
      if (!channel) {
        // Try to fetch the channel
        try {
          const fetched = await member.guild.channels.fetch(config.leaveChannelId);
          if (fetched && (fetched.type === ChannelType.GuildText || fetched.type === ChannelType.GuildAnnouncement)) {
            await WelcomeManager.sendLeaveMessage(member, fetched as TextChannel, config);
          }
        } catch { }
        return;
      }

      if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) return;

      await WelcomeManager.sendLeaveMessage(member, channel, config);
    } catch (err) {
      logger.error('WelcomeManager.onMemberLeave error:', err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Apply auto-roles to a member
   */
  static async applyAutoRoles(member: GuildMember): Promise<void> {
    const config = await getWelcomeConfig(member.guild.id);

    if (!config.autoRoleIds || config.autoRoleIds.length === 0) return;

    const delay = config.autoRoleDelay || 0;

    const applyRoles = async () => {
      const guild = member.guild;
      const botMember = guild.members.me;

      if (!botMember) return;

      for (const roleId of config.autoRoleIds) {
        const role = guild.roles.cache.get(roleId);
        if (!role) continue;

        // Check if bot can assign this role
        if (role.position >= botMember.roles.highest.position) {
          logger.warn(`Cannot assign role ${role.name} - it's higher than bot's highest role`);
          continue;
        }

        if (member.roles.cache.has(roleId)) continue;

        try {
          await member.roles.add(roleId, 'Auto-role on join');
          logger.debug(`Added auto-role ${role.name} to ${member.user.username}`);
        } catch (err) {
          logger.error(`Failed to add auto-role ${role.name} to ${member.user.username}:`, err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    if (delay > 0) {
      // Schedule role application after delay
      setTimeout(applyRoles, delay);
    } else {
      await applyRoles();
    }
  }

  /**
   * Send welcome message for a member
   */
  static async sendWelcomeMessage(member: GuildMember): Promise<void> {
    const config = await getWelcomeConfig(member.guild.id);

    if (!config.welcomeMessageEnabled || !config.welcomeChannelId) return;

    const channel = member.guild.channels.cache.get(config.welcomeChannelId) as TextChannel | undefined;
    
    let textChannel: TextChannel | undefined = channel;
    if (!textChannel) {
      try {
        const fetched = await member.guild.channels.fetch(config.welcomeChannelId) as TextChannel;
        if (fetched && (fetched.type === ChannelType.GuildText || fetched.type === ChannelType.GuildAnnouncement)) {
          textChannel = fetched as TextChannel;
        }
      } catch { }
    }

    if (!textChannel) return;

    // Resolve template variables
    const resolvedMessage = WelcomeManager.resolveWelcomeTemplate(
      config.welcomeMessage,
      member
    );

    if (config.welcomeEmbedEnabled) {
      const colorHex = config.welcomeEmbedColor || '#5865F2';
      const colorInt = parseInt(colorHex.replace('#', ''), 16) || 0x5865F2;

      const embed = new EmbedBuilder()
        .setColor(colorInt)
        .setTitle(WelcomeManager.resolveTemplate(config.welcomeEmbedTitle, member))
        .setDescription(WelcomeManager.resolveTemplate(config.welcomeEmbedDescription, member))
        .setTimestamp();

      // Use custom thumbnail if set, otherwise use user's avatar
      const thumbUrl = safeEmbedMediaUrl(config.welcomeEmbedThumbnail || '') || member.user.displayAvatarURL();
      embed.setThumbnail(thumbUrl);

      const imgUrl = safeEmbedMediaUrl(config.welcomeEmbedImage);
      if (imgUrl) embed.setImage(imgUrl);

      if (config.welcomeEmbedFooter) {
        embed.setFooter({ text: WelcomeManager.resolveTemplate(config.welcomeEmbedFooter, member) });
      }

      await textChannel.send({
        content: resolvedMessage || undefined,
        embeds: [embed],
      }).catch((err) => {
        logger.error('Failed to send welcome embed:', err instanceof Error ? err : new Error(String(err)));
      });
    } else {
      await textChannel.send(resolvedMessage).catch((err) => {
        logger.error('Failed to send welcome message:', err instanceof Error ? err : new Error(String(err)));
      });
    }
  }

  /**
   * Send leave message for a member
   */
  static async sendLeaveMessage(
    member: GuildMember, 
    channel: TextChannel, 
    config: any
  ): Promise<void> {
    const resolvedMessage = WelcomeManager.resolveTemplate(config.leaveMessage, member);

    if (config.leaveEmbedEnabled) {
      const colorHex = config.leaveEmbedColor || '#ED4245';
      const colorInt = parseInt(colorHex.replace('#', ''), 16) || 0xED4245;

      const embed = new EmbedBuilder()
        .setColor(colorInt)
        .setTitle(WelcomeManager.resolveTemplate(config.leaveEmbedTitle, member))
        .setDescription(WelcomeManager.resolveTemplate(config.leaveEmbedDescription, member))
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      await channel.send({
        content: resolvedMessage || undefined,
        embeds: [embed],
      }).catch((err) => {
        logger.error('Failed to send leave embed:', err instanceof Error ? err : new Error(String(err)));
      });
    } else {
      await channel.send(resolvedMessage).catch((err) => {
        logger.error('Failed to send leave message:', err instanceof Error ? err : new Error(String(err)));
      });
    }
  }

  /**
   * Resolve template variables in a welcome/leave message
   */
  private static resolveTemplate(template: string, member: GuildMember): string {
    const guild = member.guild;
    const user = member.user;

    return template
      .replace(/\{user\}/g, `<@${user.id}>`)
      .replace(/\{username\}/g, user.username)
      .replace(/\{usertag\}/g, user.tag)
      .replace(/\{server\}/g, guild.name)
      .replace(/\{member_count\}/g, String(guild.memberCount))
      .replace(/\{date\}/g, formatDate(new Date()))
      .replace(/\{joined_at\}/g, formatDate(member.joinedAt || new Date()));
  }

  /**
   * Resolve welcome message template (with additional variables)
   */
  private static resolveWelcomeTemplate(template: string, member: GuildMember): string {
    const guild = member.guild;
    const user = member.user;

    return template
      .replace(/\{user\}/g, `<@${user.id}>`)
      .replace(/\{username\}/g, user.username)
      .replace(/\{usertag\}/g, user.tag)
      .replace(/\{server\}/g, guild.name)
      .replace(/\{member_count\}/g, String(guild.memberCount))
      .replace(/\{count\}/g, String(guild.memberCount))
      .replace(/\{date\}/g, formatDate(new Date()))
      .replace(/\{joined_at\}/g, formatDate(member.joinedAt || new Date()));
  }
}
