import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../../types';
import mongoose from 'mongoose';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency and status'),

  category: 'Utility',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const start = Date.now();
    await interaction.deferReply();
    const latency = Date.now() - start;
    const apiLatency = Math.round(interaction.client.ws.ping);
    const dbStatus = mongoose.connection.readyState === 1 ? '🟢 Connected' : '🔴 Disconnected';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Bot Latency', value: `${latency}ms`, inline: true },
        { name: 'API Latency', value: `${apiLatency}ms`, inline: true },
        { name: 'Database', value: dbStatus, inline: true },
        { name: 'Guilds', value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: 'Uptime', value: `${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
