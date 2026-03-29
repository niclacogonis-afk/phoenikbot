import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember,
  EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType, Colors,
} from 'discord.js';
import { Command } from '../../../types';
import { errorEmbed, successEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';
import { getTicketConfig, TicketConfigModel } from '../../../database/models/TicketConfig';
import { isModuleEnabled } from '../../../modules/cache/CacheManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system management')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s.setName('panel').setDescription('Send the ticket panel to a channel')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel for panel').setRequired(true).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand((s) =>
      s.setName('setup').setDescription('Configure ticket system')
        .addRoleOption((o) => o.setName('staff-role').setDescription('Staff role').setRequired(true))
        .addChannelOption((o) => o.setName('log-channel').setDescription('Ticket log channel').addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('thread-template').setDescription('Thread name template: {type} {username} {id}'))
        .addIntegerOption((o) => o.setName('auto-close-hours').setDescription('Auto-close after X hours of inactivity').setMinValue(1).setMaxValue(168))
    )
    .addSubcommand((s) => s.setName('stats').setDescription('View ticket statistics')),

  category: 'Ticket',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) {
      await interaction.reply({ embeds: [errorEmbed('Error', 'Must be used in a server.')], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    if (!await isModuleEnabled(interaction.guild.id, 'ticket')) {
      await interaction.editReply({ embeds: [errorEmbed('Module Disabled', 'Ticket module is not enabled. Use `/config module enable ticket`.')] });
      return;
    }

    if (!await isStaff(interaction.member)) {
      await interaction.editReply({ embeds: [errorEmbed('Permission Denied')] });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const staffRole = interaction.options.getRole('staff-role', true);
      const logChannel = interaction.options.getChannel('log-channel');
      const threadTemplate = interaction.options.getString('thread-template');
      const autoCloseHours = interaction.options.getInteger('auto-close-hours');

      const config = await getTicketConfig(interaction.guild.id);
      if (!config.staffRoles.includes(staffRole.id)) config.staffRoles.push(staffRole.id);
      if (logChannel) config.logChannelId = logChannel.id;
      if (threadTemplate) config.threadNameTemplate = threadTemplate;
      if (autoCloseHours) config.autoCloseHours = autoCloseHours;
      await config.save();

      await interaction.editReply({ embeds: [successEmbed('Ticket System Configured', `Staff role: ${staffRole}\nLog channel: ${logChannel ?? 'Not set'}`)] });
      return;
    }

    if (sub === 'panel') {
      const channel = interaction.options.getChannel('channel', true);
      const config = await getTicketConfig(interaction.guild.id);

      const embed = new EmbedBuilder()
        .setColor(config.embedColor as `#${string}`)
        .setTitle(config.embedTitle)
        .setDescription(config.embedDescription)
        .setTimestamp();

      if (config.embedImage) embed.setImage(config.embedImage);
      if (config.embedThumbnail) embed.setThumbnail(config.embedThumbnail);

      const buttons = config.buttons.map((b) =>
        new ButtonBuilder()
          .setCustomId(`ticket:open:${b.type}`)
          .setLabel(b.label)
          .setEmoji(b.emoji)
          .setStyle(b.style as ButtonStyle)
      );

      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
      }

      const targetChannel = interaction.guild.channels.cache.get(channel.id);
      if (!targetChannel?.isTextBased()) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid Channel', 'The selected channel is not a text channel.')] });
        return;
      }

      let msg;
      try {
        msg = await (targetChannel as import('discord.js').TextChannel).send({ embeds: [embed], components: rows });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await interaction.editReply({ embeds: [errorEmbed('Send Failed', `Could not send panel to ${channel}. Make sure the bot has **Send Messages** and **Embed Links** permissions.\n\`${errMsg}\``)] });
        return;
      }

      config.panelChannelId = channel.id;
      config.panelMessageId = msg.id;
      await config.save();

      await interaction.editReply({ embeds: [successEmbed('Panel Sent', `Ticket panel sent to ${channel}.`)] });
      return;
    }

    if (sub === 'stats') {
      const { TicketModel } = await import('../../../database/models/Ticket');
      const guildId = interaction.guild.id;
      const [open, closed, total] = await Promise.all([
        TicketModel.countDocuments({ guildId, status: 'open' }),
        TicketModel.countDocuments({ guildId, status: 'closed' }),
        TicketModel.countDocuments({ guildId }),
      ]);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎫 Ticket Statistics')
        .addFields(
          { name: 'Open', value: String(open), inline: true },
          { name: 'Closed', value: String(closed), inline: true },
          { name: 'Total', value: String(total), inline: true },
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
