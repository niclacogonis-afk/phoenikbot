import { ButtonInteraction, GuildMember } from 'discord.js';
import { ButtonHandler } from '../../types';
import { BotClient } from '../client';
import { EconomyManager } from '../../modules/economy/EconomyManager';
import { successEmbed, errorEmbed } from '../../utils/embed';

const handler: ButtonHandler = {
  customId: 'shop',

  async execute(interaction: ButtonInteraction, client: BotClient) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;

    const parts = interaction.customId.split(':');
    const action = parts[1];

    if (action === 'buy') {
      const itemId = parts[2];
      if (!itemId) {
        await interaction.reply({ embeds: [errorEmbed('Invalid item.')], ephemeral: true });
        return;
      }

      const result = await EconomyManager.buyItem(interaction.member, itemId);

      if (result.success) {
        await interaction.reply({ embeds: [successEmbed('Purchase Successful!', result.message)], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed(result.message)], ephemeral: true });
      }
    }
  },
};

export default handler;
