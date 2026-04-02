import {
  ButtonInteraction, GuildMember, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder
} from 'discord.js';
import { ButtonHandler } from '../../types';
import { BotClient } from '../client';
import { getGuild } from '../../database/models/Guild';
import { PhoenikLicenseManager } from '../../modules/phoenik/PhoenikLicenseManager';
import { successEmbed, errorEmbed } from '../../utils/embed';

const handler: ButtonHandler = {
  customId: 'phoenik',

  async execute(interaction: ButtonInteraction, client: BotClient) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;

    const parts = interaction.customId.split(':');
    const action = parts[1];

    if (action === 'verify') {
      const modal = new ModalBuilder()
        .setCustomId('phoenik:licensekey')
        .setTitle('Phoenik License Verification')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('licensekey')
              .setLabel('Enter your license key')
              .setPlaceholder('PHOENIK-XXXX-XXXX-XXXX')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(30)
          )
        );
      await interaction.showModal(modal);
    }
  },
};

export default handler;
