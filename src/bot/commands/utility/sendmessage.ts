import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember,
  EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ChannelType, TextChannel,
} from 'discord.js';
import { Command } from '../../../types';
import { errorEmbed, successEmbed } from '../../../utils/embed';
import { isStaff } from '../../../modules/permissions/PermissionManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('sendmessage')
    .setDescription('Send a custom message or embed to a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((s) =>
      s.setName('embed').setDescription('Send a custom embed')
        .addChannelOption((o) => o.setName('channel').setDescription('Target channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('title').setDescription('Embed title').setRequired(true))
        .addStringOption((o) => o.setName('description').setDescription('Embed description').setRequired(true))
        .addStringOption((o) => o.setName('color').setDescription('Hex color (e.g. #5865F2)'))
        .addStringOption((o) => o.setName('image').setDescription('Image URL'))
        .addStringOption((o) => o.setName('thumbnail').setDescription('Thumbnail URL'))
        .addStringOption((o) => o.setName('footer').setDescription('Footer text'))
        .addStringOption((o) =>
          o.setName('button1_type').setDescription('Button 1 action')
            .addChoices(
              { name: 'Open Ticket', value: 'ticket' },
              { name: 'Assign Role', value: 'role' },
              { name: 'Create Thread', value: 'thread' },
              { name: 'Link', value: 'link' },
            )
        )
        .addStringOption((o) => o.setName('button1_label').setDescription('Button 1 label'))
        .addStringOption((o) => o.setName('button1_value').setDescription('Button 1 value (role ID, ticket type, link URL, or thread name)'))
        .addStringOption((o) =>
          o.setName('button2_type').setDescription('Button 2 action')
            .addChoices(
              { name: 'Open Ticket', value: 'ticket' },
              { name: 'Assign Role', value: 'role' },
              { name: 'Create Thread', value: 'thread' },
              { name: 'Link', value: 'link' },
            )
        )
        .addStringOption((o) => o.setName('button2_label').setDescription('Button 2 label'))
        .addStringOption((o) => o.setName('button2_value').setDescription('Button 2 value'))
        .addStringOption((o) =>
          o.setName('button3_type').setDescription('Button 3 action')
            .addChoices(
              { name: 'Open Ticket', value: 'ticket' },
              { name: 'Assign Role', value: 'role' },
              { name: 'Create Thread', value: 'thread' },
              { name: 'Link', value: 'link' },
            )
        )
        .addStringOption((o) => o.setName('button3_label').setDescription('Button 3 label'))
        .addStringOption((o) => o.setName('button3_value').setDescription('Button 3 value'))
    )
    .addSubcommand((s) =>
      s.setName('text').setDescription('Send a plain text message')
        .addChannelOption((o) => o.setName('channel').setDescription('Target channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('content').setDescription('Message content').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('edit').setDescription('Edit a message sent by the bot')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel containing the message').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('message_id').setDescription('Message ID to edit').setRequired(true))
        .addStringOption((o) => o.setName('title').setDescription('New embed title'))
        .addStringOption((o) => o.setName('description').setDescription('New embed description'))
        .addStringOption((o) => o.setName('color').setDescription('New hex color'))
    ),

  category: 'Utility',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) {
      await interaction.reply({ embeds: [errorEmbed('Error', 'Must be used in a server.')], ephemeral: true });
      return;
    }

    if (!await isStaff(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You need to be a staff member.')], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const channelOption = interaction.options.getChannel('channel', true);
    const targetChannel = interaction.guild.channels.cache.get(channelOption.id) as TextChannel | undefined;

    if (!targetChannel?.isTextBased()) {
      await interaction.editReply({ embeds: [errorEmbed('Error', 'Invalid channel.')] });
      return;
    }

    if (sub === 'text') {
      const content = interaction.options.getString('content', true);
      await (targetChannel as TextChannel).send({ content });
      await interaction.editReply({ embeds: [successEmbed('Message Sent', `Message sent to ${targetChannel}.`)] });
      return;
    }

    if (sub === 'edit') {
      const messageId = interaction.options.getString('message_id', true);
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const color = interaction.options.getString('color');

      try {
        const msg = await (targetChannel as TextChannel).messages.fetch(messageId);
        if (!msg.editable) {
          await interaction.editReply({ embeds: [errorEmbed('Error', 'Cannot edit this message.')] });
          return;
        }

        const existingEmbed = msg.embeds[0];
        const newEmbed = new EmbedBuilder();
        if (existingEmbed) {
          if (existingEmbed.title) newEmbed.setTitle(existingEmbed.title);
          if (existingEmbed.description) newEmbed.setDescription(existingEmbed.description);
          if (existingEmbed.color) newEmbed.setColor(existingEmbed.color);
          if (existingEmbed.image) newEmbed.setImage(existingEmbed.image.url);
          if (existingEmbed.thumbnail) newEmbed.setThumbnail(existingEmbed.thumbnail.url);
          if (existingEmbed.footer) newEmbed.setFooter({ text: existingEmbed.footer.text });
          if (existingEmbed.fields.length > 0) newEmbed.addFields(existingEmbed.fields);
        }
        if (title) newEmbed.setTitle(title);
        if (description) newEmbed.setDescription(description);
        if (color) newEmbed.setColor(color as `#${string}`);

        await msg.edit({ embeds: [newEmbed] });
        await interaction.editReply({ embeds: [successEmbed('Message Edited')] });
      } catch (err) {
        await interaction.editReply({ embeds: [errorEmbed('Error', 'Could not find or edit that message.')] });
      }
      return;
    }

    if (sub === 'embed') {
      const title = interaction.options.getString('title', true);
      const description = interaction.options.getString('description', true);
      const color = interaction.options.getString('color') ?? '#5865F2';
      const image = interaction.options.getString('image');
      const thumbnail = interaction.options.getString('thumbnail');
      const footer = interaction.options.getString('footer');

      let hexColor: `#${string}`;
      try {
        hexColor = (color.startsWith('#') ? color : `#${color}`) as `#${string}`;
      } catch {
        hexColor = '#5865F2';
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(hexColor)
        .setTimestamp();

      if (image) embed.setImage(image);
      if (thumbnail) embed.setThumbnail(thumbnail);
      if (footer) embed.setFooter({ text: footer });

      const buttons: ButtonBuilder[] = [];

      for (let i = 1; i <= 3; i++) {
        const type = interaction.options.getString(`button${i}_type`);
        const label = interaction.options.getString(`button${i}_label`);
        const value = interaction.options.getString(`button${i}_value`);

        if (!type || !label) continue;

        if (type === 'link') {
          if (!value || !value.startsWith('http')) continue;
          buttons.push(
            new ButtonBuilder()
              .setLabel(label)
              .setStyle(ButtonStyle.Link)
              .setURL(value)
          );
        } else if (type === 'ticket') {
          buttons.push(
            new ButtonBuilder()
              .setCustomId(`ticket:open:${value ?? 'support'}`)
              .setLabel(label)
              .setStyle(ButtonStyle.Primary)
          );
        } else if (type === 'role') {
          if (!value) continue;
          buttons.push(
            new ButtonBuilder()
              .setCustomId(`rr:toggle:${value}`)
              .setLabel(label)
              .setStyle(ButtonStyle.Secondary)
          );
        } else if (type === 'thread') {
          buttons.push(
            new ButtonBuilder()
              .setCustomId(`createthread:${value ?? 'discussion'}`)
              .setLabel(label)
              .setStyle(ButtonStyle.Success)
          );
        }
      }

      const components: ActionRowBuilder<ButtonBuilder>[] = [];
      if (buttons.length > 0) {
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons));
      }

      await (targetChannel as TextChannel).send({ embeds: [embed], components });
      await interaction.editReply({ embeds: [successEmbed('Embed Sent', `Embed sent to ${targetChannel}.`)] });
    }
  },
};

export default command;
