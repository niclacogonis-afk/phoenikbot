import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../../types';
import { EconomyManager } from '../../../modules/economy/EconomyManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your or another user\'s balance')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to check (default: yourself)')
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId!;

    const { balance, symbol, name } = await EconomyManager.getBalance(guildId, user.id);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`💰 ${user.username}'s Balance`)
      .addFields(
        { name: 'Current Balance', value: `${symbol}${balance.toLocaleString()}`, inline: true },
        { name: 'Currency', value: name, inline: true }
      )
      .setTimestamp();

    if (user.id !== interaction.user.id) {
      embed.setDescription(`<@${user.id}> has ${symbol}${balance.toLocaleString()} ${name}`);
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
