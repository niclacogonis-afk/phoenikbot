import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember } from 'discord.js';
import { Command } from '../../../types';
import { WarnManager } from '../../../modules/moderation/WarnManager';
import { successEmbed, errorEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),

  category: 'Moderation',
  cooldown: 3,

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
    if (target.user.bot) {
      await interaction.reply({ embeds: [errorEmbed('Invalid Target', 'Cannot warn bots.')], ephemeral: true });
      return;
    }

    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const { warnId, totalWarns, action } = await WarnManager.addWarn(target, reason, interaction.user.id);

    let desc = `**${target.user.tag}** has been warned.\n**Warn ID:** \`${warnId}\`\n**Total Warns:** ${totalWarns}`;
    if (action) desc += `\n**Auto Action:** ${action}`;

    await interaction.reply({ embeds: [successEmbed('Member Warned', desc)] });

    await target.user.send({
      embeds: [errorEmbed(`⚠️ You were warned in ${interaction.guild.name}`, `**Reason:** ${reason}\n**Total Warns:** ${totalWarns}`)],
    }).catch(() => null);
  },
};

export default command;
