import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { getUserReminders, deleteUserReminder } from '../../../database/models/Reminder';

export const data = new SlashCommandBuilder()
  .setName('reminder')
  .setDescription('Manage your reminders')
  .addSubcommand(subcommand =>
    subcommand.setName('list')
      .setDescription('List all your active reminders')
  )
  .addSubcommand(subcommand =>
    subcommand.setName('delete')
      .setDescription('Delete a reminder')
      .addStringOption(option =>
        option.setName('id')
          .setDescription('The ID of the reminder to delete')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  
  if (subcommand === 'list') {
    await listReminders(interaction);
  } else if (subcommand === 'delete') {
    await deleteReminder(interaction);
  }
}

async function listReminders(interaction: ChatInputCommandInteraction) {
  const reminders = await getUserReminders(interaction.guildId!, interaction.user.id);
  
  if (reminders.length === 0) {
    const embed = new EmbedBuilder()
      .setColor('#7289da')
      .setTitle('📋 Your Reminders')
      .setDescription('You have no active reminders.\n\nUse `/remind` to create one!');
    
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  const embed = new EmbedBuilder()
    .setColor('#7289da')
    .setTitle('📋 Your Active Reminders')
    .setDescription(`You have **${reminders.length}** active reminder${reminders.length > 1 ? 's' : ''}`);
  
  // Show up to 5 reminders in the embed
  const displayReminders = reminders.slice(0, 5);
  
  for (const reminder of displayReminders) {
    const timeLeft = Math.max(0, reminder.remindAt.getTime() - Date.now());
    const timeLeftStr = formatTimeLeft(timeLeft);
    
    embed.addFields({
      name: `🆔 ${reminder._id.toString().slice(-6)} - ${timeLeftStr}`,
      value: `> ${reminder.message.slice(0, 100)}${reminder.message.length > 100 ? '...' : ''}\n⏰ <t:${Math.floor(reminder.remindAt.getTime() / 1000)}:R>`,
      inline: false
    });
  }
  
  if (reminders.length > 5) {
    embed.setFooter({ text: `And ${reminders.length - 5} more... Use /reminder delete <id> to remove specific ones` });
  } else {
    embed.setFooter({ text: 'Use /reminder delete <id> to remove reminders' });
  }
  
  // Create buttons for each reminder
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (const reminder of displayReminders) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`del_reminder_${reminder._id}`)
        .setLabel(`Delete`)
        .setStyle(ButtonStyle.Danger)
    );
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true, components: reminders.length <= 5 ? [row] : [] });
}

async function deleteReminder(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true);
  
  try {
    const success = await deleteUserReminder(interaction.guildId!, interaction.user.id, id);
    
    if (success) {
      const embed = new EmbedBuilder()
        .setColor('#55ff55')
        .setTitle('✅ Reminder Deleted')
        .setDescription('The reminder has been successfully deleted.');
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      const embed = new EmbedBuilder()
        .setColor('#ff5555')
        .setTitle('❌ Not Found')
        .setDescription('Reminder not found or you do not have permission to delete it.');
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor('#ff5555')
      .setTitle('❌ Error')
      .setDescription('An error occurred while deleting the reminder.');
    
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

function formatTimeLeft(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
