import { TextChannel, Guild, User, Message, Collection, GuildMember } from 'discord.js';
import { saveTranscript } from '../../database/models/TicketTranscript';

export class TranscriptManager {
  /**
   * Generate an HTML transcript of a ticket channel
   */
  static async generateTranscript(
    channel: TextChannel,
    ticketId: string,
    user: User
  ): Promise<string> {
    // Fetch all messages
    const messages = await channel.messages.fetch({ limit: 1000 });
    const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    
    // Generate HTML
    const html = this.generateHTML(channel.guild, channel, sortedMessages, user);
    
    // Save to database
    await saveTranscript(
      channel.guildId,
      ticketId,
      channel.id,
      user.id,
      html,
      sortedMessages.size
    );
    
    return html;
  }
  
  /**
   * Generate HTML content for the transcript
   */
  private static generateHTML(
    guild: Guild,
    channel: TextChannel,
    messages: Collection<string, Message>,
    ticketCreator: User
  ): string {
    const messageList = messages.map(msg => this.formatMessage(msg)).join('\n');
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transcript - ${channel.name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #fff;
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: #2d2d44;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        }
        .header {
            background: linear-gradient(135deg, #7289da 0%, #5b6eae 100%);
            padding: 25px;
            text-align: center;
        }
        .header h1 {
            font-size: 24px;
            margin-bottom: 10px;
        }
        .header .info {
            opacity: 0.9;
            font-size: 14px;
        }
        .messages {
            padding: 20px;
        }
        .message {
            padding: 12px 16px;
            margin-bottom: 8px;
            border-radius: 8px;
            background: #363652;
            animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .message .author {
            font-weight: 600;
            color: #7289da;
            margin-right: 8px;
        }
        .message .author.bot {
            color: #43b581;
        }
        .message .author.system {
            color: #faa61a;
        }
        .message .timestamp {
            color: #72767d;
            font-size: 12px;
            margin-left: 8px;
        }
        .message .content {
            margin-top: 6px;
            line-height: 1.5;
            word-wrap: break-word;
        }
        .message .content code {
            background: #1a1a2e;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Consolas', monospace;
        }
        .message .content pre {
            background: #1a1a2e;
            padding: 12px;
            border-radius: 6px;
            overflow-x: auto;
            margin-top: 8px;
        }
        .message .attachments img {
            max-width: 100%;
            border-radius: 6px;
            margin-top: 8px;
        }
        .message .attachments a {
            color: #7289da;
            text-decoration: none;
        }
        .message .attachments a:hover {
            text-decoration: underline;
        }
        .embed {
            background: #2f3136;
            border-left: 4px solid #7289da;
            padding: 12px;
            margin-top: 8px;
            border-radius: 4px;
        }
        .embed .title {
            color: #7289da;
            font-weight: 600;
        }
        .embed .description {
            margin-top: 6px;
            opacity: 0.9;
        }
        .embed .field {
            margin-top: 8px;
        }
        .embed .field-name {
            font-weight: 600;
            color: #7289da;
        }
        .system-message {
            background: transparent;
            border: 1px dashed #faa61a;
            color: #faa61a;
            text-align: center;
            font-style: italic;
        }
        .footer {
            background: #1a1a2e;
            padding: 15px;
            text-align: center;
            color: #72767d;
            font-size: 12px;
        }
        .ticket-id {
            background: #7289da;
            padding: 4px 12px;
            border-radius: 20px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎫 Ticket Transcript</h1>
            <div class="info">
                <div><strong>Channel:</strong> #${channel.name}</div>
                <div><strong>Server:</strong> ${guild.name}</div>
                <div><strong>Created by:</strong> ${ticketCreator.tag}</div>
                <div><strong>Messages:</strong> ${messages.size}</div>
                <div><strong>Ticket ID:</strong> <span class="ticket-id">${channel.id}</span></div>
            </div>
        </div>
        <div class="messages">
            ${messageList}
        </div>
        <div class="footer">
            Generated by <strong>PhoenikBot</strong> • ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>`;
  }
  
  /**
   * Format a single message to HTML
   */
  private static formatMessage(message: Message): string {
    const author = message.author;
    const isBot = author.bot;
    const isSystem = message.system || false;
    const authorClass = isBot ? 'bot' : isSystem ? 'system' : '';
    
    const timestamp = new Date(message.createdTimestamp).toLocaleString();
    const avatarUrl = author.displayAvatarURL({ size: 32 });
    
    // Format content
    let content = this.escapeHtml(message.content);
    content = content.replace(/\n/g, '<br>');
    
    // Format code blocks
    content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
    content = content.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Format mentions
    content = content.replace(/<@!?(\d+)>/g, '<span style="color:#7289da;">@User</span>');
    content = content.replace(/<#(\d+)>/g, '<span style="color:#7289da;">#channel</span>');
    content = content.replace(/<@&(\d+)>/g, '<span style="color:#43b581;">@Role</span>');
    
    // Format embeds
    let embedsHtml = '';
    for (const embed of message.embeds) {
      embedsHtml += `
        <div class="embed">
          ${embed.title ? `<div class="title">${this.escapeHtml(embed.title)}</div>` : ''}
          ${embed.description ? `<div class="description">${this.escapeHtml(embed.description)}</div>` : ''}
          ${embed.fields?.map(field => `
            <div class="field">
              <span class="field-name">${this.escapeHtml(field.name)}</span>
              <div>${this.escapeHtml(field.value)}</div>
            </div>
          `).join('') || ''}
        </div>
      `;
    }
    
    // Format attachments
    let attachmentsHtml = '';
    if (message.attachments.size > 0) {
      attachmentsHtml = '<div class="attachments">';
      for (const attachment of message.attachments.values()) {
        if (attachment.contentType?.startsWith('image/')) {
          attachmentsHtml += `<img src="${attachment.url}" alt="${attachment.name}">`;
        } else {
          attachmentsHtml += `<a href="${attachment.url}" target="_blank">📎 ${attachment.name}</a>`;
        }
      }
      attachmentsHtml += '</div>';
    }
    
    // System messages
    if (message.system) {
      return `
        <div class="message system-message">
          ${content}
          <div class="timestamp">${timestamp}</div>
        </div>
      `;
    }
    
    return `
      <div class="message">
        <img src="${avatarUrl}" alt="" style="width:32px;height:32px;border-radius:50%;vertical-align:middle;margin-right:8px;">
        <span class="author ${authorClass}">${this.escapeHtml(author.username)}</span>
        <span class="timestamp">${timestamp}</span>
        <div class="content">${content || '<em style="color:#72767d;">No content</em>'}</div>
        ${embedsHtml}
        ${attachmentsHtml}
      </div>
    `;
  }
  
  /**
   * Escape HTML special characters
   */
  private static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&',
      '<': '<',
      '>': '>',
      '"': '"',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
