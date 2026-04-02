import { SlashCommandBuilder, EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { 
  getAllCustomCommands, 
  createCustomCommand, 
  deleteCustomCommand,
  COMMAND_VARIABLES 
} from '../../../database/models/CustomCommand';
import { PermissionManager } from '../../../modules/permissions/PermissionManager';

export const data = new SlashCommandBuilder()
  .setName('customcommand')
  .setNameLocalizations({
    'en-US': 'customcommand',
    'it': 'customcommand'
  })
  .setDescription('Manage custom commands')
  .addSubcommand(subcommand =>
    subcommand.setName('create')
      .setDescription('Create a new custom command')
      .addStringOption(option =>
        option.setName('name')
          .setDescription('Command name (without prefix)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option.setName('response')
          .setDescription('The response message')
          .setRequired(true)
      )
      .addBooleanOption(option =>
        option.setName('embed')
          .setDescription('Send response as embed')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('delete')
      .setDescription('Delete a custom command')
      .addStringOption(option =>
        option.setName('name')
          .setDescription('Command name to delete')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand.setName('list')
      .setDescription('List all custom commands')
  )
  .addSubcommand(subcommand =>
    subcommand.setName('variables')
      .setDescription('Show available variables for custom commands')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  
  // Check permissions
  const member = interaction.member;
  if (!member || !interaction.guild) {
    return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
  }
  
  const isStaff = await PermissionManager.isStaff(member as any);
  if (!isStaff) {
    return interaction.reply({ content: '❌ You need Staff permissions to use this command.', ephemeral: true });
  }
  
  if (subcommand === 'create') {
    await createCommand(interaction);
  } else if (subcommand === 'delete') {
    await deleteCommand(interaction);
  } else if (subcommand === 'list') {
    await listCommands(interaction);
  } else if (subcommand === 'variables') {
    await showVariables(interaction);
  }
}

async function createCommand(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name', true).toLowerCase();
  const response = interaction.options.getString('response', true);
  const embed = interaction.options.getBoolean('embed') ?? false;
  
  // Reserved names
  const reserved = ['help', 'ping', 'stats', 'invite', 'rank', 'leaderboard', 'balance', 'daily', 'gamble', 'shop'];
  if (reserved.includes(name)) {
    return interaction.reply({ 
      content: `❌ "${name}" is a reserved command name.`,
      ephemeral: true 
    });
  }
  
  // Check for duplicates
  const existing = await getAllCustomCommands(interaction.guildId!);
  if (existing.some(cmd => cmd.name === name)) {
    return interaction.reply({ 
      content: `❌ A command named "${name}" already exists.`,
      ephemeral: true 
    });
  }
  
  // Create the command
  await createCustomCommand(interaction.guildId!, name, response, {
    description: '',
    embed,
    embedColor: '#7289da',
  });
  
  const embed_response = new EmbedBuilder()
    .setColor('#55ff55')
    .setTitle('✅ Custom Command Created')
    .setDescription(`Command \`${name}\` has been created!`)
    .addFields(
      { name: '📝 Response', value: response.length > 1024 ? response.slice(0, 1021) + '...' : response, inline: false },
      { name: '📦 Embed', value: embed ? 'Yes' : 'No', inline: true }
    )
    .setFooter({ text: 'Use /customcommand variables to see available placeholders' });
  
  await interaction.reply({ embeds: [embed_response], ephemeral: true });
}

async function deleteCommand(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString('name', true).toLowerCase();
  
  const commands = await getAllCustomCommands(interaction.guildId!);
  if (!commands.some(cmd => cmd.name === name)) {
    return interaction.reply({ 
      content: `❌ Command "${name}" not found.`,
      ephemeral: true 
    });
  }
  
  await deleteCustomCommand(interaction.guildId!, name);
  
  const embed = new EmbedBuilder()
    .setColor('#55ff55')
    .setTitle('✅ Command Deleted')
    .setDescription(`Command \`${name}\` has been deleted.`);
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function listCommands(interaction: ChatInputCommandInteraction) {
  const commands = await getAllCustomCommands(interaction.guildId!);
  
  if (commands.length === 0) {
    return interaction.reply({ 
      content: '📋 No custom commands in this server.\nUse `/customcommand create` to create one!',
      ephemeral: true 
    });
  }
  
  const embed = new EmbedBuilder()
    .setColor('#7289da')
    .setTitle('📋 Custom Commands')
    .setDescription(`**${commands.length}** custom command${commands.length > 1 ? 's' : ''} in this server`);
  
  for (const cmd of commands.slice(0, 10)) {
    embed.addFields({
      name: `/${cmd.name}`,
      value: cmd.response.length > 100 ? cmd.response.slice(0, 97) + '...' : cmd.response,
      inline: false
    });
  }
  
  if (commands.length > 10) {
    embed.setFooter({ text: `And ${commands.length - 10} more...` });
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showVariables(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor('#7289da')
    .setTitle('📝 Available Variables')
    .setDescription('Use these variables in your custom command responses:')
    .addFields(
      { name: '👤 User Variables', value: 
        '`{user}` - Mention user\n' +
        '`{username}` - Username\n' +
        '`{usertag}` - Full tag\n' +
        '`{userid}` - User ID\n' +
        '`{mention}` - Mention user', inline: true
      },
      { name: '🏠 Server Variables', value: 
        '`{server}` - Server name\n' +
        '`{serverid}` - Server ID\n' +
        '`{membercount}` - Member count', inline: true
      },
      { name: '💬 Channel Variables', value: 
        '`{channel}` - Channel mention\n' +
        '`{channelname}` - Channel name\n' +
        '`{channelid}` - Channel ID', inline: true
      },
      { name: '📅 Time Variables', value: 
        '`{date}` - Current date\n' +
        '`{time}` - Current time\n' +
        '`{timestamp}` - Unix timestamp', inline: true
      },
      { name: '🎲 Other Variables', value: 
        '`{random}` - Random number (1-100)', inline: true
      }
    );
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
