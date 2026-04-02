import { GuildMember } from 'discord.js';
import { BotEvent } from '../../types';
import { WelcomeManager } from '../../modules/welcome/WelcomeManager';

const event: BotEvent = {
  name: 'guildMemberRemove',
  async execute(member: GuildMember) {
    // Handle welcome/leave messages and auto-role cleanup
    await WelcomeManager.onMemberLeave(member).catch(() => null);
  },
};

export default event;
