import { StringSelectMenuInteraction } from 'discord.js';
import { SelectMenuHandler } from '../../types';
import { BotClient } from '../client';
import { TicketModel } from '../../database/models/Ticket';
import { successEmbed, errorEmbed } from '../../utils/embed';

const handler: SelectMenuHandler = {
  customId: 'ticket',

  async execute(interaction: StringSelectMenuInteraction, client: BotClient) {
    const parts = interaction.customId.split(':');
    const action = parts[1]!;
    const threadId = parts[2];

    if (action === 'priority') {
      const priority = interaction.values[0] as 'low' | 'medium' | 'high';
      const ticket = await TicketModel.findOneAndUpdate(
        { threadId },
        { priority },
        { new: true }
      );
      if (!ticket) {
        await interaction.reply({ embeds: [errorEmbed('Ticket Not Found')], ephemeral: true });
        return;
      }
      const emojis = { low: '🟢', medium: '🟡', high: '🔴' };
      await interaction.reply({
        embeds: [successEmbed('Priority Updated', `Priority set to ${emojis[priority]} **${priority}**`)],
        ephemeral: true,
      });
    }
  },
};

export default handler;
