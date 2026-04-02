import {
  ButtonInteraction, GuildMember, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle
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
      const guild = await getGuild(interaction.guild!.id);
      const downloadUrl = (guild as any).phoenikDownloadUrl as string | undefined;

      if (!downloadUrl) {
        await interaction.reply({ embeds: [errorEmbed('Download URL not configured. Ask an admin to set it up.')], ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('Phoenik Executor - Download')
        .setDescription(`Click the button below to download the latest version of Phoenik Executor.`)
        .setFooter({ text: 'Make sure to scan before running' });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Download PhoenikExecutor.rar')
          .setStyle(ButtonStyle.Link)
          .setURL(downloadUrl)
          .setEmoji('⬇️')
      );

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
  },
};

export default handler;
