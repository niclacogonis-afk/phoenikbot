import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember,
  ChannelType, EmbedBuilder,
} from 'discord.js';
import { Command } from '../../../types';
import { errorEmbed, successEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';
import { GiveawayManager } from '../../../modules/giveaway/GiveawayManager';
import { GiveawayModel } from '../../../database/models/Giveaway';
import { parseDuration } from '../../../utils/formatters';
import { isModuleEnabled } from '../../../modules/cache/CacheManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Giveaway management')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s.setName('start').setDescription('Start a giveaway')
        .addStringOption((o) => o.setName('prize').setDescription('Prize').setRequired(true))
        .addStringOption((o) => o.setName('duration').setDescription('Duration (e.g. 1h, 1d)').setRequired(true))
        .addIntegerOption((o) => o.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1))
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText))
        .addRoleOption((o) => o.setName('required-role').setDescription('Required role to enter'))
        .addStringOption((o) => o.setName('description').setDescription('Extra description'))
    )
    .addSubcommand((s) =>
      s.setName('end').setDescription('End a giveaway early')
        .addStringOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('reroll').setDescription('Reroll winners')
        .addStringOption((o) => o.setName('id').setDescription('Giveaway ID').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('rigged').setDescription('Start a rigged giveaway (admin only)')
        .addStringOption((o) => o.setName('prize').setDescription('Prize').setRequired(true))
        .addStringOption((o) => o.setName('duration').setDescription('Duration').setRequired(true))
        .addUserOption((o) => o.setName('winner').setDescription('Pre-selected winner').setRequired(true))
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand((s) =>
      s.setName('list').setDescription('List active giveaways')
    ),

  category: 'Giveaway',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;

    if (!await isModuleEnabled(interaction.guild.id, 'giveaway')) {
      await interaction.reply({ embeds: [errorEmbed('Module Disabled', 'Enable giveaway module first.')], ephemeral: true });
      return;
    }

    if (!await isStaff(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const prize = interaction.options.getString('prize', true);
      const durationStr = interaction.options.getString('duration', true);
      const durationMs = parseDuration(durationStr);
      if (!durationMs) {
        await interaction.reply({ embeds: [errorEmbed('Invalid Duration')], ephemeral: true });
        return;
      }
      const winnerCount = interaction.options.getInteger('winners', true);
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      const requiredRole = interaction.options.getRole('required-role');
      const description = interaction.options.getString('description');

      await interaction.deferReply({ ephemeral: true });
      await GiveawayManager.create({
        guild: interaction.guild,
        channelId: channel!.id,
        hostId: interaction.user.id,
        prize,
        description: description ?? undefined,
        winnerCount,
        durationMs,
        requiredRole: requiredRole?.id,
      });
      await interaction.editReply({ embeds: [successEmbed('Giveaway Started', `Giveaway for **${prize}** has been started in <#${channel!.id}>!`)] });
      return;
    }

    if (sub === 'rigged') {
      const prize = interaction.options.getString('prize', true);
      const durationStr = interaction.options.getString('duration', true);
      const durationMs = parseDuration(durationStr);
      if (!durationMs) {
        await interaction.reply({ embeds: [errorEmbed('Invalid Duration')], ephemeral: true });
        return;
      }
      const winner = interaction.options.getUser('winner', true);
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;

      await interaction.deferReply({ ephemeral: true });
      await GiveawayManager.create({
        guild: interaction.guild,
        channelId: channel!.id,
        hostId: interaction.user.id,
        prize,
        winnerCount: 1,
        durationMs,
        isRigged: true,
        riggedWinner: winner.id,
      });
      await interaction.editReply({ embeds: [successEmbed('Rigged Giveaway Started', `Giveaway started. Winner: ${winner.tag} (only visible to you)`)] });
      return;
    }

    if (sub === 'end') {
      const id = interaction.options.getString('id', true);
      const giveaway = await GiveawayModel.findById(id);
      if (!giveaway || giveaway.guildId !== interaction.guild.id) {
        await interaction.reply({ embeds: [errorEmbed('Not Found')], ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const winners = await GiveawayManager.end(giveaway, interaction.guild);
      await interaction.editReply({ embeds: [successEmbed('Giveaway Ended', `Winners: ${winners.map((w) => `<@${w}>`).join(', ') || 'None'}`)] });
      return;
    }

    if (sub === 'reroll') {
      const id = interaction.options.getString('id', true);
      const giveaway = await GiveawayModel.findById(id);
      if (!giveaway || giveaway.guildId !== interaction.guild.id) {
        await interaction.reply({ embeds: [errorEmbed('Not Found')], ephemeral: true });
        return;
      }
      const winners = await GiveawayManager.reroll(giveaway, interaction.guild);
      await interaction.reply({ embeds: [successEmbed('Rerolled', `New winners: ${winners.map((w) => `<@${w}>`).join(', ') || 'None'}`)] });
      return;
    }

    if (sub === 'list') {
      const giveaways = await GiveawayModel.find({ guildId: interaction.guild.id, status: 'active' });
      if (giveaways.length === 0) {
        await interaction.reply({ embeds: [errorEmbed('No Active Giveaways')], ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(0xFF73FA)
        .setTitle('🎉 Active Giveaways')
        .setDescription(giveaways.map((g) =>
          `**${g.prize}** | ID: \`${g._id}\` | Ends: <t:${Math.floor(g.endsAt.getTime() / 1000)}:R> | Entries: ${g.entries.length}`
        ).join('\n'));
      await interaction.reply({ embeds: [embed] });
    }
  },
};

export default command;
