import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../../types';
import { StatsModel } from '../../../database/models/Stats';
import { UserModel } from '../../../database/models/User';
import { isModuleEnabled } from '../../../modules/cache/CacheManager';
import { errorEmbed } from '../../../utils/embed';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View server statistics')
    .addSubcommand((s) => s.setName('server').setDescription('View server stats'))
    .addSubcommand((s) => s.setName('user').setDescription('View user stats').addUserOption((o) => o.setName('user').setDescription('User to check'))),

  category: 'Utility',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    if (!await isModuleEnabled(interaction.guild.id, 'stats')) {
      await interaction.reply({ embeds: [errorEmbed('Module Disabled', 'Stats module is not enabled.')], ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();

    if (sub === 'server') {
      const today = new Date().toISOString().split('T')[0]!;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

      const [todayStats, weekStats] = await Promise.all([
        StatsModel.findOne({ guildId: interaction.guild.id, date: today }),
        StatsModel.aggregate([
          { $match: { guildId: interaction.guild.id, date: { $gte: sevenDaysAgo } } },
          { $group: { _id: null, messages: { $sum: '$messages' }, joins: { $sum: '$joins' }, bans: { $sum: '$bans' }, ticketsOpened: { $sum: '$ticketsOpened' } } },
        ]),
      ]);

      const week = weekStats[0] ?? {};
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📊 Stats for ${interaction.guild.name}`)
        .addFields(
          { name: "Today's Messages", value: String(todayStats?.messages ?? 0), inline: true },
          { name: "Today's Joins", value: String(todayStats?.joins ?? 0), inline: true },
          { name: "Today's Tickets", value: String(todayStats?.ticketsOpened ?? 0), inline: true },
          { name: '7-Day Messages', value: String(week.messages ?? 0), inline: true },
          { name: '7-Day Joins', value: String(week.joins ?? 0), inline: true },
          { name: '7-Day Bans', value: String(week.bans ?? 0), inline: true },
          { name: 'Members', value: `${interaction.guild.memberCount}`, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'user') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const userData = await UserModel.findOne({ guildId: interaction.guild.id, userId: target.id });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`👤 User Stats: ${target.tag}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: 'Warnings', value: String(userData?.warns.length ?? 0), inline: true },
          { name: 'Risk Score', value: String(userData?.riskScore ?? 0), inline: true },
          { name: 'Verified', value: userData?.verified ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Roblox', value: userData?.robloxUsername ?? 'Not linked', inline: true },
          { name: 'Risk Flags', value: userData?.riskFlags.join(', ') || 'None', inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
