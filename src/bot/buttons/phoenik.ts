import {
  ButtonInteraction, GuildMember, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder
} from 'discord.js';
import { ButtonHandler } from '../../types';
import { BotClient } from '../client';
import { getGuild } from '../../database/models/Guild';
import { PhoenikLicenseManager } from '../../modules/phoenik/PhoenikLicenseManager';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embed';

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

    if (action === 'hwidreset') {
      const modal = new ModalBuilder()
        .setCustomId('phoenik:hwidreset')
        .setTitle('HWID Reset')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('hwidkey')
              .setLabel('Enter your license key')
              .setPlaceholder('PHOENIK-XXXX-XXXX-XXXX')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMaxLength(30)
          )
        );
      await interaction.showModal(modal);
    }

    if (action === 'status') {
      const license = await PhoenikLicenseManager.getUserLicense(interaction.guild.id, interaction.user.id);

      if (!license) {
        await interaction.reply({ embeds: [errorEmbed('No active license found.')], ephemeral: true });
        return;
      }

      const timeLeft = license.expiresAt.getTime() - Date.now();
      const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      const embed = infoEmbed('Your License Status',
        `**Key:** \`${license.key}\`\n` +
        `**Type:** ${license.type}\n` +
        `**Expires:** ${license.expiresAt.toLocaleDateString()} (${daysLeft}d ${hoursLeft}h left)\n` +
        `**HWID:** ${license.hwid ? 'Bound' : 'Unbound'}\n` +
        `**Status:** ${license.active ? 'Active' : 'Inactive'}`
      );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (action === 'download') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const fs = require('fs');
        const rarPath = 'C:\\Users\\nicol\\Desktop\\PhoenikExecutor.rar';

        if (fs.existsSync(rarPath)) {
          await interaction.editReply({
            content: '**Phoenik Executor - Latest Version**\nDownload the latest version below:',
            files: [{ attachment: rarPath, name: 'PhoenikExecutor.rar' }]
          });
        } else {
          await interaction.editReply({ embeds: [errorEmbed('File not found. Contact an admin.')] });
        }
      } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed('Failed to send file. Contact an admin.')] });
      }
    }
  },
};

export default handler;
