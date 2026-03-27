import mongoose, { Document, Schema } from 'mongoose';

interface ITicketButton {
  label: string;
  emoji: string;
  type: string;
  style: number;
}

export interface ITicketConfig extends Document {
  guildId: string;
  panelChannelId: string | null;
  panelMessageId: string | null;
  logChannelId: string | null;
  staffRoles: string[];
  buttons: ITicketButton[];
  embedTitle: string;
  embedDescription: string;
  embedColor: string;
  embedImage: string | null;
  embedThumbnail: string | null;
  threadNameTemplate: string;
  openMessageTemplate: string;
  autoCloseHours: number;
  maxOpenTickets: number;
  nextTicketNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

const TicketConfigSchema = new Schema<ITicketConfig>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    panelChannelId: { type: String, default: null },
    panelMessageId: { type: String, default: null },
    logChannelId: { type: String, default: null },
    staffRoles: { type: [String], default: [] },
    buttons: {
      type: [
        {
          label: String,
          emoji: String,
          type: String,
          style: Number,
        },
      ],
      default: [
        { label: 'Support', emoji: '🎫', type: 'support', style: 1 },
        { label: 'Report', emoji: '🚨', type: 'report', style: 4 },
        { label: 'Purchase', emoji: '🛒', type: 'purchase', style: 3 },
      ],
    },
    embedTitle: { type: String, default: '🎫 Support Tickets' },
    embedDescription: { type: String, default: 'Click a button below to open a ticket.' },
    embedColor: { type: String, default: '#5865F2' },
    embedImage: { type: String, default: null },
    embedThumbnail: { type: String, default: null },
    threadNameTemplate: { type: String, default: '{type}-{username}' },
    openMessageTemplate: {
      type: String,
      default: 'Hello {user}! A staff member will be with you shortly.\n**Type:** {ticket_type}\n**Date:** {date}',
    },
    autoCloseHours: { type: Number, default: 48 },
    maxOpenTickets: { type: Number, default: 1 },
    nextTicketNumber: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const TicketConfigModel = mongoose.model<ITicketConfig>('TicketConfig', TicketConfigSchema);

export async function getTicketConfig(guildId: string): Promise<ITicketConfig> {
  let config = await TicketConfigModel.findOne({ guildId });
  if (!config) {
    config = await TicketConfigModel.create({ guildId });
  }
  return config;
}
