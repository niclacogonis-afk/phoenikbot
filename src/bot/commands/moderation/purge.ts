import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, TextChannel } from 'discord.js';
import { Command } from '../../../types';
import { successEmbed, errorEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((o) => o.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((o) => o.setName('user').setDescription('Only delete messages from this user')),

  category: 'Moderation',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    if (!await isStaff(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
      return;
    }

    const amount = interaction.options.getInteger('amount', true);
    const targetUser = interaction.options.getUser('user');
    const channel = interaction.channel as TextChannel;

    await interaction.deferReply({ ephemeral: true });

    let messages = await channel.messages.fetch({ limit: 100 });
    if (targetUser) {
      messages = messages.filter((m) => m.author.id === targetUser.id);
    }
    const toDelete = [...messages.values()].slice(0, amount);

    const deleted = await channel.bulkDelete(toDelete, true);

    await interaction.editReply({
      embeds: [successEmbed('Messages Purged', `Deleted **${deleted.size}** message(s).`)],
    });
  },
};

export default command;
