import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
} from 'discord.js';
import { Command, ButtonHandler, SelectMenuHandler, ModalHandler } from '../types';

export class BotClient extends Client {
  commands: Collection<string, Command> = new Collection();
  buttons: Collection<string, ButtonHandler> = new Collection();
  selectMenus: Collection<string, SelectMenuHandler> = new Collection();
  modals: Collection<string, ModalHandler> = new Collection();
  cooldowns: Collection<string, Collection<string, number>> = new Collection();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildInvites,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember,
      ],
    });
  }
}
