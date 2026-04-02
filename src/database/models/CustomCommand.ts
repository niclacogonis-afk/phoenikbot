import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomCommand extends Document {
  guildId: string;
  name: string;
  description: string;
  response: string;
  embed: boolean;
  embedColor: string;
  embedTitle: string;
  embedImage: string | null;
  embedThumbnail: string | null;
  embedFooter: string | null;
  allowedRoles: string[];
  allowedChannels: string[];
  cooldowns: Map<string, number>;
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomCommandSchema = new Schema<ICustomCommand>({
  guildId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  response: { type: String, required: true },
  embed: { type: Boolean, default: false },
  embedColor: { type: String, default: '#7289da' },
  embedTitle: { type: String, default: '' },
  embedImage: { type: String, default: null },
  embedThumbnail: { type: String, default: null },
  embedFooter: { type: String, default: null },
  allowedRoles: { type: [String], default: [] },
  allowedChannels: { type: [String], default: [] },
  cooldowns: { type: Map, of: Number, default: new Map() },
  useCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Compound index for guild + command name
CustomCommandSchema.index({ guildId: 1, name: 1 }, { unique: true });

export const CustomCommandModel = mongoose.model<ICustomCommand>('CustomCommand', CustomCommandSchema);

// Available variables that can be used in commands
export const COMMAND_VARIABLES = {
  '{user}': 'Mention the user',
  '{username}': 'Username without discriminator',
  '{usertag}': 'Full username#0000',
  '{userid}': 'User ID',
  '{server}': 'Server name',
  '{serverid}': 'Server ID',
  '{channel}': 'Current channel mention',
  '{channelname}': 'Current channel name',
  '{channelid}': 'Current channel ID',
  '{membercount}': 'Server member count',
  '{date}': 'Current date (YYYY-MM-DD)',
  '{time}': 'Current time (HH:mm:ss)',
  '{timestamp}': 'Unix timestamp',
  '{random}': 'Random number (1-100)',
  '{randomuser}': 'Random online member',
  '{mention}': 'Mention the user who ran the command',
};

// Helper functions
export async function getCustomCommand(guildId: string, name: string): Promise<ICustomCommand | null> {
  return CustomCommandModel.findOne({ guildId, name: name.toLowerCase() });
}

export async function getAllCustomCommands(guildId: string): Promise<ICustomCommand[]> {
  return CustomCommandModel.find({ guildId }).sort({ name: 1 });
}

export async function createCustomCommand(
  guildId: string,
  name: string,
  response: string,
  options?: Partial<ICustomCommand>
): Promise<ICustomCommand> {
  return CustomCommandModel.create({
    guildId,
    name: name.toLowerCase(),
    response,
    ...options,
  });
}

export async function updateCustomCommand(
  guildId: string,
  name: string,
  updates: Partial<ICustomCommand>
): Promise<ICustomCommand | null> {
  return CustomCommandModel.findOneAndUpdate(
    { guildId, name: name.toLowerCase() },
    { ...updates, updatedAt: new Date() },
    { new: true }
  );
}

export async function deleteCustomCommand(guildId: string, name: string): Promise<void> {
  await CustomCommandModel.deleteOne({ guildId, name: name.toLowerCase() });
}

export async function incrementCommandUse(guildId: string, name: string): Promise<void> {
  await CustomCommandModel.findOneAndUpdate(
    { guildId, name: name.toLowerCase() },
    { $inc: { useCount: 1 } }
  );
}

// Variable replacer function
export function replaceVariables(
  text: string,
  context: {
    user?: { mention: string; username: string; tag: string; id: string };
    guild?: { name: string; id: string; memberCount: number };
    channel?: { mention: string; name: string; id: string };
  }
): string {
  let result = text;
  
  if (context.user) {
    result = result.replace(/\{user\}/gi, context.user.mention);
    result = result.replace(/\{username\}/gi, context.user.username);
    result = result.replace(/\{usertag\}/gi, context.user.tag);
    result = result.replace(/\{userid\}/gi, context.user.id);
    result = result.replace(/\{mention\}/gi, context.user.mention);
  }
  
  if (context.guild) {
    result = result.replace(/\{server\}/gi, context.guild.name);
    result = result.replace(/\{serverid\}/gi, context.guild.id);
    result = result.replace(/\{membercount\}/gi, String(context.guild.memberCount));
  }
  
  if (context.channel) {
    result = result.replace(/\{channel\}/gi, context.channel.mention);
    result = result.replace(/\{channelname\}/gi, context.channel.name);
    result = result.replace(/\{channelid\}/gi, context.channel.id);
  }
  
  // Date/time variables
  const now = new Date();
  result = result.replace(/\{date\}/gi, now.toISOString().split('T')[0]);
  result = result.replace(/\{time\}/gi, now.toTimeString().split(' ')[0]);
  result = result.replace(/\{timestamp\}/gi, String(Math.floor(now.getTime() / 1000)));
  result = result.replace(/\{random\}/gi, String(Math.floor(Math.random() * 100) + 1));
  
  return result.trim();
}
