import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, EmbedBuilder,
} from 'discord.js';
import { Command } from '../../../types';
import { errorEmbed, successEmbed, infoEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';
import { AutoResponseModel } from '../../../database/models/AutoResponse';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('autoresponse')
    .setDescription('Manage automatic responses to keywords')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((s) =>
      s.setName('add').setDescription('Add an auto-response')
        .addStringOption((o) => o.setName('triggers').setDescription('Trigger keywords (comma-separated, e.g. help,supporto)').setRequired(true))
        .addStringOption((o) => o.setName('response').setDescription('Response message').setRequired(true))
        .addIntegerOption((o) => o.setName('cooldown').setDescription('Cooldown in seconds (default: 30)').setMinValue(5).setMaxValue(3600))
        .addBooleanOption((o) => o.setName('ticket_button').setDescription('Add a "Open Ticket" button to the response'))
    )
    .addSubcommand((s) =>
      s.setName('list').setDescription('List all auto-responses')
    )
    .addSubcommand((s) =>
      s.setName('delete').setDescription('Delete an auto-response')
        .addStringOption((o) => o.setName('id').setDescription('Auto-response ID (from /autoresponse list)').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('test').setDescription('Test a keyword trigger')
        .addStringOption((o) => o.setName('keyword').setDescription('Keyword to test').setRequired(true))
    ),

  category: 'Utility',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) {
      await interaction.reply({ embeds: [errorEmbed('Error', 'Must be used in a server.')], ephemeral: true });
      return;
    }

    if (!await isStaff(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You need to be a staff member.')], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'add') {
      const triggersRaw = interaction.options.getString('triggers', true);
      const response = interaction.options.getString('response', true);
      const cooldown = interaction.options.getInteger('cooldown') ?? 30;
      const ticketButton = interaction.options.getBoolean('ticket_button') ?? false;

      const triggers = triggersRaw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (triggers.length === 0) {
        await interaction.editReply({ embeds: [errorEmbed('Error', 'Please provide at least one trigger keyword.')] });
        return;
      }

      const existing = await AutoResponseModel.find({ guildId });
      const count = existing.length;
      if (count >= 50) {
        await interaction.editReply({ embeds: [errorEmbed('Limit Reached', 'Maximum 50 auto-responses per server.')] });
        return;
      }

      const ar = await AutoResponseModel.create({
        guildId,
        triggers,
        response,
        cooldownSeconds: cooldown,
        includeTicketButton: ticketButton,
      });

      await interaction.editReply({
        embeds: [successEmbed('Auto-Response Added', `**Triggers:** \`${triggers.join('`, `')}\`\n**Response:** ${response}\n**Cooldown:** ${cooldown}s\n**ID:** \`${ar._id}\``)],
      });
      return;
    }

    if (sub === 'list') {
      const responses = await AutoResponseModel.find({ guildId }).sort({ createdAt: -1 }).limit(20);
      if (responses.length === 0) {
        await interaction.editReply({ embeds: [infoEmbed('Auto-Responses', 'No auto-responses configured.')] });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Auto-Responses')
        .setDescription(
          responses.map((ar, i) =>
            `**${i + 1}.** \`${String(ar._id)}\`\nTriggers: \`${ar.triggers.join(', ')}\`\n└ ${ar.response.slice(0, 80)}${ar.response.length > 80 ? '...' : ''}`
          ).join('\n\n')
        )
        .setFooter({ text: `${responses.length} auto-response(s) — Copy the ID to delete` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'delete') {
      const id = interaction.options.getString('id', true);
      const result = await AutoResponseModel.findOneAndDelete({ guildId, _id: id }).catch(() => null);
      if (!result) {
        await interaction.editReply({ embeds: [errorEmbed('Not Found', 'Auto-response not found with that ID. Use `/autoresponse list` to see IDs.')] });
        return;
      }
      await interaction.editReply({ embeds: [successEmbed('Deleted', 'Auto-response deleted successfully.')] });
      return;
    }

    if (sub === 'test') {
      const keyword = interaction.options.getString('keyword', true).toLowerCase();
      const responses = await AutoResponseModel.find({ guildId });
      const match = responses.find((ar) => ar.triggers.some((t) => keyword.includes(t)));
      if (match) {
        await interaction.editReply({
          embeds: [successEmbed('Match Found', `Keyword \`${keyword}\` matches triggers: \`${match.triggers.join(', ')}\`\n**Response:** ${match.response}`)],
        });
      } else {
        await interaction.editReply({ embeds: [infoEmbed('No Match', `No auto-response matches keyword \`${keyword}\`.`)] });
      }
    }
  },
};

export default command;
