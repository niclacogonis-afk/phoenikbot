import { ButtonInteraction, GuildMember } from 'discord.js';
import { ButtonHandler } from '../../types';
import { BotClient } from '../client';
import { ReactionRoleModel } from '../../database/models/ReactionRole';
import { successEmbed, errorEmbed } from '../../utils/embed';

const handler: ButtonHandler = {
  customId: 'rr',

  async execute(interaction: ButtonInteraction, client: BotClient) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    const parts = interaction.customId.split(':');
    const panelId = parts[1]!;
    const roleId = parts[2]!;

    const panel = await ReactionRoleModel.findById(panelId);
    if (!panel) return;

    const member = interaction.member;
    const hasRole = member.roles.cache.has(roleId);

    if (panel.mode === 'exclusive') {
      const panelRoleIds = panel.buttons.map((b) => b.roleId);
      for (const rid of panelRoleIds) {
        if (member.roles.cache.has(rid) && rid !== roleId) {
          await member.roles.remove(rid).catch(() => null);
        }
      }
    }

    if (panel.maxRoles !== null && !hasRole) {
      const currentPanelRoles = panel.buttons.map((b) => b.roleId).filter((r) => member.roles.cache.has(r));
      if (currentPanelRoles.length >= panel.maxRoles) {
        await interaction.reply({
          embeds: [errorEmbed('Role Limit', `You can only have ${panel.maxRoles} role(s) from this panel.`)],
          ephemeral: true,
        });
        return;
      }
    }

    if (hasRole) {
      await member.roles.remove(roleId).catch(() => null);
      await interaction.reply({ embeds: [successEmbed('Role Removed', `Removed <@&${roleId}>.`)], ephemeral: true });
    } else {
      await member.roles.add(roleId).catch(() => null);
      await interaction.reply({ embeds: [successEmbed('Role Added', `Added <@&${roleId}>.`)], ephemeral: true });
    }
  },
};

export default handler;
