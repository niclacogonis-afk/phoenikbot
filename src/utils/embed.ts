import { EmbedBuilder, ColorResolvable } from 'discord.js';

export const Colors = {
  Primary: 0x5865F2,
  Success: 0x57F287,
  Warning: 0xFEE75C,
  Error: 0xED4245,
  Info: 0x5865F2,
  Ticket: 0x5865F2,
  Giveaway: 0xFF73FA,
  Moderation: 0xED4245,
  Log: 0x99AAB5,
} as const;

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Colors.Success).setTitle(`✅ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Colors.Error).setTitle(`❌ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Colors.Primary).setTitle(`ℹ️ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function warningEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Colors.Warning).setTitle(`⚠️ ${title}`);
  if (description) embed.setDescription(description);
  return embed;
}

export function logEmbed(title: string, color: ColorResolvable = Colors.Log): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setTimestamp();
}

export function customEmbed(options: {
  title?: string;
  description?: string;
  color?: ColorResolvable;
  image?: string;
  thumbnail?: string;
  footer?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: boolean;
}): EmbedBuilder {
  const embed = new EmbedBuilder();
  if (options.color) embed.setColor(options.color);
  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.image) embed.setImage(options.image);
  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.footer) embed.setFooter({ text: options.footer });
  if (options.fields) embed.addFields(options.fields);
  if (options.timestamp) embed.setTimestamp();
  return embed;
}
