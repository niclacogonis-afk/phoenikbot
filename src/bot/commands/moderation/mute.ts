import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember } from 'discord.js';
import { Command } from '../../../types';
import { successEmbed, errorEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';
import { sendLog, modEmbed } from '../../../modules/logging/LogManager';
import { parseDuration, formatDuration } from '../../../utils/formatters';
import { incrementStat } from '../../../database/models/StaffStats';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to mute').setRequired(true))
    .addStringOption((o) => o.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d)').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason')),

  category: 'Moderation',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    if (!await isStaff(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
      return;
    }

    const target = interaction.options.getMember('user') as GuildMember | null;
    if (!target) {
      await interaction.reply({ embeds: [errorEmbed('User Not Found')], ephemeral: true });
      return;
    }

    const durationStr = interaction.options.getString('duration', true);
    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      await interaction.reply({ embeds: [errorEmbed('Invalid Duration', 'Use formats like: 10m, 1h, 1d')], ephemeral: true });
      return;
    }

    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    await target.timeout(durationMs, reason);

    const embed = modEmbed('🔇 Member Muted', [
      { name: 'User', value: `${target.user.tag} (${target.user.id})`, inline: true },
      { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
      { name: 'Duration', value: formatDuration(durationMs), inline: true },
      { name: 'Reason', value: reason },
    ], 0xFEE75C);
    await sendLog(interaction.guild, embed, 'modlog');
    await incrementStat(interaction.guild.id, interaction.user.id, 'mutes').catch(() => null);

    await interaction.reply({
      embeds: [successEmbed('Member Muted', `**${target.user.tag}** muted for **${formatDuration(durationMs)}**.\n**Reason:** ${reason}`)],
    });
  },
};

export default command;
