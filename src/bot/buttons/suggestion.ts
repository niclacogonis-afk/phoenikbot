import { ButtonInteraction, GuildMember, EmbedBuilder } from 'discord.js';
import { ButtonHandler } from '../../types';
import { BotClient } from '../client';
import { SuggestionModel } from '../../database/models/Suggestion';
import { successEmbed, errorEmbed } from '../../utils/embed';
import { isStaff } from '../../modules/permissions/PermissionManager';

const handler: ButtonHandler = {
  customId: 'suggestion',

  async execute(interaction: ButtonInteraction, client: BotClient) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    const parts = interaction.customId.split(':');
    const action = parts[1]!;
    const id = parts[2]!;

    const suggestion = await SuggestionModel.findById(id);
    if (!suggestion) {
      await interaction.reply({ embeds: [errorEmbed('Not Found')], ephemeral: true });
      return;
    }

    if (action === 'upvote' || action === 'downvote') {
      const userId = interaction.user.id;
      if (action === 'upvote') {
        if (suggestion.upvotes.includes(userId)) {
          suggestion.upvotes = suggestion.upvotes.filter((u) => u !== userId);
        } else {
          suggestion.upvotes.push(userId);
          suggestion.downvotes = suggestion.downvotes.filter((u) => u !== userId);
        }
      } else {
        if (suggestion.downvotes.includes(userId)) {
          suggestion.downvotes = suggestion.downvotes.filter((u) => u !== userId);
        } else {
          suggestion.downvotes.push(userId);
          suggestion.upvotes = suggestion.upvotes.filter((u) => u !== userId);
        }
      }
      await suggestion.save();

      const msg = await interaction.message.fetch();
      const embed = EmbedBuilder.from(msg.embeds[0]!);
      const fields = embed.data.fields ?? [];
      const upField = fields.find((f) => f.name.includes('Upvotes'));
      const downField = fields.find((f) => f.name.includes('Downvotes'));
      if (upField) upField.value = String(suggestion.upvotes.length);
      if (downField) downField.value = String(suggestion.downvotes.length);

      await interaction.update({ embeds: [embed] });
      return;
    }

    if (!await isStaff(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
      return;
    }

    if (action === 'approve') {
      suggestion.status = 'approved';
      suggestion.reviewedBy = interaction.user.id;
      await suggestion.save();

      const msg = await interaction.message.fetch();
      const embed = EmbedBuilder.from(msg.embeds[0]!).setColor(0x57F287);
      const statusField = embed.data.fields?.find((f) => f.name === 'Status');
      if (statusField) statusField.value = '✅ Approved';
      await interaction.update({ embeds: [embed] });
    } else if (action === 'reject') {
      suggestion.status = 'rejected';
      suggestion.reviewedBy = interaction.user.id;
      await suggestion.save();

      const msg = await interaction.message.fetch();
      const embed = EmbedBuilder.from(msg.embeds[0]!).setColor(0xED4245);
      const statusField = embed.data.fields?.find((f) => f.name === 'Status');
      if (statusField) statusField.value = '❌ Rejected';
      await interaction.update({ embeds: [embed] });
    }
  },
};

export default handler;
