import { ModalSubmitInteraction, GuildMember } from 'discord.js';
import { ModalHandler } from '../../types';
import { BotClient } from '../client';
import { VerificationManager } from '../../modules/verification/VerificationManager';
import { successEmbed, errorEmbed } from '../../utils/embed';

const handler: ModalHandler = {
  customId: 'verify',

  async execute(interaction: ModalSubmitInteraction, client: BotClient) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    const parts = interaction.customId.split(':');
    const action = parts[1]!;
    const roleId = parts[2]!;

    if (action === 'captcha') {
      const code = interaction.fields.getTextInputValue('code');
      const result = await VerificationManager.verifyCaptcha(interaction.member, code, roleId);
      if (result.success) {
        await interaction.reply({ embeds: [successEmbed('Verified!', 'You now have access to the server!')], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed('Verification Failed', result.reason)], ephemeral: true });
      }
    }
  },
};

export default handler;
