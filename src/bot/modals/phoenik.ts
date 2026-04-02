import { ModalSubmitInteraction, GuildMember } from 'discord.js';
import { ModalHandler } from '../../types';
import { BotClient } from '../client';
import { PhoenikLicenseManager } from '../../modules/phoenik/PhoenikLicenseManager';
import { getGuild } from '../../database/models/Guild';
import { successEmbed, errorEmbed } from '../../utils/embed';

const handler: ModalHandler = {
  customId: 'phoenik:licensekey',

  async execute(interaction: ModalSubmitInteraction, client: BotClient) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;

    const key = interaction.fields.getTextInputValue('licensekey').trim();

    // Get the customer role from guild config or use a default
    const guild = await getGuild(interaction.guild.id);
    const roleId = (guild as any).verifyRole as string | undefined;

    if (!roleId) {
      await interaction.reply({ embeds: [errorEmbed('No role configured. Ask an admin to run /phoenik setup.')], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await PhoenikLicenseManager.verifyAndGrant(interaction.member, key, roleId);

    if (result.success) {
      await interaction.editReply({ embeds: [successEmbed('License Verified!', result.message)] });
    } else {
      await interaction.editReply({ embeds: [errorEmbed(result.message)] });
    }
  },
};

export default handler;
