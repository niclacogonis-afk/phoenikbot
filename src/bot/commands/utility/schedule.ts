import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember,
  EmbedBuilder, ChannelType,
} from 'discord.js';
import { Command } from '../../../types';
import { errorEmbed, successEmbed, infoEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';
import { ScheduleModel } from '../../../database/models/Schedule';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Schedule messages to be sent automatically')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((s) =>
      s.setName('add').setDescription('Schedule a message')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to send to').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('message').setDescription('Message to send').setRequired(true))
        .addStringOption((o) =>
          o.setName('time').setDescription('When to send (e.g. "2h", "30m", "1d" or ISO date)').setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('repeat').setDescription('Repeat interval')
            .addChoices(
              { name: 'No repeat (one-time)', value: 'none' },
              { name: 'Daily', value: 'daily' },
              { name: 'Weekly', value: 'weekly' },
              { name: 'Monthly', value: 'monthly' },
            )
        )
    )
    .addSubcommand((s) =>
      s.setName('list').setDescription('List all scheduled messages')
    )
    .addSubcommand((s) =>
      s.setName('delete').setDescription('Delete a scheduled message')
        .addStringOption((o) => o.setName('id').setDescription('Schedule ID (from /schedule list)').setRequired(true))
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
      const channelOption = interaction.options.getChannel('channel', true);
      const message = interaction.options.getString('message', true);
      const timeStr = interaction.options.getString('time', true);
      const repeat = (interaction.options.getString('repeat') ?? 'none') as 'none' | 'daily' | 'weekly' | 'monthly';

      const sendAt = parseTime(timeStr);
      if (!sendAt) {
        await interaction.editReply({
          embeds: [errorEmbed('Invalid Time', 'Use formats like: `30m`, `2h`, `1d`, `7d`, or a full ISO date.\nExamples: `1h30m`, `2024-12-25T12:00:00`')],
        });
        return;
      }

      if (sendAt <= new Date()) {
        await interaction.editReply({ embeds: [errorEmbed('Invalid Time', 'The time must be in the future.')] });
        return;
      }

      const count = await ScheduleModel.countDocuments({ guildId, active: true });
      if (count >= 20) {
        await interaction.editReply({ embeds: [errorEmbed('Limit Reached', 'Maximum 20 active scheduled messages per server.')] });
        return;
      }

      const sched = await ScheduleModel.create({
        guildId,
        channelId: channelOption.id,
        userId: interaction.user.id,
        message,
        sendAt,
        repeat,
      });

      const timestamp = Math.floor(sendAt.getTime() / 1000);
      await interaction.editReply({
        embeds: [successEmbed('Message Scheduled',
          `**Channel:** <#${channelOption.id}>\n**Send At:** <t:${timestamp}:F> (<t:${timestamp}:R>)\n**Repeat:** ${repeat}\n**ID:** \`${sched._id}\``
        )],
      });
      return;
    }

    if (sub === 'list') {
      const schedules = await ScheduleModel.find({ guildId, active: true }).sort({ sendAt: 1 }).limit(10);
      if (schedules.length === 0) {
        await interaction.editReply({ embeds: [infoEmbed('Schedules', 'No active scheduled messages.')] });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📅 Scheduled Messages')
        .setDescription(
          schedules.map((s, i) => {
            const ts = Math.floor(s.sendAt.getTime() / 1000);
            return `**${i + 1}.** \`${String(s._id).slice(-6)}\` — <#${s.channelId}> — <t:${ts}:R>${s.repeat !== 'none' ? ` (${s.repeat})` : ''}\n└ ${s.message.slice(0, 50)}${s.message.length > 50 ? '...' : ''}`;
          }).join('\n\n')
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'delete') {
      const id = interaction.options.getString('id', true);
      const result = await ScheduleModel.findOneAndUpdate(
        { guildId, _id: id },
        { active: false }
      ).catch(() => null);
      if (!result) {
        await interaction.editReply({ embeds: [errorEmbed('Not Found', 'Schedule not found.')] });
        return;
      }
      await interaction.editReply({ embeds: [successEmbed('Deleted', 'Scheduled message removed.')] });
    }
  },
};

function parseTime(timeStr: string): Date | null {
  if (!timeStr) return null;

  if (/^\d{4}-/.test(timeStr)) {
    const d = new Date(timeStr);
    return isNaN(d.getTime()) ? null : d;
  }

  let totalMs = 0;
  const matches = timeStr.matchAll(/(\d+)(d|h|m|s)/g);
  for (const [, num, unit] of matches) {
    const n = parseInt(num, 10);
    if (unit === 'd') totalMs += n * 86400000;
    else if (unit === 'h') totalMs += n * 3600000;
    else if (unit === 'm') totalMs += n * 60000;
    else if (unit === 's') totalMs += n * 1000;
  }

  if (totalMs === 0) return null;
  return new Date(Date.now() + totalMs);
}

export default command;
