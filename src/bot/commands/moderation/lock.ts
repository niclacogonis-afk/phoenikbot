import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember, TextChannel, ChannelType, PermissionsBitField } from 'discord.js';
import { Command } from '../../../types';
import { successEmbed, errorEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock or unlock a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand((s) => s.setName('channel').setDescription('Lock a channel')
      .addChannelOption((o) => o.setName('channel').setDescription('Channel to lock').addChannelTypes(ChannelType.GuildText)))
    .addSubcommand((s) => s.setName('unlock').setDescription('Unlock a channel')
      .addChannelOption((o) => o.setName('channel').setDescription('Channel to unlock').addChannelTypes(ChannelType.GuildText))),

  category: 'Moderation',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    if (!await isStaff(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const channel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    const locked = sub === 'channel';

    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: locked ? false : null,
    });

    await interaction.reply({
      embeds: [successEmbed(locked ? '🔒 Channel Locked' : '🔓 Channel Unlocked', `${channel} has been ${locked ? 'locked' : 'unlocked'}.`)],
    });
  },
};

export default command;
