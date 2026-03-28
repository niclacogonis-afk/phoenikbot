import {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  InteractionType,
  ComponentType,
} from 'discord.js';
import { BotEvent } from '../../types';
import { BotClient } from '../client';
import { logger } from '../../utils/logger';
import { errorEmbed } from '../../utils/embed';
import { checkCooldown } from '../../utils/rateLimit';

const event: BotEvent = {
  name: 'interactionCreate',
  async execute(interaction: Interaction, client: BotClient) {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction, client);
    } else if (interaction.isButton()) {
      await handleButton(interaction, client);
    } else if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction, client);
    } else if (interaction.type === InteractionType.ModalSubmit) {
      await handleModal(interaction as ModalSubmitInteraction, client);
    }
  },
};

async function handleCommand(interaction: ChatInputCommandInteraction, client: BotClient) {
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  if (command.ownerOnly && !interaction.client.application?.owner?.id) return;

  const cooldownMs = (command.cooldown ?? 3) * 1000;
  const remaining = checkCooldown(command.data.name, interaction.user.id, cooldownMs);
  if (remaining > 0) {
    await interaction.reply({
      embeds: [errorEmbed('Cooldown', `Please wait **${(remaining / 1000).toFixed(1)}s** before using this command again.`)],
      ephemeral: true,
    });
    return;
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    logger.error(`Command error [${interaction.commandName}]:`, error instanceof Error ? error : new Error(String(error)));
    const errEmbed = errorEmbed('Error', 'An unexpected error occurred. Please try again later.');
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
    } else {
      await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
    }
  }
}

async function handleButton(interaction: ButtonInteraction, client: BotClient) {
  const customId = interaction.customId;
  const prefix = customId.split(':')[0]!;

  const handler = client.buttons.get(customId) ?? client.buttons.get(prefix);
  if (!handler) return;

  try {
    await handler.execute(interaction, client);
  } catch (error) {
    logger.error(`Button error [${customId}]:`, error instanceof Error ? error : new Error(String(error)));
    const errEmbed = errorEmbed('Error', 'Something went wrong.');
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
    } else {
      await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
    }
  }
}

async function handleSelectMenu(interaction: StringSelectMenuInteraction, client: BotClient) {
  const customId = interaction.customId;
  const prefix = customId.split(':')[0]!;

  const handler = client.selectMenus.get(customId) ?? client.selectMenus.get(prefix);
  if (!handler) return;

  try {
    await handler.execute(interaction, client);
  } catch (error) {
    logger.error(`SelectMenu error [${customId}]:`, error instanceof Error ? error : new Error(String(error)));
    const errEmbed = errorEmbed('Error', 'Something went wrong.');
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
    } else {
      await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
    }
  }
}

async function handleModal(interaction: ModalSubmitInteraction, client: BotClient) {
  const customId = interaction.customId;
  const prefix = customId.split(':')[0]!;

  const handler = client.modals.get(customId) ?? client.modals.get(prefix);
  if (!handler) return;

  try {
    await handler.execute(interaction, client);
  } catch (error) {
    logger.error(`Modal error [${customId}]:`, error instanceof Error ? error : new Error(String(error)));
    const errEmbed = errorEmbed('Error', 'Something went wrong.');
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
    } else {
      await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
    }
  }
}

export default event;
