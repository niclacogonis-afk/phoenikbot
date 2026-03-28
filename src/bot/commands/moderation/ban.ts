import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember } from 'discord.js';
import { Command } from '../../../types';
import { successEmbed, errorEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';
import { sendLog, modEmbed } from '../../../modules/logging/LogManager';
import { incrementStat } from '../../../database/models/StaffStats';
import { incrementDailyStat } from '../../../database/models/Stats';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for ban'))
    .addIntegerOption((o) => o.setName('delete-days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7)),

  category: 'Moderation',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    if (!await isStaff(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
      return;
    }

    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete-days') ?? 0;

    await target.send({
      embeds: [errorEmbed(`🔨 You were banned from ${interaction.guild.name}`, `**Reason:** ${reason}`)],
    }).catch(() => null);

    await interaction.guild.members.ban(target, { reason, deleteMessageSeconds: deleteDays * 86400 });

    const embed = modEmbed('🔨 Member Banned', [
      { name: 'User', value: `${target.username} (${target.id})`, inline: true },
      { name: 'Moderator', value: `${interaction.user.username}`, inline: true },
      { name: 'Reason', value: reason },
    ]);
    await sendLog(interaction.guild, embed, 'modlog');
    await incrementStat(interaction.guild.id, interaction.user.id, 'bans').catch(() => null);
    await incrementDailyStat(interaction.guild.id, 'bans').catch(() => null);
    await incrementDailyStat(interaction.guild.id, 'modActions').catch(() => null);

    await interaction.reply({ embeds: [successEmbed('Member Banned', `**${target.tag}** has been banned.\n**Reason:** ${reason}`)] });
  },
};

export default command;
