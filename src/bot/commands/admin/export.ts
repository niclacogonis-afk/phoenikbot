import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember,
  AttachmentBuilder,
} from 'discord.js';
import { Command } from '../../../types';
import { errorEmbed, successEmbed } from '../../../utils/embed';
import { isAdmin } from '../../../modules/permissions/PermissionManager';
import { TicketModel } from '../../../database/models/Ticket';
import { GuildModel } from '../../../database/models/Guild';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('export')
    .setDescription('Export server data for analysis')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s.setName('tickets').setDescription('Export ticket data')
        .addStringOption((o) =>
          o.setName('format').setDescription('Export format').setRequired(true)
            .addChoices({ name: 'JSON', value: 'json' }, { name: 'CSV', value: 'csv' })
        )
        .addStringOption((o) =>
          o.setName('status').setDescription('Filter by status')
            .addChoices(
              { name: 'All', value: 'all' },
              { name: 'Open', value: 'open' },
              { name: 'Closed', value: 'closed' },
            )
        )
    )
    .addSubcommand((s) =>
      s.setName('config').setDescription('Export server configuration')
        .addStringOption((o) =>
          o.setName('format').setDescription('Export format').setRequired(true)
            .addChoices({ name: 'JSON', value: 'json' })
        )
    ),

  category: 'Admin',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) {
      await interaction.reply({ embeds: [errorEmbed('Error', 'Must be used in a server.')], ephemeral: true });
      return;
    }

    if (!await isAdmin(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You need admin permissions.')], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'tickets') {
      const format = interaction.options.getString('format', true) as 'json' | 'csv';
      const statusFilter = interaction.options.getString('status') ?? 'all';

      const query: Record<string, unknown> = { guildId };
      if (statusFilter !== 'all') query['status'] = statusFilter;

      const tickets = await TicketModel.find(query).sort({ createdAt: -1 }).limit(1000);

      if (tickets.length === 0) {
        await interaction.editReply({ embeds: [errorEmbed('No Data', 'No tickets found matching the filter.')] });
        return;
      }

      let content: string;
      let filename: string;

      if (format === 'json') {
        const data = tickets.map((t) => ({
          id: String(t._id),
          ticketNumber: t.ticketNumber,
          type: t.type,
          status: t.status,
          userId: t.userId,
          claimedBy: t.claimedBy,
          priority: t.priority,
          createdAt: t.createdAt?.toISOString(),
          closedAt: t.closedAt?.toISOString() ?? null,
          messageCount: t.messages.length,
        }));
        content = JSON.stringify(data, null, 2);
        filename = `tickets-${guildId}-${Date.now()}.json`;
      } else {
        const header = 'ID,Number,Type,Status,UserID,ClaimedBy,Priority,CreatedAt,ClosedAt,Messages';
        const rows = tickets.map((t) =>
          [
            String(t._id),
            t.ticketNumber,
            t.type,
            t.status,
            t.userId,
            t.claimedBy ?? '',
            t.priority ?? 'medium',
            t.createdAt?.toISOString() ?? '',
            t.closedAt?.toISOString() ?? '',
            t.messages.length,
          ].join(',')
        );
        content = [header, ...rows].join('\n');
        filename = `tickets-${guildId}-${Date.now()}.csv`;
      }

      const attachment = new AttachmentBuilder(Buffer.from(content, 'utf-8'), { name: filename });
      await interaction.editReply({
        embeds: [successEmbed('Export Ready', `Exported **${tickets.length}** tickets as ${format.toUpperCase()}.`)],
        files: [attachment],
      });
      return;
    }

    if (sub === 'config') {
      const guildDoc = await GuildModel.findOne({ guildId });
      if (!guildDoc) {
        await interaction.editReply({ embeds: [errorEmbed('No Config', 'No configuration found for this server.')] });
        return;
      }

      const data = {
        guildId: guildDoc.guildId,
        modules: guildDoc.modules,
        logChannel: guildDoc.logChannel,
        modLogChannel: guildDoc.modLogChannel,
        staffRoles: guildDoc.staffRoles,
        adminRoles: guildDoc.adminRoles,
        autoModThresholds: guildDoc.autoModThresholds,
        antilink: guildDoc.antilink,
        verifyMode: guildDoc.verifyMode,
        exportedAt: new Date().toISOString(),
      };

      const content = JSON.stringify(data, null, 2);
      const filename = `config-${guildId}-${Date.now()}.json`;
      const attachment = new AttachmentBuilder(Buffer.from(content, 'utf-8'), { name: filename });

      await interaction.editReply({
        embeds: [successEmbed('Config Exported', 'Server configuration exported as JSON.')],
        files: [attachment],
      });
    }
  },
};

export default command;
