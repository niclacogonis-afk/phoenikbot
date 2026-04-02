import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import { Command } from '../../../types';
import { BotClient } from '../../client';
import { ChallengeManager } from '../../../modules/challenges/ChallengeManager';
import { ChallengeModel } from '../../../database/models/Challenge';
import { successEmbed, errorEmbed } from '../../../utils/embed';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('challenges')
    .setDescription('View and manage challenges')
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('View active challenges and your progress'))
    .addSubcommand(sub => sub
      .setName('claim')
      .setDescription('Claim a completed challenge reward')
      .addStringOption(o => o.setName('id').setDescription('Challenge ID').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Create a new challenge (Admin)')
      .addStringOption(o => o.setName('name').setDescription('Challenge name').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Challenge type').setRequired(true).addChoices(
        { name: 'Send Messages', value: 'messages' },
        { name: 'Voice Minutes', value: 'voice_minutes' },
        { name: 'Daily Streak', value: 'daily_streak' },
        { name: 'Gamble Wins', value: 'wins' },
      ))
      .addIntegerOption(o => o.setName('target').setDescription('Target amount').setRequired(true).setMinValue(1))
      .addIntegerOption(o => o.setName('reward').setDescription('Coin reward').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('description').setDescription('Challenge description')))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a challenge (Admin)')
      .addStringOption(o => o.setName('id').setDescription('Challenge ID').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all challenges with IDs (Admin)')) as SlashCommandBuilder,

  category: 'Economy',

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guildId) return;

    const sub = interaction.options.getSubcommand(false);
    if (!sub) {
      await interaction.reply({ content: 'Use a subcommand: /challenges view, /challenges add, /challenges remove, /challenges claim, /challenges list', ephemeral: true });
      return;
    }

    if (sub === 'view') {
      const userChallenges = await ChallengeManager.getUserChallenges(interaction.guildId, interaction.user.id);

      if (userChallenges.length === 0) {
        await interaction.reply({ content: 'No active challenges. Ask an admin to create some!', ephemeral: true });
        return;
      }

      const lines = userChallenges.map(uc => {
        const c = uc.challenge;
        const progress = `${uc.progress}/${c.target}`;
        const status = uc.claimed ? 'Claimed' : uc.completed ? 'Ready to claim!' : progress;
        const bar = createProgressBar(uc.progress, c.target);
        return `**${c.name}** (${c.description || c.type})\n${bar} ${status} — Reward: **${c.reward}** coins\nID: \`${(c as any)._id}\`\n`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Active Challenges')
        .setDescription(lines.join('\n'));

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'claim') {
      const id = interaction.options.getString('id', true);
      const result = await ChallengeManager.claimReward(interaction.guildId, interaction.user.id, id);

      if (result.success) {
        await interaction.reply({ embeds: [successEmbed('Reward Claimed!', result.message)], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed(result.message)], ephemeral: true });
      }

    } else if (sub === 'add') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ embeds: [errorEmbed('You need Manage Server permission.')], ephemeral: true });
        return;
      }

      const name = interaction.options.getString('name', true);
      const type = interaction.options.getString('type', true) as any;
      const target = interaction.options.getInteger('target', true);
      const reward = interaction.options.getInteger('reward', true);
      const description = interaction.options.getString('description') || '';

      await ChallengeManager.createChallenge(interaction.guildId, name, description, type, target, reward);
      await interaction.reply({ embeds: [successEmbed('Challenge Created', `**${name}** — ${target} ${type} — ${reward} coins reward.`)], ephemeral: true });

    } else if (sub === 'remove') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ embeds: [errorEmbed('You need Manage Server permission.')], ephemeral: true });
        return;
      }

      const id = interaction.options.getString('id', true);
      const deleted = await ChallengeManager.deleteChallenge(id);

      if (deleted) {
        await interaction.reply({ embeds: [successEmbed('Challenge Removed', 'Challenge deleted.')], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed('Challenge not found.')], ephemeral: true });
      }

    } else if (sub === 'list') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ embeds: [errorEmbed('You need Manage Server permission.')], ephemeral: true });
        return;
      }

      const challenges = await ChallengeModel.find({ guildId: interaction.guildId });
      if (challenges.length === 0) {
        await interaction.reply({ content: 'No challenges created.', ephemeral: true });
        return;
      }

      const list = challenges.map((c, i) =>
        `**${i + 1}.** ${c.name} — ${c.target} ${c.type} — ${c.reward} coins — ${c.active ? 'Active' : 'Inactive'} — ID: \`${(c as any)._id}\``
      ).join('\n');

      await interaction.reply({ embeds: [new EmbedBuilder().setTitle('All Challenges').setDescription(list).setColor(0x5865F2)], ephemeral: true });
    }
  },
};

function createProgressBar(current: number, max: number, length: number = 10): string {
  const percent = Math.min(current / max, 1);
  const filled = Math.round(percent * length);
  const empty = length - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

export default command;
