import { TextChannel, Message, Guild, Channel, EmbedBuilder } from 'discord.js';
import { getStickyMessage, updateStickyMessageId } from '../../database/models/StickyMessage';

export class StickyMessageManager {
  private static readonly PROCESSED_MESSAGES = new Set<string>();
  
  /**
   * Handle a new message in a channel - check if it's a sticky message
   */
  static async handleMessage(message: Message): Promise<void> {
    // Ignore bots and webhooks
    if (message.author.bot || message.webhookId) return;
    
    const guild = message.guild;
    if (!guild) return;
    
    const channel = message.channel;
    if (!channel.isTextBased() || channel.isDMBased()) return;
    
    // Check if this is the sticky message we posted
    const sticky = await getStickyMessage(guild.id, channel.id);
    if (!sticky) return;
    
    // If this is our own sticky message being replied to, ignore it
    if (message.author.id === message.client.user?.id) return;
    
    // Add message to processed set to prevent duplicate processing
    const messageKey = `${message.channel.id}-${message.id}`;
    if (this.PROCESSED_MESSAGES.has(messageKey)) return;
    this.PROCESSED_MESSAGES.add(messageKey);
    
    // Clean up old entries
    if (this.PROCESSED_MESSAGES.size > 1000) {
      const entries = Array.from(this.PROCESSED_MESSAGES);
      entries.slice(0, 500).forEach(key => this.PROCESSED_MESSAGES.delete(key));
    }
    
    try {
      // Try to fetch the old sticky message
      if (sticky.lastMessageId) {
        try {
          const oldMessage = await channel.messages.fetch(sticky.lastMessageId);
          // Only delete if it's the bot's message
          if (oldMessage.author.id === message.client.user?.id) {
            await oldMessage.delete();
          }
        } catch {
          // Message not found, that's fine
        }
      }
      
      // Post the new sticky message
      const stickyMessage = await channel.send({
        content: sticky.message,
        allowedMentions: { parse: ['everyone', 'roles', 'users'] }
      });
      
      // Update the stored message ID
      await updateStickyMessageId(guild.id, channel.id, stickyMessage.id);
    } catch (error) {
      console.error(`Error handling sticky message in ${channel.id}:`, error);
    }
  }
  
  /**
   * Initialize all sticky messages for a guild
   */
  static async initializeGuild(guild: Guild): Promise<void> {
    const { getAllStickyMessages } = await import('../../database/models/StickyMessage');
    const stickies = await getAllStickyMessages(guild.id);
    
    for (const sticky of stickies) {
      const channel = guild.channels.cache.get(sticky.channelId);
      if (!channel || !channel.isTextBased()) continue;
      
      try {
        // Delete old sticky message if exists
        if (sticky.lastMessageId) {
          try {
            const oldMsg = await (channel as TextChannel).messages.fetch(sticky.lastMessageId);
            if (oldMsg.author.id === guild.client.user?.id) {
              await oldMsg.delete();
            }
          } catch {
            // Message not found
          }
        }
        
        // Post new sticky message
        const newMsg = await (channel as TextChannel).send({
          content: sticky.message,
          allowedMentions: { parse: ['everyone', 'roles', 'users'] }
        });
        
        await updateStickyMessageId(guild.id, sticky.channelId, newMsg.id);
      } catch (error) {
        console.error(`Error initializing sticky message in ${sticky.channelId}:`, error);
      }
    }
  }
  
  /**
   * Remove the sticky message from a channel
   */
  static async removeSticky(channel: TextChannel): Promise<void> {
    const sticky = await getStickyMessage(channel.guildId, channel.id);
    if (!sticky) return;
    
    if (sticky.lastMessageId) {
      try {
        const msg = await channel.messages.fetch(sticky.lastMessageId);
        if (msg.author.id === channel.client.user?.id) {
          await msg.delete();
        }
      } catch {
        // Message not found
      }
    }
  }
}
