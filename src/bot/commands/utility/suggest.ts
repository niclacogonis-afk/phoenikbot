import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
} from 'discord.js';
import { Command } from '../../../types';
import { errorEmbed, successEmbed } from '../../../utils/embed';
import { isModuleEnabled } from '../../../modules/cache/CacheManager';
import { SuggestionModel } from '../../../database/models/Suggestion';
import { getGuild } from '../../../database/models/Guild';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Submit a suggestion')
    .addStringOption((o) => o.setName('suggestion').setDescription('Your suggestion').setRequired(true).setMaxLength(1000)),

  category: 'Utility',
  cooldown: 30,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    if (!await isModuleEnabled(interaction.guild.id, 'suggestions')) {
      await interaction.reply({ embeds: [errorEmbed('Module Disabled', 'Suggestions module is not enabled.')], ephemeral: true });
      return;
    }

    const guildData = await getGuild(interaction.guild.id);
    if (!guildData.suggestionsChannel) {
      await interaction.reply({ embeds: [errorEmbed('Not Configured', 'Suggestions channel is not set. Use `/config set suggestionschannel`.')], ephemeral: true });
      return;
    }

    const content = interaction.options.getString('suggestion', true);
    const suggestion = await SuggestionModel.create({
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      content,
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('💡 New Suggestion')
      .setDescription(content)
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .addFields(
        { name: '👍 Upvotes', value: '0', inline: true },
        { name: '👎 Downvotes', value: '0', inline: true },
        { name: 'Status', value: '⏳ Pending', inline: true },
      )
      .setFooter({ text: `Suggestion ID: ${suggestion._id}` })
      .setTimestamp();

    const voteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`suggestion:upvote:${suggestion._id}`).setLabel('Upvote').setEmoji('👍').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`suggestion:downvote:${suggestion._id}`).setLabel('Downvote').setEmoji('👎').setStyle(ButtonStyle.Danger),
    );

    const staffRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`suggestion:approve:${suggestion._id}`).setLabel('Approve').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`suggestion:reject:${suggestion._id}`).setLabel('Reject').setEmoji('❌').setStyle(ButtonStyle.Danger),
    );

    const channel = interaction.guild.channels.cache.get(guildData.suggestionsChannel);
    if (!channel?.isTextBased()) {
      await interaction.reply({ embeds: [errorEmbed('Channel Error')], ephemeral: true });
      return;
    }

    const msg = await (channel as import('discord.js').TextChannel).send({ embeds: [embed], components: [voteRow, staffRow] });
    suggestion.channelId = channel.id;
    suggestion.messageId = msg.id;
    await suggestion.save();

    await interaction.reply({ embeds: [successEmbed('Suggestion Submitted', 'Your suggestion has been posted!')], ephemeral: true });
  },
};

export default command;
