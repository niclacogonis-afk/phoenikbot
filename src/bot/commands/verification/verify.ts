import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember,
  EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { Command } from '../../../types';
import { errorEmbed, successEmbed, infoEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';
import { isModuleEnabled } from '../../../modules/cache/CacheManager';
import { getGuild } from '../../../database/models/Guild';
import { VerificationManager } from '../../../modules/verification/VerificationManager';

const VERIFY_CONFIG_KEY = 'verifyConfig';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verification system')
    .addSubcommand((s) =>
      s.setName('setup').setDescription('Setup verification system')
        .addRoleOption((o) => o.setName('role').setDescription('Role to give on verification').setRequired(true))
        .addStringOption((o) =>
          o.setName('mode').setDescription('Verification mode').setRequired(true)
            .addChoices(
              { name: 'Button (click to verify)', value: 'button' },
              { name: 'Captcha', value: 'captcha' },
              { name: 'Roblox (bio verification)', value: 'roblox' },
            )
        )
    )
    .addSubcommand((s) =>
      s.setName('panel').setDescription('Send verification panel')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand((s) =>
      s.setName('roblox').setDescription('Confirm Roblox verification')
        .addStringOption((o) => o.setName('username').setDescription('Your Roblox username').setRequired(true))
    ),

  category: 'Verification',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;

    if (!await isModuleEnabled(interaction.guild.id, 'verification')) {
      await interaction.reply({ embeds: [errorEmbed('Module Disabled', 'Enable verification module first.')], ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      if (!await isStaff(interaction.member)) {
        await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
        return;
      }
      const role = interaction.options.getRole('role', true);
      const mode = interaction.options.getString('mode', true);

      const guild = await getGuild(interaction.guild.id);
      (guild as any).verifyRole = role.id;
      (guild as any).verifyMode = mode;
      await guild.save();

      await interaction.reply({ embeds: [successEmbed('Verification Setup', `Mode: **${mode}**\nRole: ${role}`)], ephemeral: true });
      return;
    }

    if (sub === 'panel') {
      if (!await isStaff(interaction.member)) {
        await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
        return;
      }
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Server Verification')
        .setDescription('Click the button below to verify and gain access to the server.')
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('verify:start').setLabel('Verify').setEmoji('✅').setStyle(ButtonStyle.Success)
      );

      const target = interaction.guild.channels.cache.get(channel!.id);
      if (target?.isTextBased()) {
        await (target as import('discord.js').TextChannel).send({ embeds: [embed], components: [row] });
      }
      await interaction.reply({ embeds: [successEmbed('Panel Sent')], ephemeral: true });
      return;
    }

    if (sub === 'roblox') {
      const username = interaction.options.getString('username', true);
      const guild = await getGuild(interaction.guild.id);
      const verifyRole = (guild as any).verifyRole as string | undefined;
      if (!verifyRole) {
        await interaction.reply({ embeds: [errorEmbed('Not Configured', 'Verification is not set up.')], ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const result = await VerificationManager.checkRobloxVerify(interaction.member, username, verifyRole);
      if (result.success) {
        await interaction.editReply({ embeds: [successEmbed('Verified!', 'Your Roblox account has been linked and you are now verified!')] });
      } else {
        await interaction.editReply({ embeds: [errorEmbed('Verification Failed', result.reason)] });
      }
    }
  },
};

export default command;
