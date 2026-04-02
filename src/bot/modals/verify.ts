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
      // Defer reply immediately to avoid timeout
      await interaction.deferReply({ ephemeral: true });
      
      const code = interaction.fields.getTextInputValue('code');
      const result = await VerificationManager.verifyCaptcha(interaction.member, code, roleId);
      if (result.success) {
        await interaction.editReply({ embeds: [successEmbed('Verified!', 'You now have access to the server!')] });
      } else {
        await interaction.editReply({ embeds: [errorEmbed('Verification Failed', result.reason)] });
      }
    }
  },
};

export default handler;
