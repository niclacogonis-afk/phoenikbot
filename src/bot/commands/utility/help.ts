import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ComponentType,
} from 'discord.js';
import { Command } from '../../../types';

const CATEGORIES: Record<string, { emoji: string; description: string }> = {
  'Admin': { emoji: '⚙️', description: 'Bot configuration and admin tools' },
  'Moderation': { emoji: '🛡️', description: 'Moderation commands' },
  'Ticket': { emoji: '🎫', description: 'Ticket system' },
  'Giveaway': { emoji: '🎉', description: 'Giveaway system' },
  'Verification': { emoji: '✅', description: 'Member verification' },
  'Utility': { emoji: '🔧', description: 'General utility commands' },
  'Staff': { emoji: '👮', description: 'Staff management' },
  'YouTube': { emoji: '🔴', description: 'YouTube notifications' },
  'Twitch': { emoji: '🟣', description: 'Twitch notifications' },
  'Roblox': { emoji: '🎮', description: 'Roblox integration' },
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all bot commands')
    .addStringOption((o) =>
      o.setName('command').setDescription('Get help for a specific command').setAutocomplete(true)
    ),

  category: 'Utility',
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const specificCmd = interaction.options.getString('command');
    const { BotClient } = await import('../../client');
    const client = interaction.client as import('../../client').BotClient;

    if (specificCmd) {
      const cmd = client.commands.get(specificCmd);
      if (!cmd) {
        const { errorEmbed } = await import('../../../utils/embed');
        await interaction.reply({ embeds: [errorEmbed('Command Not Found', `No command named \`${specificCmd}\`.`)], ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Help: /${cmd.data.name}`)
        .setDescription(cmd.data.description)
        .addFields(
          { name: 'Category', value: cmd.category ?? 'General', inline: true },
          { name: 'Cooldown', value: `${cmd.cooldown ?? 3}s`, inline: true },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const mainEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 PhoenikBot Help')
      .setDescription('Select a category from the menu below to view commands.')
      .addFields(
        Object.entries(CATEGORIES).map(([cat, info]) => ({
          name: `${info.emoji} ${cat}`,
          value: info.description,
          inline: true,
        }))
      )
      .setFooter({ text: `Total commands: ${client.commands.size}` })
      .setTimestamp();

    const menu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('help:category')
        .setPlaceholder('Select a category')
        .addOptions(
          Object.entries(CATEGORIES).map(([cat, info]) =>
            new StringSelectMenuOptionBuilder().setLabel(cat).setValue(cat).setEmoji(info.emoji).setDescription(info.description)
          )
        )
    );

    const reply = await interaction.reply({ embeds: [mainEmbed], components: [menu], ephemeral: true, fetchReply: true });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (i) => {
      const category = i.values[0]!;
      const cmds = [...client.commands.values()].filter((c) => c.category === category);
      const catInfo = CATEGORIES[category] ?? { emoji: '📋', description: '' };

      const catEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${catInfo.emoji} ${category} Commands`)
        .setDescription(cmds.length ? cmds.map((c) => `\`/${c.data.name}\` — ${c.data.description}`).join('\n') : 'No commands in this category.')
        .setTimestamp();

      await i.update({ embeds: [catEmbed], components: [menu] });
    });
  },
};

export default command;
