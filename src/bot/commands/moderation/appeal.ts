import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember, ModalSubmitInteraction } from 'discord.js';
import { createAppeal, getPendingAppeals, reviewAppeal, hasActiveAppeal, IAppeal } from '../../../database/models/Appeal';
import { PermissionManager } from '../../../modules/permissions/PermissionManager';
import { ButtonInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('appeal')
  .setDescription('Appeal a moderation action')
  .addSubcommand(subcommand =>
    subcommand.setName('submit')
      .setDescription('Submit an appeal')
      .addStringOption(option =>
        option.setName('type')
          .setDescription('Type of punishment')
          .setRequired(true)
          .addChoices(
            { name: '🔨 Ban', value: 'ban' },
            { name: '🔇 Mute', value: 'mute' },
            { name: '⏱️ Timeout', value: 'timeout' },
            { name: '⚠️ Warning', value: 'warn' }
          )
      )
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('The reason given for the punishment')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('message')
          .setDescription('Why should your appeal be approved?')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('status')
      .setDescription('Check your appeal status')
  )
  .addSubcommand(subcommand =>
    subcommand.setName('review')
      .setDescription('Review pending appeals (Staff only)')
  )
  .addSubcommand(subcommand =>
    subcommand.setName('approve')
      .setDescription('Approve an appeal (Admin only)')
      .addStringOption(option =>
        option.setName('appeal_id')
          .setDescription('The appeal ID')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('note')
          .setDescription('Optional note for the approval')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('reject')
      .setDescription('Reject an appeal (Admin only)')
      .addStringOption(option =>
        option.setName('appeal_id')
          .setDescription('The appeal ID')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('reason')
          .setDescription('Reason for rejection')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  
  if (subcommand === 'submit') {
    await submitAppeal(interaction);
  } else if (subcommand === 'status') {
    await checkStatus(interaction);
  } else if (subcommand === 'review') {
    await reviewAppeals(interaction);
  } else if (subcommand === 'approve') {
    await approveAppeal(interaction);
  } else if (subcommand === 'reject') {
    await rejectAppeal(interaction);
  }
}

async function submitAppeal(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
  }
  
  const appealType = interaction.options.getString('type', true) as IAppeal['appealType'];
  const reason = interaction.options.getString('reason', true);
  const message = interaction.options.getString('message', true);
  
  // Check if user already has a pending appeal
  const hasPending = await hasActiveAppeal(interaction.guildId!, interaction.user.id);
  if (hasPending) {
    return interaction.reply({ 
      content: '❌ You already have a pending appeal. Please wait for it to be reviewed.',
      ephemeral: true 
    });
  }
  
  // Create the appeal
  await createAppeal(
    interaction.guildId!,
    interaction.user.id,
    interaction.user.tag,
    appealType,
    reason,
    message
  );
  
  const embed = new EmbedBuilder()
    .setColor('#55ff55')
    .setTitle('✅ Appeal Submitted')
    .setDescription('Your appeal has been submitted and will be reviewed by the staff team.')
    .addFields(
      { name: '📋 Type', value: appealType, inline: true },
      { name: '📝 Reason Given', value: reason.length > 100 ? reason.slice(0, 97) + '...' : reason, inline: true },
      { name: '💬 Your Message', value: message.length > 100 ? message.slice(0, 97) + '...' : message, inline: false }
    )
    .setFooter({ text: 'You will be notified when your appeal is reviewed.' });
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
  
  // Notify staff
  const staffMention = interaction.guild.roles.cache
    .filter(role => role.permissions.has('ManageMessages'))
    .map(role => role.toString())
    .join(', ');
  
  const notifyEmbed = new EmbedBuilder()
    .setColor('#faa61a')
    .setTitle('📋 New Appeal Submitted')
    .setDescription(`${interaction.user.toString()} has submitted an appeal.`)
    .addFields(
      { name: '👤 User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
      { name: '📋 Type', value: appealType, inline: true },
      { name: '📝 Reason', value: reason, inline: false },
      { name: '💬 Appeal Message', value: message, inline: false }
    )
    .setTimestamp();
  
  const appealChannel = interaction.guild.channels.cache.find(ch => 
    ch.name.includes('appeal') || ch.name.includes('staff')
  );
  
  if (appealChannel?.isTextBased()) {
    await appealChannel.send({ 
      content: staffMention || 'Staff', 
      embeds: [notifyEmbed] 
    });
  }
}

async function checkStatus(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return;
  
  const { getUserAppeal } = await import('../../../database/models/Appeal');
  const appeal = await getUserAppeal(interaction.guildId!, interaction.user.id);
  
  if (!appeal) {
    return interaction.reply({ 
      content: '📋 You have no pending appeals.',
      ephemeral: true 
    });
  }
  
  const statusColors = {
    pending: '#faa61a',
    approved: '#55ff55',
    rejected: '#ff5555',
  };
  
  const statusEmoji = {
    pending: '⏳',
    approved: '✅',
    rejected: '❌',
  };
  
  const embed = new EmbedBuilder()
    .setColor(statusColors[appeal.status] as any)
    .setTitle(`${statusEmoji[appeal.status]} Appeal Status: ${appeal.status.toUpperCase()}`)
    .addFields(
      { name: '📋 Type', value: appeal.appealType, inline: true },
      { name: '📝 Reason', value: appeal.reason, inline: true },
      { name: '💬 Your Message', value: appeal.appealMessage, inline: false },
      { name: '📅 Submitted', value: `<t:${Math.floor(appeal.createdAt.getTime() / 1000)}:R>`, inline: true }
    );
  
  if (appeal.reviewNote) {
    embed.addFields({ name: '📝 Staff Note', value: appeal.reviewNote, inline: false });
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function reviewAppeals(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) return;
  
  const isStaff = await PermissionManager.isStaff(interaction.member as GuildMember);
  if (!isStaff) {
    return interaction.reply({ content: '❌ You need Staff permissions to review appeals.', ephemeral: true });
  }
  
  const appeals = await getPendingAppeals(interaction.guildId!);
  
  if (appeals.length === 0) {
    return interaction.reply({ 
      content: '📋 No pending appeals.',
      ephemeral: true 
    });
  }
  
  const embed = new EmbedBuilder()
    .setColor('#7289da')
    .setTitle('📋 Pending Appeals')
    .setDescription(`**${appeals.length}** pending appeal${appeals.length > 1 ? 's' : ''}`);
  
  for (const appeal of appeals.slice(0, 5)) {
    embed.addFields({
      name: `ID: ${appeal._id.toString().slice(-6)} - ${appeal.userTag}`,
      value: `Type: ${appeal.appealType}\nReason: ${appeal.reason.slice(0, 50)}...\nSubmitted: <t:${Math.floor(appeal.createdAt.getTime() / 1000)}:R>`,
      inline: false
    });
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function approveAppeal(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) return;
  
  const isAdmin = await PermissionManager.isAdmin(interaction.member as GuildMember);
  if (!isAdmin) {
    return interaction.reply({ content: '❌ You need Admin permissions to approve appeals.', ephemeral: true });
  }
  
  const appealId = interaction.options.getString('appeal_id', true);
  const note = interaction.options.getString('note') || undefined;
  
  const appeal = await reviewAppeal(appealId, 'approved', interaction.user.id, note);
  
  if (!appeal) {
    return interaction.reply({ content: '❌ Appeal not found.', ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setColor('#55ff55')
    .setTitle('✅ Appeal Approved')
    .setDescription(`Appeal for ${appeal.userTag} has been approved.`)
    .addFields(
      { name: '📋 Type', value: appeal.appealType, inline: true },
      { name: '👤 Reviewed By', value: interaction.user.tag, inline: true }
    );
  
  if (note) {
    embed.addFields({ name: '📝 Note', value: note, inline: false });
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
  
  // Notify the user
  try {
    const user = await interaction.client.users.fetch(appeal.userId);
    const notifyEmbed = new EmbedBuilder()
      .setColor('#55ff55')
      .setTitle('✅ Your Appeal Has Been Approved!')
      .setDescription(`Your appeal for **${appeal.appealType}** has been approved by ${interaction.user.tag}.`)
      .addFields(
        { name: '📋 Type', value: appeal.appealType, inline: true },
        { name: '📝 Original Reason', value: appeal.reason, inline: false }
      );
    
    if (note) {
      notifyEmbed.addFields({ name: '📝 Staff Note', value: note, inline: false });
    }
    
    await user.send({ embeds: [notifyEmbed] });
  } catch {
    // User might have DMs disabled
  }
}

async function rejectAppeal(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) return;
  
  const isAdmin = await PermissionManager.isAdmin(interaction.member as GuildMember);
  if (!isAdmin) {
    return interaction.reply({ content: '❌ You need Admin permissions to reject appeals.', ephemeral: true });
  }
  
  const appealId = interaction.options.getString('appeal_id', true);
  const reason = interaction.options.getString('reason', true);
  
  const appeal = await reviewAppeal(appealId, 'rejected', interaction.user.id, reason);
  
  if (!appeal) {
    return interaction.reply({ content: '❌ Appeal not found.', ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setColor('#ff5555')
    .setTitle('❌ Appeal Rejected')
    .setDescription(`Appeal for ${appeal.userTag} has been rejected.`)
    .addFields(
      { name: '📋 Type', value: appeal.appealType, inline: true },
      { name: '👤 Reviewed By', value: interaction.user.tag, inline: true },
      { name: '❌ Rejection Reason', value: reason, inline: false }
    );
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
  
  // Notify the user
  try {
    const user = await interaction.client.users.fetch(appeal.userId);
    const notifyEmbed = new EmbedBuilder()
      .setColor('#ff5555')
      .setTitle('❌ Your Appeal Has Been Rejected')
      .setDescription(`Your appeal for **${appeal.appealType}** has been rejected.`)
      .addFields(
        { name: '📋 Type', value: appeal.appealType, inline: true },
        { name: '📝 Original Reason', value: appeal.reason, inline: false },
        { name: '❌ Rejection Reason', value: reason, inline: false }
      )
      .setFooter({ text: 'If you believe this was a mistake, you can submit another appeal with new information.' });
    
    await user.send({ embeds: [notifyEmbed] });
  } catch {
    // User might have DMs disabled
  }
}
