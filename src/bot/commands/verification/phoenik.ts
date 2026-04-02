import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits, ChannelType
} from 'discord.js';
import { Command } from '../../../types';
import { BotClient } from '../../client';
import { getGuild } from '../../../database/models/Guild';
import { PhoenikLicenseManager } from '../../../modules/phoenik/PhoenikLicenseManager';
import { successEmbed, errorEmbed } from '../../../utils/embed';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('phoenik')
    .setDescription('Phoenik Executor license system')
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Setup the license verification panel')
      .addRoleOption(o => o.setName('premium_role').setDescription('Role for premium customers').setRequired(true))
      .addRoleOption(o => o.setName('free_role').setDescription('Role for free customers').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel for the panel').addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub => sub
      .setName('premium')
      .setDescription('Setup the premium-only panel (HWID reset, status, download)')
      .addChannelOption(o => o.setName('channel').setDescription('Channel for premium panel').addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub => sub
      .setName('check')
      .setDescription('Check all licenses and remove expired ones'))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all active licenses'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const sub = interaction.options.getSubcommand(false);

    if (!sub) {
      await interaction.reply({ content: 'Use a subcommand: /phoenik setup, /phoenik premium, /phoenik check, /phoenik list', ephemeral: true });
      return;
    }

    if (sub === 'setup') {
      const premiumRole = interaction.options.getRole('premium_role', true);
      const freeRole = interaction.options.getRole('free_role', true);
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      // Save roles to guild config
      const guild = await getGuild(interaction.guild.id);
      (guild as any).phoenikPremiumRole = premiumRole.id;
      (guild as any).phoenikCustomerRole = freeRole.id;
      await (guild as any).save();

      // Send verification panel
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
          `**Premium** keys give <@&${premiumRole.id}> role\n` +
          `**Free** keys give <@&${freeRole.id}> role\n\n` +
          `Your license will be automatically checked.`
        )
        .setFooter({ text: 'Phoenik Executor' });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
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
        await interaction.reply({
          embeds: [successEmbed('Setup Complete',
            `Verification panel sent to ${channel}.\n` +
            `Premium role: ${premiumRole}\n` +
            `Free role: ${freeRole}`
          )],
          ephemeral: true
        });
      }

    } else if (sub === 'premium') {
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const guild = await getGuild(interaction.guild.id);
      const premiumRoleId = (guild as any).phoenikPremiumRole as string;

      if (!premiumRoleId) {
        await interaction.reply({ embeds: [errorEmbed('Run /phoenik setup first to configure roles.')], ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('Phoenik Executor - Premium Panel')
        .setDescription(
          `**Premium members only**\n\n` +
          `Access exclusive features below.\n` +
          `You need the <@&${premiumRoleId}> role to use these buttons.`
        )
        .setFooter({ text: 'Phoenik Executor Premium' });

      const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('phoenik:hwidreset')
          .setLabel('HWID Reset')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId('phoenik:status')
          .setLabel('License Status')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('phoenik:download')
          .setLabel('Download Executor')
          .setStyle(ButtonStyle.Success)
          .setEmoji('⬇️')
      );

      if (channel && 'send' in channel) {
        await channel.send({ embeds: [embed], components: [row1] });
        await interaction.reply({ embeds: [successEmbed('Premium Panel Sent', `Premium panel sent to ${channel}.`)], ephemeral: true });
      }

    } else if (sub === 'check') {
      await interaction.deferReply({ ephemeral: true });
      const removed = await PhoenikLicenseManager.checkExpiredLicenses(interaction.guild);
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
