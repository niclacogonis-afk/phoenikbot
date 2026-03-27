import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember } from 'discord.js';
import { Command } from '../../../types';
import { successEmbed, errorEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';
import { sendLog, modEmbed } from '../../../modules/logging/LogManager';
import { incrementStat } from '../../../database/models/StaffStats';
import { incrementDailyStat } from '../../../database/models/Stats';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for kick')),

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

    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    await target.user.send({
      embeds: [errorEmbed(`👢 You were kicked from ${interaction.guild.name}`, `**Reason:** ${reason}`)],
    }).catch(() => null);

    await target.kick(reason);

    const embed = modEmbed('👢 Member Kicked', [
      { name: 'User', value: `${target.user.tag} (${target.user.id})`, inline: true },
      { name: 'Moderator', value: `${interaction.user.tag}`, inline: true },
      { name: 'Reason', value: reason },
    ], 0xFEE75C);
    await sendLog(interaction.guild, embed, 'modlog');
    await incrementStat(interaction.guild.id, interaction.user.id, 'kicks').catch(() => null);
    await incrementDailyStat(interaction.guild.id, 'modActions').catch(() => null);

    await interaction.reply({ embeds: [successEmbed('Member Kicked', `**${target.user.tag}** has been kicked.\n**Reason:** ${reason}`)] });
  },
};

export default command;
