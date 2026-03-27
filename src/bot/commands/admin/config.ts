import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { Command, ModuleName } from '../../../types';
import { GuildModel, getGuild } from '../../../database/models/Guild';
import { invalidateGuildCache, getCachedGuild } from '../../../modules/cache/CacheManager';
import { successEmbed, errorEmbed, infoEmbed } from '../../../utils/embed';
import { isAdmin } from '../../../modules/permissions/PermissionManager';

const MODULE_NAMES: ModuleName[] = [
  'ticket', 'giveaway', 'verification', 'antirAid', 'antinuke', 'antilink',
  'logging', 'youtube', 'twitch', 'roblox', 'ai', 'suggestions', 'reactionRoles',
  'stats', 'schedule', 'backup', 'minigames', 'moderation',
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure the bot for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup((g) =>
      g.setName('module').setDescription('Enable/disable modules')
        .addSubcommand((s) =>
          s.setName('enable').setDescription('Enable a module')
            .addStringOption((o) =>
              o.setName('module').setDescription('Module to enable').setRequired(true)
                .addChoices(...MODULE_NAMES.map((m) => ({ name: m, value: m })))
            )
        )
        .addSubcommand((s) =>
          s.setName('disable').setDescription('Disable a module')
            .addStringOption((o) =>
              o.setName('module').setDescription('Module to disable').setRequired(true)
                .addChoices(...MODULE_NAMES.map((m) => ({ name: m, value: m })))
            )
        )
        .addSubcommand((s) => s.setName('list').setDescription('List all modules and their status'))
    )
    .addSubcommandGroup((g) =>
      g.setName('set').setDescription('Set configuration values')
        .addSubcommand((s) =>
          s.setName('logchannel').setDescription('Set the log channel')
            .addChannelOption((o) =>
              o.setName('channel').setDescription('Log channel').setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand((s) =>
          s.setName('modlogchannel').setDescription('Set the mod log channel')
            .addChannelOption((o) =>
              o.setName('channel').setDescription('Mod log channel').setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand((s) =>
          s.setName('suggestionschannel').setDescription('Set the suggestions channel')
            .addChannelOption((o) =>
              o.setName('channel').setDescription('Suggestions channel').setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand((s) =>
          s.setName('staffrole').setDescription('Add a staff role')
            .addRoleOption((o) => o.setName('role').setDescription('Staff role').setRequired(true))
        )
        .addSubcommand((s) =>
          s.setName('adminrole').setDescription('Add an admin role')
            .addRoleOption((o) => o.setName('role').setDescription('Admin role').setRequired(true))
        )
    )
    .addSubcommand((s) => s.setName('view').setDescription('View current configuration')),

  category: 'Admin',
  permissions: [PermissionFlagsBits.Administrator],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;
    if (!interaction.member) return;

    const { GuildMember } = await import('discord.js');
    if (!(interaction.member instanceof GuildMember)) return;
    if (!await isAdmin(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You need Administrator permissions.')], ephemeral: true });
      return;
    }

    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();

    if (group === 'module') {
      if (sub === 'list') {
        const guild = await getCachedGuild(interaction.guild.id);
        const lines = MODULE_NAMES.map((m) => `${guild.modules[m] ? '🟢' : '🔴'} \`${m}\``);
        const embed = infoEmbed('Module Status', lines.join('\n'));
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      const moduleName = interaction.options.getString('module', true) as ModuleName;
      const enabled = sub === 'enable';

      await GuildModel.findOneAndUpdate(
        { guildId: interaction.guild.id },
        { [`modules.${moduleName}`]: enabled },
        { upsert: true }
      );
      invalidateGuildCache(interaction.guild.id);

      await interaction.reply({
        embeds: [successEmbed(`Module ${enabled ? 'Enabled' : 'Disabled'}`, `Module \`${moduleName}\` has been ${enabled ? 'enabled' : 'disabled'}.`)],
        ephemeral: true,
      });
      return;
    }

    if (group === 'set') {
      const guild = await getGuild(interaction.guild.id);

      if (sub === 'logchannel') {
        const channel = interaction.options.getChannel('channel', true);
        guild.logChannel = channel.id;
        await guild.save();
        invalidateGuildCache(interaction.guild.id);
        await interaction.reply({ embeds: [successEmbed('Log Channel Set', `Log channel set to ${channel}.`)], ephemeral: true });
      } else if (sub === 'modlogchannel') {
        const channel = interaction.options.getChannel('channel', true);
        guild.modLogChannel = channel.id;
        await guild.save();
        invalidateGuildCache(interaction.guild.id);
        await interaction.reply({ embeds: [successEmbed('Mod Log Channel Set', `Mod log channel set to ${channel}.`)], ephemeral: true });
      } else if (sub === 'suggestionschannel') {
        const channel = interaction.options.getChannel('channel', true);
        guild.suggestionsChannel = channel.id;
        await guild.save();
        await interaction.reply({ embeds: [successEmbed('Suggestions Channel Set', `Suggestions channel set to ${channel}.`)], ephemeral: true });
      } else if (sub === 'staffrole') {
        const role = interaction.options.getRole('role', true);
        if (!guild.staffRoles.includes(role.id)) {
          guild.staffRoles.push(role.id);
          await guild.save();
          invalidateGuildCache(interaction.guild.id);
        }
        await interaction.reply({ embeds: [successEmbed('Staff Role Added', `${role} is now a staff role.`)], ephemeral: true });
      } else if (sub === 'adminrole') {
        const role = interaction.options.getRole('role', true);
        if (!guild.adminRoles.includes(role.id)) {
          guild.adminRoles.push(role.id);
          await guild.save();
          invalidateGuildCache(interaction.guild.id);
        }
        await interaction.reply({ embeds: [successEmbed('Admin Role Added', `${role} is now an admin role.`)], ephemeral: true });
      }
      return;
    }

    if (sub === 'view') {
      const guild = await getGuild(interaction.guild.id);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚙️ Server Configuration')
        .addFields(
          { name: 'Log Channel', value: guild.logChannel ? `<#${guild.logChannel}>` : 'Not set', inline: true },
          { name: 'Mod Log', value: guild.modLogChannel ? `<#${guild.modLogChannel}>` : 'Not set', inline: true },
          { name: 'Suggestions', value: guild.suggestionsChannel ? `<#${guild.suggestionsChannel}>` : 'Not set', inline: true },
          { name: 'Staff Roles', value: guild.staffRoles.length ? guild.staffRoles.map((r) => `<@&${r}>`).join(', ') : 'None', inline: true },
          { name: 'Admin Roles', value: guild.adminRoles.length ? guild.adminRoles.map((r) => `<@&${r}>`).join(', ') : 'None', inline: true },
          { name: 'Enabled Modules', value: MODULE_NAMES.filter((m) => guild.modules[m]).map((m) => `\`${m}\``).join(', ') || 'None' }
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default command;
