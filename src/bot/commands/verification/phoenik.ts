import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits, ChannelType
} from 'discord.js';
import { Command } from '../../../types';
import { BotClient } from '../../client';
import { PhoenikLicenseManager } from '../../../modules/phoenik/PhoenikLicenseManager';
import { successEmbed, errorEmbed } from '../../../utils/embed';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('phoenik')
    .setDescription('Phoenik Executor license system')
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Setup the license verification panel in a channel')
      .addRoleOption(o => o.setName('customer_role').setDescription('Role given to verified users').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel to send the panel').addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub => sub
      .setName('check')
      .setDescription('Check all active licenses and remove expired ones'))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all active licenses in this server'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const customerRole = interaction.options.getRole('customer_role', true);
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      const embed = new EmbedBuilder()
        .setColor(0xFF3B3B)
        .setTitle('Phoenik Executor - License Verification')
        .setDescription(
          `**Verify your license to get access!**\n\n` +
          `**How to get a license:**\n` +
          `1. Click **Get Key** below\n` +
          `2. Complete the verification steps\n` +
          `3. Copy your license key\n` +
          `4. Click **Verify License** and paste your key\n\n` +
          `**Premium** keys last 7-30 days\n` +
          `**Free** keys last 24 hours\n\n` +
          `Your license will be automatically checked.`
        )
        .setThumbnail('https://cdn.discordapp.com/emojis/1234567890.png')
        .setFooter({ text: 'Phoenik Executor' });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('phoenik:getkey')
          .setLabel('Get Key')
          .setStyle(ButtonStyle.Link)
          .setURL('https://phoenik-key-system-production-1c2c.up.railway.app/getkey.html'),
        new ButtonBuilder()
          .setCustomId('phoenik:verify')
          .setLabel('Verify License')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🔑')
      );

      if (channel && 'send' in channel) {
        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ embeds: [successEmbed('Setup Complete', `License verification panel sent to ${channel}.\nCustomer role: ${customerRole}`)], ephemeral: true });
      }

    } else if (sub === 'check') {
      await interaction.deferReply({ ephemeral: true });
      const role = interaction.options.getRole('customer_role');

      // Use the first role found or require it
      const roleId = role?.id;
      if (!roleId) {
        await interaction.editReply({ content: 'No customer role configured. Use /phoenik setup first.' });
        return;
      }

      const removed = await PhoenikLicenseManager.checkExpiredLicenses(interaction.guild!, roleId);
      await interaction.editReply({ embeds: [successEmbed('Check Complete', `Removed ${removed} expired license(s).`)] });

    } else if (sub === 'list') {
      const licenses = await PhoenikLicenseManager.getActiveLicenses(interaction.guild!.id);

      if (licenses.length === 0) {
        await interaction.reply({ content: 'No active licenses.', ephemeral: true });
        return;
      }

      const list = licenses.map((l, i) =>
        `**${i + 1}.** <@${l.discordId}> — ${l.type} — expires <t:${Math.floor(l.expiresAt.getTime() / 1000)}:R>`
      ).join('\n');

      await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Active Licenses').setDescription(list).setColor(0xFF3B3B)], ephemeral: true });
    }
  },
};

export default command;
