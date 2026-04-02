import {
  SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits
} from 'discord.js';
import { Command } from '../../../types';
import { BotClient } from '../../client';
import { EconomyManager } from '../../../modules/economy/EconomyManager';
import { getEconomyConfig, ShopItemModel } from '../../../database/models/Economy';
import { successEmbed, errorEmbed } from '../../../utils/embed';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Server shop')
    .addSubcommand(sub => sub
      .setName('browse')
      .setDescription('Browse and buy items from the server shop'))
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add an item to the shop (Admin)')
      .addRoleOption(o => o.setName('role').setDescription('Role given on purchase').setRequired(true))
      .addIntegerOption(o => o.setName('price').setDescription('Price in coins').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('name').setDescription('Item name (default: role name)'))
      .addStringOption(o => o.setName('description').setDescription('Item description'))
      .addIntegerOption(o => o.setName('stock').setDescription('Stock (-1 for unlimited)').setMinValue(-1)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove an item from the shop (Admin)')
      .addRoleOption(o => o.setName('role').setDescription('Role to remove from shop').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all shop items with IDs (Admin)')) as SlashCommandBuilder,

  category: 'Economy',

  async execute(interaction: ChatInputCommandInteraction, client: BotClient) {
    if (!interaction.guildId || !interaction.guild) return;

    const sub = interaction.options.getSubcommand(false);
    if (!sub) {
      await interaction.reply({ content: 'Use a subcommand: /shop browse, /shop add, /shop remove, /shop list', ephemeral: true });
      return;
    }

    if (sub === 'browse') {
      const items = await EconomyManager.getShopItems(interaction.guildId);
      const config = await getEconomyConfig(interaction.guildId);

      if (items.length === 0) {
        await interaction.reply({ content: 'The shop is empty! Ask an admin to add items.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Server Shop')
        .setDescription('Click a button below to purchase an item:')
        .addFields(
          items.slice(0, 10).map((item, i) => ({
            name: `${i + 1}. ${item.name}`,
            value: `${item.price} ${config.currencyName}\n${item.description || 'No description'}\n${item.stock === -1 ? 'In stock' : `${item.stock} left`}`,
            inline: true,
          }))
        );

      const buttons = items.slice(0, 5).map((item) =>
        new ButtonBuilder()
          .setCustomId(`shop:buy:${(item as any)._id}`)
          .setLabel(`Buy ${item.name}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🛒')
      );

      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + 5)));
      }

      await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });

    } else if (sub === 'add') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ embeds: [errorEmbed('You need Manage Server permission.')], ephemeral: true });
        return;
      }

      const role = interaction.options.getRole('role', true);
      const price = interaction.options.getInteger('price', true);
      const name = interaction.options.getString('name') || role.name;
      const description = interaction.options.getString('description') || '';
      const stock = interaction.options.getInteger('stock') ?? -1;

      try {
        await EconomyManager.addShopItem(interaction.guild, role.id, name, price, description, stock);
        await interaction.reply({ embeds: [successEmbed('Item Added', `**${name}** added to shop for **${price}** coins.`)], ephemeral: true });
      } catch (err: any) {
        await interaction.reply({ embeds: [errorEmbed(err.message || 'Failed to add item')], ephemeral: true });
      }

    } else if (sub === 'remove') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ embeds: [errorEmbed('You need Manage Server permission.')], ephemeral: true });
        return;
      }

      const role = interaction.options.getRole('role', true);
      const deleted = await ShopItemModel.deleteOne({ guildId: interaction.guildId, roleId: role.id });

      if (deleted.deletedCount > 0) {
        await interaction.reply({ embeds: [successEmbed('Item Removed', `${role.name} removed from shop.`)], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed('That role is not in the shop.')], ephemeral: true });
      }

    } else if (sub === 'list') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ embeds: [errorEmbed('You need Manage Server permission.')], ephemeral: true });
        return;
      }

      const items = await ShopItemModel.find({ guildId: interaction.guildId });
      if (items.length === 0) {
        await interaction.reply({ content: 'Shop is empty.', ephemeral: true });
        return;
      }

      const list = items.map((item, i) =>
        `**${i + 1}.** ${item.name} — ${item.price} coins — Role: <@&${item.roleId}> — Stock: ${item.stock === -1 ? 'Unlimited' : item.stock}`
      ).join('\n');

      await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Shop Items').setDescription(list).setColor(0x5865F2)], ephemeral: true });
    }
  },
};

export default command;
