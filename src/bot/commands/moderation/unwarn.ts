import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember } from 'discord.js';
import { Command } from '../../../types';
import { WarnManager } from '../../../modules/moderation/WarnManager';
import { successEmbed, errorEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Remove a warning from a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption((o) => o.setName('warn-id').setDescription('Warn ID to remove').setRequired(true)),

  category: 'Moderation',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    if (!await isStaff(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
      return;
    }

    const target = interaction.options.getUser('user', true);
    const warnId = interaction.options.getString('warn-id', true);
    const removed = await WarnManager.removeWarn(interaction.guild.id, target.id, warnId);

    if (!removed) {
      await interaction.reply({ embeds: [errorEmbed('Not Found', `Warn ID \`${warnId}\` not found.`)], ephemeral: true });
      return;
    }

    await interaction.reply({ embeds: [successEmbed('Warning Removed', `Removed warn \`${warnId}\` from **${target.tag}**.`)] });
  },
};

export default command;
