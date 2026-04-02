import { Message, GuildMember, TextChannel, EmbedBuilder } from 'discord.js';
import { 
  getCustomCommand, 
  incrementCommandUse,
  replaceVariables,
  ICustomCommand 
} from '../../database/models/CustomCommand';

export class CustomCommandManager {
  private static cooldowns: Map<string, number> = new Map();
  
  /**
   * Handle a message and check for custom commands
   */
  static async handleMessage(message: Message): Promise<boolean> {
    if (message.author.bot || !message.guild) return false;
    
    // Get guild config for prefix (we'll check if message starts with prefix)
    // For now, just check if it's a direct command match
    
    const content = message.content.toLowerCase().trim();
    const args = content.split(/\s+/);
    const commandName = args[0].replace(/^[\/!.]/, ''); // Remove common prefixes
    
    if (!commandName) return false;
    
    const command = await getCustomCommand(message.guildId!, commandName);
    if (!command) return false;
    
    // Check channel permissions
    if (command.allowedChannels.length > 0) {
      if (!command.allowedChannels.includes(message.channelId)) {
        return false; // Silently ignore - not a command for this channel
      }
    }
    
    // Check role permissions
    if (command.allowedRoles.length > 0) {
      const hasRole = command.allowedRoles.some(roleId => 
        (message.member as GuildMember)?.roles.cache.has(roleId)
      );
      if (!hasRole) {
        await message.reply('❌ You do not have permission to use this command.');
        return true;
      }
    }
    
    // Check cooldown
    const cooldownKey = `${message.guildId}-${commandName}-${message.author.id}`;
    const lastUsed = this.cooldowns.get(cooldownKey);
    if (lastUsed) {
      const cooldownMs = 3000; // 3 second default cooldown
      if (Date.now() - lastUsed < cooldownMs) {
        await message.reply('⏳ Please wait before using this command again.');
        return true;
      }
    }
    
    // Set cooldown
    this.cooldowns.set(cooldownKey, Date.now());
    setTimeout(() => this.cooldowns.delete(cooldownKey), 3000);
    
    // Replace variables
    const context = {
      user: {
        mention: message.author.toString(),
        username: message.author.username,
        tag: message.author.tag,
        id: message.author.id,
      },
      guild: {
        name: message.guild.name,
        id: message.guild.id,
        memberCount: message.guild.memberCount,
      },
      channel: {
        mention: message.channel.toString(),
        name: message.channel.isTextBased() && !message.channel.isDMBased() 
          ? (message.channel as TextChannel).name 
          : 'DM',
        id: message.channelId,
      },
    };
    
    const response = replaceVariables(command.response, context);
    
    // Send response
    if (command.embed) {
      const embed = new EmbedBuilder()
        .setDescription(response)
        .setColor(command.embedColor as any || '#7289da');
      
      if (command.embedTitle) {
        embed.setTitle(replaceVariables(command.embedTitle, context));
      }
      if (command.embedFooter) {
        embed.setFooter({ text: replaceVariables(command.embedFooter, context) });
      }
      if (command.embedImage) {
        embed.setImage(replaceVariables(command.embedImage, context));
      }
      if (command.embedThumbnail) {
        embed.setThumbnail(replaceVariables(command.embedThumbnail, context));
      }
      
      await message.reply({ embeds: [embed] });
    } else {
      await message.reply(response);
    }
    
    // Increment usage counter
    await incrementCommandUse(message.guildId!, commandName);
    
    return true;
  }
}
