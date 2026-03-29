import {
  Guild, GuildMember, TextChannel, ThreadChannel,
  EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
  AttachmentBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ChannelType,
} from 'discord.js';
import { TicketModel } from '../../database/models/Ticket';
import { getTicketConfig, TicketConfigModel } from '../../database/models/TicketConfig';
import { TranscriptBuilder } from './TranscriptBuilder';
import { sendLog } from '../logging/LogManager';
import { incrementStat } from '../../database/models/StaffStats';
import { incrementDailyStat } from '../../database/models/Stats';
import { errorEmbed, successEmbed } from '../../utils/embed';
import { formatDate } from '../../utils/formatters';
import { logger } from '../../utils/logger';

export class TicketManager {
  static async openTicket(guild: Guild, member: GuildMember, type: string): Promise<string | null> {
    try {
      const config = await getTicketConfig(guild.id);

      const existing = await TicketModel.findOne({
        guildId: guild.id,
        userId: member.user.id,
        status: 'open',
      });
      if (existing) return `You already have an open ticket! (<#${existing.threadId ?? existing.channelId}>)`;

      const ticketNumber = config.nextTicketNumber;
      config.nextTicketNumber += 1;
      await config.save();

      const threadName = (config.threadNameTemplate || '{type}-{username}')
        .replace('{type}', type)
        .replace('{username}', member.user.username)
        .replace('{id}', String(ticketNumber));

      if (!config.panelChannelId) {
        return 'Ticket system is not configured. Please ask an admin to run `/ticket setup` and `/ticket panel`.';
      }

      let panelChannel = guild.channels.cache.get(config.panelChannelId) as TextChannel | undefined;
      if (!panelChannel) {
        try {
          panelChannel = await guild.channels.fetch(config.panelChannelId) as TextChannel;
        } catch { }
      }
      if (!panelChannel) {
        return 'Ticket panel channel not found. Please reconfigure the ticket system via the dashboard or `/ticket panel`.';
      }

      let thread: ThreadChannel | null = null;

      try {
        thread = await panelChannel.threads.create({
          name: threadName,
          type: ChannelType.PrivateThread,
          invitable: false,
          reason: `Ticket #${ticketNumber} - ${type}`,
        });
      } catch {
        try {
          thread = await panelChannel.threads.create({
            name: threadName,
            type: ChannelType.PublicThread,
            reason: `Ticket #${ticketNumber} - ${type}`,
          });
        } catch (err) {
          logger.error('Failed to create ticket thread:', err instanceof Error ? err : new Error(String(err)));
          return 'Failed to create ticket thread. Make sure the bot has **Manage Threads** permission.';
        }
      }

      if (!thread) return 'Failed to create ticket thread.';

      await thread.members.add(member.user.id).catch(() => null);

      for (const roleId of config.staffRoles) {
        const role = guild.roles.cache.get(roleId);
        if (role) {
          for (const [, m] of role.members) {
            await thread.members.add(m.user.id).catch(() => null);
          }
        }
      }

      const now = new Date();
      const openMsg = (config.openMessageTemplate || 'Hello {user}! Staff will be with you shortly.\n**Type:** {ticket_type}\n**Date:** {date}')
        .replace('{user}', `<@${member.user.id}>`)
        .replace('{date}', formatDate(now))
        .replace('{ticket_type}', type);

      const staffPing = config.staffRoles.map((r) => `<@&${r}>`).join(' ');

      const ticketEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🎫 Ticket #${ticketNumber}`)
        .setDescription(openMsg)
        .addFields(
          { name: 'Type', value: type, inline: true },
          { name: 'Priority', value: '🟡 Medium', inline: true },
          { name: 'Status', value: '🟢 Open', inline: true }
        )
        .setTimestamp();

      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`ticket:close:${thread.id}`).setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ticket:claim:${thread.id}`).setLabel('Claim').setEmoji('👤').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ticket:transfer:${thread.id}`).setLabel('Transfer').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ticket:delete:${thread.id}`).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
      );

      const priorityMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`ticket:priority:${thread.id}`)
          .setPlaceholder('Set Priority')
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('Low').setValue('low').setEmoji('🟢'),
            new StringSelectMenuOptionBuilder().setLabel('Medium').setValue('medium').setEmoji('🟡'),
            new StringSelectMenuOptionBuilder().setLabel('High').setValue('high').setEmoji('🔴'),
          )
      );

      await thread.send({
        content: staffPing || undefined,
        embeds: [ticketEmbed],
        components: [row1, priorityMenu],
      }).catch((err) => {
        logger.error('Failed to send ticket initial message:', err instanceof Error ? err : new Error(String(err)));
      });

      const ticket = await TicketModel.create({
        guildId: guild.id,
        channelId: panelChannel.id,
        threadId: thread.id,
        userId: member.user.id,
        ticketNumber,
        type,
        lastActivityAt: new Date(),
      });

      await incrementDailyStat(guild.id, 'ticketsOpened').catch(() => null);

      const logEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🎫 Ticket Opened')
        .addFields(
          { name: 'User', value: `${member.user.username} (${member.user.id})`, inline: true },
          { name: 'Type', value: type, inline: true },
          { name: 'Thread', value: `<#${thread.id}>`, inline: true },
          { name: 'Ticket #', value: String(ticketNumber), inline: true }
        )
        .setTimestamp();
      await sendLog(guild, logEmbed);

      return null;
    } catch (err) {
      logger.error('TicketManager.openTicket error:', err instanceof Error ? err : new Error(String(err)));
      return 'An error occurred while creating the ticket. Please try again later.';
    }
  }

  static async closeTicket(thread: ThreadChannel, closedBy: string, guild: Guild): Promise<void> {
    const ticket = await TicketModel.findOne({ threadId: thread.id, status: 'open' });
    if (!ticket) return;

    ticket.status = 'closed';
    ticket.closedAt = new Date();
    ticket.closedBy = closedBy;

    const htmlTranscript = TranscriptBuilder.buildHtml(ticket, guild.name);
    const txtTranscript = TranscriptBuilder.buildTxt(ticket, guild.name);
    ticket.transcriptHtml = htmlTranscript;
    ticket.transcriptTxt = txtTranscript;
    await ticket.save();

    const htmlBuffer = Buffer.from(htmlTranscript, 'utf-8');
    const attachment = new AttachmentBuilder(htmlBuffer, { name: `ticket-${ticket.ticketNumber}.html` });

    const config = await getTicketConfig(guild.id);

    if (config.logChannelId) {
      const logChannel = guild.channels.cache.get(config.logChannelId) as TextChannel | undefined;
      if (logChannel) {
        await logChannel.send({
          embeds: [new EmbedBuilder().setColor(0xED4245).setTitle(`🎫 Ticket #${ticket.ticketNumber} Closed`).addFields(
            { name: 'User', value: `<@${ticket.userId}>`, inline: true },
            { name: 'Closed By', value: `<@${closedBy}>`, inline: true },
            { name: 'Messages', value: String(ticket.messages.length), inline: true },
          ).setTimestamp()],
          files: [attachment],
        }).catch(() => null);
      }
    }

    try {
      const ticketUser = await guild.client.users.fetch(ticket.userId);
      const reopenRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`ticket:reopen:${thread.id}`).setLabel('Reopen').setEmoji('🔓').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ticket:feedback:${ticket._id}`).setLabel('Leave Feedback').setEmoji('⭐').setStyle(ButtonStyle.Primary),
      );
      await ticketUser.send({
        embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('🔒 Your ticket has been closed').setDescription(`**Ticket #${ticket.ticketNumber}** in **${guild.name}** has been closed.`).setTimestamp()],
        files: [new AttachmentBuilder(htmlBuffer, { name: `ticket-${ticket.ticketNumber}.html` })],
        components: [reopenRow],
      });
    } catch { }

    await thread.setArchived(true, 'Ticket closed').catch(() => null);
    await incrementDailyStat(guild.id, 'ticketsClosed').catch(() => null);
    if (ticket.claimedBy) {
      await incrementStat(guild.id, ticket.claimedBy, 'ticketsHandled').catch(() => null);
    }
  }

  static async trackMessage(threadId: string, authorId: string, authorTag: string, content: string, attachments: string[]): Promise<void> {
    await TicketModel.findOneAndUpdate(
      { threadId, status: 'open' },
      {
        $push: { messages: { authorId, authorTag, content, attachments, timestamp: new Date() } },
        lastActivityAt: new Date(),
      }
    );
  }
}
