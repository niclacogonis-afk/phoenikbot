import { ModalSubmitInteraction } from 'discord.js';
import { ModalHandler } from '../../types';
import { BotClient } from '../client';
import { TicketModel } from '../../database/models/Ticket';
import { successEmbed, errorEmbed } from '../../utils/embed';

const handler: ModalHandler = {
  customId: 'ticket',

  async execute(interaction: ModalSubmitInteraction, client: BotClient) {
    const parts = interaction.customId.split(':');
    const action = parts[1]!;
    const id = parts[2];

    if (action === 'feedback-modal') {
      const ratingStr = interaction.fields.getTextInputValue('rating');
      const comment = interaction.fields.getTextInputValue('comment');
      const rating = parseInt(ratingStr, 10);

      if (isNaN(rating) || rating < 1 || rating > 5) {
        await interaction.reply({ embeds: [errorEmbed('Invalid Rating', 'Please enter a number from 1 to 5.')], ephemeral: true });
        return;
      }

      await TicketModel.findByIdAndUpdate(id, { feedback: { rating, comment } });

      const stars = '⭐'.repeat(rating);
      await interaction.reply({
        embeds: [successEmbed('Feedback Received', `Thank you for your feedback!\n${stars}${comment ? `\n*"${comment}"*` : ''}`)],
        ephemeral: true,
      });
      return;
    }

    if (action === 'transfer-modal') {
      const userId = interaction.fields.getTextInputValue('userId');
      const ticket = await TicketModel.findOneAndUpdate({ threadId: id }, { claimedBy: userId });
      if (!ticket) {
        await interaction.reply({ embeds: [errorEmbed('Ticket Not Found')], ephemeral: true });
        return;
      }
      await interaction.reply({ embeds: [successEmbed('Ticket Transferred', `Ticket transferred to <@${userId}>`)], ephemeral: true });
    }
  },
};

export default handler;
