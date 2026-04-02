import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { createReminder } from '../../../database/models/Reminder';

export const data = new SlashCommandBuilder()
  .setName('remind')
  .setDescription('Set a reminder for yourself')
  .addStringOption(option =>
    option.setName('time')
      .setDescription('Time until reminder (e.g., 10m, 2h, 1d)')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('message')
      .setDescription('What to remind you about')
      .setRequired(true)
  );

function parseTime(timeStr: string): number {
  const match = timeStr.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 0;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `${seconds} second${seconds > 1 ? 's' : ''}`;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const timeStr = interaction.options.getString('time', true);
  const message = interaction.options.getString('message', true);
  
  const duration = parseTime(timeStr);
  
  if (duration === 0) {
    const embed = new EmbedBuilder()
      .setColor('#ff5555')
      .setTitle('❌ Invalid Time Format')
      .setDescription('Please use a valid time format:\n• `30s` - 30 seconds\n• `10m` - 10 minutes\n• `2h` - 2 hours\n• `1d` - 1 day');
    
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  // Max 30 days
  const maxDuration = 30 * 24 * 60 * 60 * 1000;
  if (duration > maxDuration) {
    const embed = new EmbedBuilder()
      .setColor('#ff5555')
      .setTitle('❌ Time Too Long')
      .setDescription('Maximum reminder time is 30 days.');
    
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  
  const remindAt = new Date(Date.now() + duration);
  
  await createReminder(
    interaction.guildId!,
    interaction.user.id,
    interaction.channelId,
    message,
    remindAt
  );
  
  const embed = new EmbedBuilder()
    .setColor('#55ff55')
    .setTitle('✅ Reminder Set!')
    .setDescription(`I'll remind you in **${formatDuration(duration)}** about:\n> ${message}`)
    .addFields(
      { name: '📅 Reminder Time', value: `<t:${Math.floor(remindAt.getTime() / 1000)}:F>`, inline: true },
      { name: '⏰ Time Left', value: formatDuration(duration), inline: true }
    )
    .setFooter({ text: 'Use /reminder list to see all your reminders' });
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
