import { ModalSubmitInteraction, GuildMember } from 'discord.js';
import { ModalHandler } from '../../types';
import { BotClient } from '../client';
import { PhoenikLicenseManager } from '../../modules/phoenik/PhoenikLicenseManager';
import { getGuild } from '../../database/models/Guild';
import { successEmbed, errorEmbed } from '../../utils/embed';

const handler: ModalHandler = {
  customId: 'phoenik',

  async execute(interaction: ModalSubmitInteraction, client: BotClient) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;

    const parts = interaction.customId.split(':');
    const action = parts[1];

    if (action === 'licensekey') {
      const key = interaction.fields.getTextInputValue('licensekey').trim();
      const guild = await getGuild(interaction.guild.id);

      const premiumRoleId = (guild as any).phoenikPremiumRole as string | undefined;
      const freeRoleId = (guild as any).phoenikCustomerRole as string | undefined;

      if (!premiumRoleId || !freeRoleId) {
        await interaction.reply({ embeds: [errorEmbed('Roles not configured. Ask an admin to run /phoenik setup.')], ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const result = await PhoenikLicenseManager.verifyAndGrant(interaction.member, key, premiumRoleId, freeRoleId);

      if (result.success) {
        await interaction.editReply({ embeds: [successEmbed('License Verified!', result.message)] });
      } else {
        await interaction.editReply({ embeds: [errorEmbed(result.message)] });
      }
    }

    if (action === 'hwidreset') {
      const key = interaction.fields.getTextInputValue('hwidkey').trim();

      await interaction.deferReply({ ephemeral: true });
      const result = await PhoenikLicenseManager.resetHWID(key);

      if (result.success) {
        await interaction.editReply({ embeds: [successEmbed('HWID Reset', result.message)] });
      } else {
        await interaction.editReply({ embeds: [errorEmbed(result.message)] });
      }
    }
  },
};

export default handler;
