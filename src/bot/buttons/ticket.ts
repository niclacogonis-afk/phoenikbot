import {
  ButtonInteraction, GuildMember, ThreadChannel, ModalBuilder,
  TextInputBuilder, TextInputStyle, ActionRowBuilder,
} from 'discord.js';
import { ButtonHandler } from '../../types';
import { BotClient } from '../client';
import { TicketManager } from '../../modules/ticket/TicketManager';
import { TicketModel } from '../../database/models/Ticket';
import { successEmbed, errorEmbed } from '../../utils/embed';
import { isStaff } from '../../modules/permissions/PermissionManager';

const handler: ButtonHandler = {
  customId: 'ticket',

  async execute(interaction: ButtonInteraction, client: BotClient) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;

    const parts = interaction.customId.split(':');
    const action = parts[1]!;
    const id = parts[2];

    if (action === 'open') {
      const type = id ?? 'support';
      await interaction.deferReply({ ephemeral: true });
      const error = await TicketManager.openTicket(interaction.guild, interaction.member, type);
      if (error) {
        await interaction.editReply({ embeds: [errorEmbed('Cannot Open Ticket', error)] });
      } else {
        await interaction.editReply({ embeds: [successEmbed('Ticket Opened', 'Your ticket has been created!')] });
      }
      return;
    }

    if (action === 'close') {
      if (!await isStaff(interaction.member)) {
        const ticket = await TicketModel.findOne({ threadId: id });
        if (!ticket || ticket.userId !== interaction.user.id) {
          await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
          return;
        }
      }
      await interaction.deferReply({ ephemeral: true });
      const thread = interaction.channel as ThreadChannel;
      await TicketManager.closeTicket(thread, interaction.user.id, interaction.guild);
      await interaction.editReply({ embeds: [successEmbed('Ticket Closed')] });
      return;
    }

    if (action === 'claim') {
      if (!await isStaff(interaction.member)) {
        await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
        return;
      }
      const ticket = await TicketModel.findOneAndUpdate(
        { threadId: id },
        { claimedBy: interaction.user.id },
        { new: true }
      );
      if (!ticket) return;
      await interaction.reply({ embeds: [successEmbed('Ticket Claimed', `Ticket claimed by <@${interaction.user.id}>`)] });
      return;
    }

    if (action === 'transfer') {
      if (!await isStaff(interaction.member)) {
        await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId(`ticket:transfer-modal:${id}`)
        .setTitle('Transfer Ticket')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('userId')
              .setLabel('User ID to transfer to')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );
      await interaction.showModal(modal);
      return;
    }

    if (action === 'delete') {
      if (!await isStaff(interaction.member)) {
        await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
        return;
      }
      await TicketModel.findOneAndUpdate({ threadId: id }, { status: 'deleted' });
      const thread = interaction.channel as ThreadChannel;
      await thread.delete('Ticket deleted by staff').catch(() => null);
      return;
    }

    if (action === 'reopen') {
      const ticket = await TicketModel.findOne({ threadId: id });
      if (!ticket) return;
      ticket.status = 'open';
      ticket.closedAt = null as unknown as Date;
      await ticket.save();
      const thread = interaction.guild.channels.cache.get(id!) as ThreadChannel | undefined;
      if (thread) {
        await thread.setArchived(false).catch(() => null);
      }
      await interaction.reply({ embeds: [successEmbed('Ticket Reopened')] });
      return;
    }

    if (action === 'feedback') {
      const modal = new ModalBuilder()
        .setCustomId(`ticket:feedback-modal:${id}`)
        .setTitle('Ticket Feedback')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('rating')
              .setLabel('Rating (1-5 stars)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('Enter a number from 1 to 5')
              .setRequired(true)
              .setMaxLength(1)
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('comment')
              .setLabel('Comment (optional)')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(false)
          )
        );
      await interaction.showModal(modal);
    }
  },
};

export default handler;
