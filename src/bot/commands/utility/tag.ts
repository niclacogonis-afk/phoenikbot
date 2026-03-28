import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
} from 'discord.js';
import { Command } from '../../../types';
import { errorEmbed, successEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';
import { TagModel } from '../../../database/models/Tag';
import { GuildMember } from 'discord.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Tag/FAQ system')
    .addSubcommand((s) => s.setName('create').setDescription('Create a tag').addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true)))
    .addSubcommand((s) => s.setName('delete').setDescription('Delete a tag').addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true)))
    .addSubcommand((s) => s.setName('get').setDescription('Use a tag').addStringOption((o) => o.setName('name').setDescription('Tag name').setRequired(true)).addUserOption((o) => o.setName('user').setDescription('Mention a user')))
    .addSubcommand((s) => s.setName('list').setDescription('List all tags')),

  category: 'Utility',
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      if (!await isStaff(interaction.member)) {
        await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
        return;
      }
      const name = interaction.options.getString('name', true).toLowerCase();
      const modal = new ModalBuilder()
        .setCustomId(`tag:create:${name}`)
        .setTitle(`Create Tag: ${name}`)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('content').setLabel('Tag Content').setStyle(TextInputStyle.Paragraph).setRequired(true)
          )
        );
      await interaction.showModal(modal);
      return;
    }

    if (sub === 'delete') {
      if (!await isStaff(interaction.member)) {
        await interaction.reply({ embeds: [errorEmbed('Permission Denied')], ephemeral: true });
        return;
      }
      const name = interaction.options.getString('name', true).toLowerCase();
      const deleted = await TagModel.findOneAndDelete({ guildId: interaction.guild.id, name });
      if (!deleted) {
        await interaction.reply({ embeds: [errorEmbed('Not Found', `Tag \`${name}\` not found.`)], ephemeral: true });
        return;
      }
      await interaction.reply({ embeds: [successEmbed('Tag Deleted', `Tag \`${name}\` deleted.`)] });
      return;
    }

    if (sub === 'get') {
      const name = interaction.options.getString('name', true).toLowerCase();
      const targetUser = interaction.options.getUser('user');

      const tag = await TagModel.findOne({
        guildId: interaction.guild.id,
        $or: [{ name }, { aliases: name }],
      });

      if (!tag) {
        await interaction.reply({ embeds: [errorEmbed('Not Found', `Tag \`${name}\` not found.`)], ephemeral: true });
        return;
      }

      tag.uses++;
      await tag.save();

      await interaction.reply({ content: tag.isEmbed ? (targetUser ? `${targetUser}` : undefined) : (targetUser ? `${targetUser}\n${tag.content}` : tag.content) });
      return;
    }

    if (sub === 'list') {
      const tags = await TagModel.find({ guildId: interaction.guild.id }).sort({ name: 1 });
      if (tags.length === 0) {
        await interaction.reply({ embeds: [errorEmbed('No Tags', 'No tags have been created yet.')], ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Server Tags')
        .setDescription(tags.map((t) => `\`${t.name}\`${t.aliases.length ? ` (aliases: ${t.aliases.join(', ')})` : ''}`).join(', '))
        .setFooter({ text: `Total: ${tags.length}` });
      await interaction.reply({ embeds: [embed] });
    }
  },
};

export default command;
