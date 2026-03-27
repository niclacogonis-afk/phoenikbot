import { ModalSubmitInteraction } from 'discord.js';
import { ModalHandler } from '../../types';
import { BotClient } from '../client';
import { TagModel } from '../../database/models/Tag';
import { successEmbed, errorEmbed } from '../../utils/embed';

const handler: ModalHandler = {
  customId: 'tag',

  async execute(interaction: ModalSubmitInteraction, client: BotClient) {
    if (!interaction.guild) return;
    const parts = interaction.customId.split(':');
    const action = parts[1]!;
    const name = parts[2]!;

    if (action === 'create') {
      const content = interaction.fields.getTextInputValue('content');
      const existing = await TagModel.findOne({ guildId: interaction.guild.id, name });
      if (existing) {
        await interaction.reply({ embeds: [errorEmbed('Already Exists', `Tag \`${name}\` already exists.`)], ephemeral: true });
        return;
      }
      await TagModel.create({ guildId: interaction.guild.id, name, content, authorId: interaction.user.id });
      await interaction.reply({ embeds: [successEmbed('Tag Created', `Tag \`${name}\` created successfully.`)] });
    }
  },
};

export default handler;
