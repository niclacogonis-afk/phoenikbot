import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { setStickyMessage, removeStickyMessage, getStickyMessage } from '../../../database/models/StickyMessage';
import { StickyMessageManager } from '../../../modules/sticky/StickyMessageManager';
import { PermissionManager } from '../../../modules/permissions/PermissionManager';

export const data = new SlashCommandBuilder()
  .setName('sticky')
  .setDescription('Manage sticky messages in channels')
  .addSubcommand(subcommand =>
    subcommand.setName('set')
      .setDescription('Set a sticky message in a channel')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('The channel to set the sticky message')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('message')
          .setDescription('The message to display')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('remove')
      .setDescription('Remove sticky message from a channel')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('The channel to remove sticky message')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('preview')
      .setDescription('Preview the current sticky message in a channel')
      .addChannelOption(option =>
        option.setName('channel')
          .setDescription('The channel to preview')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  
  // Check permissions
  const member = interaction.member;
  if (!member || !interaction.guild) {
    return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
  }
  
  const isStaff = await PermissionManager.isStaff(member as any);
  if (!isStaff) {
    return interaction.reply({ content: '❌ You need Staff permissions to use this command.', ephemeral: true });
  }
  
  if (subcommand === 'set') {
    await setSticky(interaction);
  } else if (subcommand === 'remove') {
    await removeSticky(interaction);
  } else if (subcommand === 'preview') {
    await previewSticky(interaction);
  }
}

async function setSticky(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel', true) as TextChannel;
  const message = interaction.options.getString('message', true);
  
  // Limit message length
  if (message.length > 2000) {
    return interaction.reply({ 
      content: '❌ Message cannot exceed 2000 characters.',
      ephemeral: true 
    });
  }
  
  await setStickyMessage(interaction.guildId!, channel.id, message);
  
  // Post the sticky message
  const stickyMsg = await channel.send({
    content: message,
    allowedMentions: { parse: ['everyone', 'roles', 'users'] }
  });
  
  // Update the stored message ID
  const { updateStickyMessageId } = await import('../../../database/models/StickyMessage');
  await updateStickyMessageId(interaction.guildId!, channel.id, stickyMsg.id);
  
  const embed = new EmbedBuilder()
    .setColor('#55ff55')
    .setTitle('✅ Sticky Message Set')
    .setDescription(`Sticky message has been set in ${channel}`)
    .addFields(
      { name: '📝 Message', value: message.length > 1024 ? message.slice(0, 1021) + '...' : message, inline: false },
      { name: '📍 Channel', value: `${channel}`, inline: true }
    );
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function removeSticky(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel', true) as TextChannel;
  
  const sticky = await getStickyMessage(interaction.guildId!, channel.id);
  if (!sticky) {
    return interaction.reply({ 
      content: `❌ No sticky message found in ${channel}.`,
      ephemeral: true 
    });
  }
  
  // Remove the current sticky message
  await StickyMessageManager.removeSticky(channel);
  
  // Remove from database
  await removeStickyMessage(interaction.guildId!, channel.id);
  
  const embed = new EmbedBuilder()
    .setColor('#55ff55')
    .setTitle('✅ Sticky Message Removed')
    .setDescription(`Sticky message has been removed from ${channel}`);
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function previewSticky(interaction: ChatInputCommandInteraction) {
  const channel = interaction.options.getChannel('channel', true) as TextChannel;
  
  const sticky = await getStickyMessage(interaction.guildId!, channel.id);
  if (!sticky) {
    return interaction.reply({ 
      content: `❌ No sticky message found in ${channel}.`,
      ephemeral: true 
    });
  }
  
  const embed = new EmbedBuilder()
    .setColor('#7289da')
    .setTitle('📌 Sticky Message Preview')
    .setDescription(`Current sticky message in ${channel}`)
    .addFields(
      { name: '📝 Message', value: sticky.message.length > 1024 ? sticky.message.slice(0, 1021) + '...' : sticky.message, inline: false },
      { name: '📍 Channel', value: `${channel}`, inline: true },
      { name: '🔄 Updated', value: `<t:${Math.floor(sticky.updatedAt.getTime() / 1000)}:R>`, inline: true }
    );
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
