import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../../types';
import { EconomyManager } from '../../../modules/economy/EconomyManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Transfer coins to another user')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to pay')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount to transfer')
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return;

    const user = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (!user || !amount) return;

    const result = await EconomyManager.transfer(interaction.member as any, user.id, amount);

    const embed = new EmbedBuilder()
      .setColor(result.success ? 0x57F287 : 0xED4245)
      .setTitle(result.success ? '✅ Transfer Complete' : '❌ Transfer Failed')
      .setDescription(result.message);

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
