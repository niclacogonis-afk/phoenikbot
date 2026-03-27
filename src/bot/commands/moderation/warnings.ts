import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, EmbedBuilder } from 'discord.js';
import { Command } from '../../../types';
import { WarnManager } from '../../../modules/moderation/WarnManager';
import { errorEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';
import { formatDate } from '../../../utils/formatters';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to check').setRequired(true)),

  category: 'Moderation',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    if (!await isStaff(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
      return;
    }

    const target = interaction.options.getUser('user', true);
    const warns = await WarnManager.getWarns(interaction.guild.id, target.id);

    if (warns.length === 0) {
      await interaction.reply({ embeds: [errorEmbed('No Warnings', `${target.tag} has no warnings.`)], ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle(`⚠️ Warnings for ${target.tag}`)
      .setDescription(
        warns.map((w, i) =>
          `**${i + 1}.** \`${w.id}\` — <@${w.moderatorId}>\n${w.reason}\n*${formatDate(w.timestamp)}*`
        ).join('\n\n')
      )
      .setFooter({ text: `Total: ${warns.length}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
