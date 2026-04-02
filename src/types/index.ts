import {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  ContextMenuCommandBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  PermissionResolvable,
  Collection,
} from 'discord.js';
import { BotClient } from '../bot/client';

export interface Command {
  data: SlashCommandBuilder | ContextMenuCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  category?: string;
  cooldown?: number;
  ownerOnly?: boolean;
  permissions?: PermissionResolvable[];
  execute: (interaction: ChatInputCommandInteraction, client: BotClient) => Promise<void>;
}

export interface ButtonHandler {
  customId: string;
  execute: (interaction: ButtonInteraction, client: BotClient) => Promise<void>;
}

export interface SelectMenuHandler {
  customId: string;
  execute: (interaction: StringSelectMenuInteraction, client: BotClient) => Promise<void>;
}

export interface ModalHandler {
  customId: string;
  execute: (interaction: ModalSubmitInteraction, client: BotClient) => Promise<void>;
}

export interface BotEvent {
  name: string;
  once?: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}

export type ModuleName =
  | 'ticket'
  | 'giveaway'
  | 'verification'
  | 'antirAid'
  | 'antinuke'
  | 'antilink'
  | 'logging'
  | 'youtube'
  | 'twitch'
  | 'roblox'
  | 'ai'
  | 'suggestions'
  | 'reactionRoles'
  | 'stats'
  | 'schedule'
  | 'backup'
  | 'minigames'
  | 'moderation'
  | 'automation';

export interface GuildModules {
  ticket: boolean;
  giveaway: boolean;
  verification: boolean;
  antirAid: boolean;
  antinuke: boolean;
  antilink: boolean;
  logging: boolean;
  youtube: boolean;
  twitch: boolean;
  roblox: boolean;
  ai: boolean;
  suggestions: boolean;
  reactionRoles: boolean;
  stats: boolean;
  schedule: boolean;
  backup: boolean;
  minigames: boolean;
  moderation: boolean;
  automation: boolean;
}

export interface CachedGuild {
  modules: GuildModules;
  logChannel: string | null;
  modLogChannel: string | null;
  staffRoles: string[];
  adminRoles: string[];
  cachedAt: number;
}

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
    buttons: Collection<string, ButtonHandler>;
    selectMenus: Collection<string, SelectMenuHandler>;
    modals: Collection<string, ModalHandler>;
    cooldowns: Collection<string, Collection<string, number>>;
  }
}
