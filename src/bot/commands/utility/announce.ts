import {
  SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, GuildMember,
  EmbedBuilder, ChannelType, TextChannel,
} from 'discord.js';
import { Command } from '../../../types';
import { errorEmbed, successEmbed } from '../../../utils/embed';
import { isAdmin } from '../../../modules/permissions/PermissionManager';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an announcement to a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s.setName('embed').setDescription('Send an embed announcement')
        .addChannelOption((o) => o.setName('channel').setDescription('Target channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('title').setDescription('Announcement title').setRequired(true))
        .addStringOption((o) => o.setName('description').setDescription('Announcement content').setRequired(true))
        .addStringOption((o) => o.setName('color').setDescription('Hex color (default: #5865F2)'))
        .addStringOption((o) => o.setName('ping').setDescription('Role to ping (role ID or @everyone)'))
        .addStringOption((o) => o.setName('image').setDescription('Image URL'))
        .addStringOption((o) => o.setName('footer').setDescription('Footer text'))
    )
    .addSubcommand((s) =>
      s.setName('text').setDescription('Send a plain text announcement')
        .addChannelOption((o) => o.setName('channel').setDescription('Target channel').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption((o) => o.setName('content').setDescription('Announcement content').setRequired(true))
        .addStringOption((o) => o.setName('ping').setDescription('Role to ping (role ID or @everyone)'))
    )
    .addSubcommand((s) =>
      s.setName('dm').setDescription('Send a DM to all members with a specific role')
        .addRoleOption((o) => o.setName('role').setDescription('Role to DM members of').setRequired(true))
        .addStringOption((o) => o.setName('message').setDescription('Message to send').setRequired(true))
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

    if (sub === 'embed') {
      const channelOption = interaction.options.getChannel('channel', true);
      const title = interaction.options.getString('title', true);
      const description = interaction.options.getString('description', true);
      const colorHex = interaction.options.getString('color') ?? '#5865F2';
      const pingStr = interaction.options.getString('ping');
      const image = interaction.options.getString('image');
      const footer = interaction.options.getString('footer');

      const targetChannel = interaction.guild.channels.cache.get(channelOption.id) as TextChannel | undefined;
      if (!targetChannel?.isTextBased()) {
        await interaction.editReply({ embeds: [errorEmbed('Error', 'Invalid channel.')] });
        return;
      }

      const color = (colorHex.startsWith('#') ? colorHex : `#${colorHex}`) as `#${string}`;
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: footer ?? `Announced by ${interaction.user.username}` });

      if (image) embed.setImage(image);

      let content: string | undefined;
      if (pingStr) {
        if (pingStr === '@everyone' || pingStr === 'everyone') {
          content = '@everyone';
        } else {
          const role = interaction.guild.roles.cache.get(pingStr.replace(/[<@&>]/g, ''));
          content = role ? `<@&${role.id}>` : pingStr;
        }
      }

      try {
        await targetChannel.send({ content, embeds: [embed] });
        await interaction.editReply({ embeds: [successEmbed('Announced', `Announcement sent to ${targetChannel}.`)] });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await interaction.editReply({ embeds: [errorEmbed('Send Failed', `Could not send to ${targetChannel}.\n\`${msg}\``)] });
      }
      return;
    }

    if (sub === 'text') {
      const channelOption = interaction.options.getChannel('channel', true);
      const messageContent = interaction.options.getString('content', true);
      const pingStr = interaction.options.getString('ping');

      const targetChannel = interaction.guild.channels.cache.get(channelOption.id) as TextChannel | undefined;
      if (!targetChannel?.isTextBased()) {
        await interaction.editReply({ embeds: [errorEmbed('Error', 'Invalid channel.')] });
        return;
      }

      let content = messageContent;
      if (pingStr) {
        if (pingStr === '@everyone' || pingStr === 'everyone') {
          content = `@everyone\n${messageContent}`;
        } else {
          const role = interaction.guild.roles.cache.get(pingStr.replace(/[<@&>]/g, ''));
          content = role ? `<@&${role.id}>\n${messageContent}` : `${pingStr}\n${messageContent}`;
        }
      }

      try {
        await targetChannel.send({ content });
        await interaction.editReply({ embeds: [successEmbed('Announced', `Announcement sent to ${targetChannel}.`)] });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await interaction.editReply({ embeds: [errorEmbed('Send Failed', `Could not send to ${targetChannel}.\n\`${msg}\``)] });
      }
      return;
    }

    if (sub === 'dm') {
      const role = interaction.options.getRole('role', true);
      const message = interaction.options.getString('message', true);

      const members = await interaction.guild.members.fetch();
      const targets = members.filter((m) => m.roles.cache.has(role.id) && !m.user.bot);

      if (targets.size === 0) {
        await interaction.editReply({ embeds: [errorEmbed('No Members', 'No members found with that role.')] });
        return;
      }

      await interaction.editReply({ embeds: [{ color: 0x5865F2, description: `📨 Sending DMs to **${targets.size}** members...` }] });

      let sent = 0;
      let failed = 0;
      for (const [, member] of targets) {
        try {
          await member.send(`📢 **Announcement from ${interaction.guild.name}:**\n\n${message}`);
          sent++;
        } catch {
          failed++;
        }
      }

      await interaction.followUp({
        embeds: [successEmbed('DMs Sent', `✅ Sent: **${sent}** | ❌ Failed: **${failed}** (DMs disabled)`)],
        ephemeral: true,
      });
    }
  },
};

export default command;
