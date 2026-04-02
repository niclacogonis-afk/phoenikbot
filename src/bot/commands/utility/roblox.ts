import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import { Command } from '../../../types';
import { BotClient } from '../../client';
import { getGuild } from '../../../database/models/Guild';
import { RobloxUpdateNotifier } from '../../../modules/roblox/RobloxUpdateNotifier';
import { successEmbed, errorEmbed } from '../../../utils/embed';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('roblox')
    .setDescription('Roblox utilities')
    .addSubcommand(sub => sub
      .setName('updates')
      .setDescription('Set channel for Roblox update notifications')
      .addChannelOption(o => o.setName('channel').setDescription('Channel for notifications').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub
      .setName('version')
      .setDescription('Check current Roblox version'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const sub = interaction.options.getSubcommand();

    if (sub === 'updates') {
      const channel = interaction.options.getChannel('channel', true);
      const guild = await getGuild(interaction.guild.id);

      // Store the channel ID in guild config
      (guild as any).robloxUpdatesChannel = channel.id;
      await (guild as any).save();

      await interaction.reply({ embeds: [successEmbed('Roblox Updates', `Update notifications will be sent to ${channel}.`)], ephemeral: true });

    } else if (sub === 'version') {
      await interaction.deferReply();
      const version = await RobloxUpdateNotifier.getCurrentVersion();

      if (version) {
        const embed = new EmbedBuilder()
          .setColor(0x00A2FF)
          .setTitle('Roblox Version')
          .setDescription(`Current Roblox version: \`${version}\``);
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.editReply({ embeds: [errorEmbed('Could not fetch Roblox version.')] });
      }
    }
  },
};

export default command;
