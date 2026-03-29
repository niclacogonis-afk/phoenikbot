import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember,
  EmbedBuilder, ChannelType,
} from 'discord.js';
import { Command } from '../../../types';
import { errorEmbed, successEmbed, infoEmbed } from '../../../utils/embed';
import { isAdmin } from '../../../modules/permissions/PermissionManager';
import { BackupDataModel } from '../../../database/models/BackupData';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Server backup and restore system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s.setName('create').setDescription('Create a backup of the server structure')
        .addStringOption((o) => o.setName('name').setDescription('Backup name').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('list').setDescription('List all saved backups')
    )
    .addSubcommand((s) =>
      s.setName('info').setDescription('Show backup details')
        .addStringOption((o) => o.setName('id').setDescription('Backup ID').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('delete').setDescription('Delete a backup')
        .addStringOption((o) => o.setName('id').setDescription('Backup ID').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('restore').setDescription('⚠️ Restore channels and roles from a backup (cannot undo!)')
        .addStringOption((o) => o.setName('id').setDescription('Backup ID').setRequired(true))
        .addStringOption((o) =>
          o.setName('mode').setDescription('What to restore')
            .setRequired(true)
            .addChoices(
              { name: 'Roles only', value: 'roles' },
              { name: 'Channels only', value: 'channels' },
              { name: 'Both', value: 'all' },
            )
        )
    ),

  category: 'Admin',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) {
      await interaction.reply({ embeds: [errorEmbed('Error', 'Must be used in a server.')], ephemeral: true });
      return;
    }

    if (!await isAdmin(interaction.member)) {
      await interaction.reply({ embeds: [errorEmbed('Permission Denied', 'You need admin permissions.')], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'create') {
      const name = interaction.options.getString('name', true);

      const count = await BackupDataModel.countDocuments({ guildId: guild.id });
      if (count >= 10) {
        await interaction.editReply({ embeds: [errorEmbed('Limit Reached', 'Maximum 10 backups per server. Delete old ones first.')] });
        return;
      }

      const channels = guild.channels.cache
        .filter((c) => c.type !== ChannelType.GuildCategory || true)
        .map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          position: 'rawPosition' in c ? (c as any).rawPosition : 0,
          parentId: c.parentId,
          topic: 'topic' in c ? (c.topic ?? null) : null,
          nsfw: 'nsfw' in c ? c.nsfw : false,
          rateLimitPerUser: 'rateLimitPerUser' in c ? (c.rateLimitPerUser ?? 0) : 0,
          permissionOverwrites: 'permissionOverwrites' in c
            ? [...c.permissionOverwrites.cache.values()].map((o) => ({
              id: o.id,
              type: o.type,
              allow: o.allow.bitfield.toString(),
              deny: o.deny.bitfield.toString(),
            }))
            : [],
        }));

      const roles = guild.roles.cache
        .filter((r) => r.name !== '@everyone' && !r.managed)
        .map((r) => ({
          id: r.id,
          name: r.name,
          color: r.color,
          hoist: r.hoist,
          mentionable: r.mentionable,
          permissions: r.permissions.bitfield.toString(),
          position: r.rawPosition,
        }));

      const backup = await BackupDataModel.create({
        guildId: guild.id,
        name,
        createdBy: interaction.user.id,
        channels,
        roles,
        guildName: guild.name,
        guildIcon: guild.iconURL(),
      });

      await interaction.editReply({
        embeds: [successEmbed('Backup Created',
          `**Name:** ${name}\n**Channels:** ${channels.length}\n**Roles:** ${roles.length}\n**ID:** \`${backup._id}\`\n\n*Save this ID to restore later.*`
        )],
      });
      return;
    }

    if (sub === 'list') {
      const backups = await BackupDataModel.find({ guildId: guild.id }).sort({ createdAt: -1 });
      if (backups.length === 0) {
        await interaction.editReply({ embeds: [infoEmbed('Backups', 'No backups found. Use `/backup create` to create one.')] });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📦 Server Backups')
        .setDescription(
          backups.map((b, i) => {
            const ts = Math.floor(b.createdAt.getTime() / 1000);
            return `**${i + 1}.** **${b.name}**\n└ ID: \`${b._id}\` — Channels: ${b.channels.length} — Roles: ${b.roles.length} — <t:${ts}:R>`;
          }).join('\n\n')
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'info') {
      const id = interaction.options.getString('id', true);
      const backup = await BackupDataModel.findOne({ guildId: guild.id, _id: id }).catch(() => null);
      if (!backup) {
        await interaction.editReply({ embeds: [errorEmbed('Not Found', 'Backup not found.')] });
        return;
      }

      const ts = Math.floor(backup.createdAt.getTime() / 1000);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📦 Backup: ${backup.name}`)
        .addFields(
          { name: 'Server', value: backup.guildName, inline: true },
          { name: 'Created By', value: `<@${backup.createdBy}>`, inline: true },
          { name: 'Created', value: `<t:${ts}:F>`, inline: true },
          { name: 'Channels', value: String(backup.channels.length), inline: true },
          { name: 'Roles', value: String(backup.roles.length), inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'delete') {
      const id = interaction.options.getString('id', true);
      const result = await BackupDataModel.findOneAndDelete({ guildId: guild.id, _id: id }).catch(() => null);
      if (!result) {
        await interaction.editReply({ embeds: [errorEmbed('Not Found', 'Backup not found.')] });
        return;
      }
      await interaction.editReply({ embeds: [successEmbed('Deleted', `Backup **${result.name}** deleted.`)] });
      return;
    }

    if (sub === 'restore') {
      const id = interaction.options.getString('id', true);
      const mode = interaction.options.getString('mode', true) as 'roles' | 'channels' | 'all';
      const backup = await BackupDataModel.findOne({ guildId: guild.id, _id: id }).catch(() => null);
      if (!backup) {
        await interaction.editReply({ embeds: [errorEmbed('Not Found', 'Backup not found.')] });
        return;
      }

      await interaction.editReply({
        embeds: [{ color: 0xFEE75C, description: `⚠️ Restoring **${backup.name}** (mode: ${mode})... This may take a moment.` }],
      });

      let rolesRestored = 0;
      let channelsRestored = 0;

      if (mode === 'roles' || mode === 'all') {
        for (const roleData of backup.roles.sort((a, b) => a.position - b.position)) {
          try {
            const existing = guild.roles.cache.find((r) => r.name === roleData.name);
            if (!existing) {
              await guild.roles.create({
                name: roleData.name,
                color: roleData.color,
                hoist: roleData.hoist,
                mentionable: roleData.mentionable,
                reason: `Backup restore: ${backup.name}`,
              });
              rolesRestored++;
            }
          } catch { }
        }
      }

      if (mode === 'channels' || mode === 'all') {
        for (const chanData of backup.channels.sort((a, b) => a.position - b.position)) {
          try {
            const existing = guild.channels.cache.find((c) => c.name === chanData.name);
            if (!existing) {
              if (chanData.type === ChannelType.GuildCategory) {
                await guild.channels.create({
                  name: chanData.name,
                  type: ChannelType.GuildCategory,
                  reason: `Backup restore: ${backup.name}`,
                });
              } else if (chanData.type === ChannelType.GuildText) {
                await guild.channels.create({
                  name: chanData.name,
                  type: ChannelType.GuildText,
                  topic: chanData.topic ?? undefined,
                  nsfw: chanData.nsfw,
                  rateLimitPerUser: chanData.rateLimitPerUser,
                  reason: `Backup restore: ${backup.name}`,
                });
              }
              channelsRestored++;
            }
          } catch { }
        }
      }

      await interaction.followUp({
        embeds: [successEmbed('Restore Complete',
          `**Backup:** ${backup.name}\n**Roles restored:** ${rolesRestored}\n**Channels restored:** ${channelsRestored}\n\n*Note: Existing channels/roles were skipped.*`
        )],
        ephemeral: true,
      });
    }
  },
};

export default command;
