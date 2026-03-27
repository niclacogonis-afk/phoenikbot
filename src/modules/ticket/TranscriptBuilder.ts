import { ITicket } from '../../database/models/Ticket';
import { formatDate } from '../../utils/formatters';

export class TranscriptBuilder {
  static buildHtml(ticket: ITicket, guildName: string): string {
    const messages = ticket.messages.map((m) => `
      <div class="message">
        <div class="author">${escapeHtml(m.authorTag)} <span class="time">${formatDate(m.timestamp)}</span></div>
        <div class="content">${escapeHtml(m.content || '[No content]')}</div>
        ${m.attachments.length ? `<div class="attachments">${m.attachments.map((a) => `<a href="${a}" target="_blank">📎 Attachment</a>`).join(' ')}</div>` : ''}
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ticket #${ticket.ticketNumber} Transcript</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #36393f; color: #dcddde; margin: 0; padding: 20px; }
    .header { background: #2f3136; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { color: #fff; margin: 0; }
    .meta { color: #8e9297; font-size: 14px; margin-top: 8px; }
    .message { padding: 10px; border-bottom: 1px solid #40444b; }
    .author { font-weight: bold; color: #fff; margin-bottom: 4px; }
    .time { color: #8e9297; font-size: 12px; font-weight: normal; margin-left: 8px; }
    .content { word-wrap: break-word; }
    .attachments a { color: #00b0f4; margin-right: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎫 Ticket #${ticket.ticketNumber} Transcript</h1>
    <div class="meta">
      Server: ${escapeHtml(guildName)} | Type: ${ticket.type} | Status: ${ticket.status}<br>
      Opened: ${formatDate(ticket.createdAt)} | Closed: ${ticket.closedAt ? formatDate(ticket.closedAt) : 'N/A'}<br>
      Messages: ${ticket.messages.length}
    </div>
  </div>
  <div class="messages">${messages}</div>
</body>
</html>`;
  }

  static buildTxt(ticket: ITicket, guildName: string): string {
    const header = `TICKET #${ticket.ticketNumber} TRANSCRIPT
Server: ${guildName}
Type: ${ticket.type}
Status: ${ticket.status}
Opened: ${formatDate(ticket.createdAt)}
Closed: ${ticket.closedAt ? formatDate(ticket.closedAt) : 'N/A'}
Messages: ${ticket.messages.length}
${'='.repeat(60)}\n\n`;

    const messages = ticket.messages.map((m) =>
      `[${formatDate(m.timestamp)}] ${m.authorTag}\n${m.content || '[No content]'}${m.attachments.length ? `\nAttachments: ${m.attachments.join(', ')}` : ''}\n`
    ).join('\n');

    return header + messages;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
