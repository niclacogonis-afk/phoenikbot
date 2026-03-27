import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../../types';
import { StaffStatsModel } from '../../../database/models/StaffStats';
import { errorEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';
import { GuildMember } from 'discord.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('staff')
    .setDescription('Staff management')
    .addSubcommand((s) =>
      s.setName('stats').setDescription('View staff stats')
        .addUserOption((o) => o.setName('user').setDescription('Staff member to check'))
    )
    .addSubcommand((s) => s.setName('leaderboard').setDescription('Staff leaderboard')),

  category: 'Staff',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    if (!await isStaff(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'stats') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const stats = await StaffStatsModel.findOne({ guildId: interaction.guild.id, userId: target.id });
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`👮 Staff Stats: ${target.tag}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: 'Warns Issued', value: String(stats?.warns ?? 0), inline: true },
          { name: 'Mutes', value: String(stats?.mutes ?? 0), inline: true },
          { name: 'Bans', value: String(stats?.bans ?? 0), inline: true },
          { name: 'Kicks', value: String(stats?.kicks ?? 0), inline: true },
          { name: 'Tickets Handled', value: String(stats?.ticketsHandled ?? 0), inline: true },
          { name: 'Tickets Claimed', value: String(stats?.ticketsClaimed ?? 0), inline: true },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'leaderboard') {
      const stats = await StaffStatsModel.find({ guildId: interaction.guild.id })
        .sort({ warns: -1, bans: -1, mutes: -1 })
        .limit(10);

      if (stats.length === 0) {
        await interaction.reply({ embeds: [errorEmbed('No Data', 'No staff stats recorded yet.')], ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('👮 Staff Leaderboard')
        .setDescription(
          stats.map((s, i) =>
            `**${i + 1}.** <@${s.userId}> — Warns: ${s.warns} | Bans: ${s.bans} | Tickets: ${s.ticketsHandled}`
          ).join('\n')
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }
  },
};

export default command;
