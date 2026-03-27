import { ButtonInteraction, GuildMember } from 'discord.js';
import { ButtonHandler } from '../../types';
import { BotClient } from '../client';
import { GiveawayManager } from '../../modules/giveaway/GiveawayManager';
import { successEmbed, errorEmbed } from '../../utils/embed';

const handler: ButtonHandler = {
  customId: 'giveaway',

  async execute(interaction: ButtonInteraction, client: BotClient) {
    const parts = interaction.customId.split(':');
    const action = parts[1]!;
    const id = parts[2]!;

    if (action === 'enter') {
      if (!(interaction.member instanceof GuildMember)) return;
      await interaction.deferReply({ ephemeral: true });
      const result = await GiveawayManager.enter(id, interaction.user.id, interaction.member);
      if (result.success) {
        await interaction.editReply({ embeds: [successEmbed('Entered!', '🎉 You have been entered into the giveaway!')] });
      } else {
        await interaction.editReply({ embeds: [errorEmbed('Cannot Enter', result.reason)] });
      }
    }
  },
};

export default handler;
