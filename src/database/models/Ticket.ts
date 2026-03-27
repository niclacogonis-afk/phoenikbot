import mongoose, { Document, Schema } from 'mongoose';

interface ITicketMessage {
  authorId: string;
  authorTag: string;
  content: string;
  attachments: string[];
  timestamp: Date;
}

export interface ITicket extends Document {
  guildId: string;
  channelId: string;
  threadId: string | null;
  userId: string;
  ticketNumber: number;
  type: string;
  status: 'open' | 'closed' | 'deleted';
  claimedBy: string | null;
  priority: 'low' | 'medium' | 'high';
  messages: ITicketMessage[];
  transcriptHtml: string | null;
  transcriptTxt: string | null;
  feedback: { rating: number; comment: string } | null;
  autoCloseWarned: boolean;
  lastActivityAt: Date;
  closedAt: Date | null;
  closedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new Schema<ITicket>(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    threadId: { type: String, default: null },
    userId: { type: String, required: true, index: true },
    ticketNumber: { type: Number, required: true },
    type: { type: String, required: true, default: 'support' },
    status: { type: String, enum: ['open', 'closed', 'deleted'], default: 'open' },
    claimedBy: { type: String, default: null },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    messages: [
      {
        authorId: String,
        authorTag: String,
        content: String,
        attachments: [String],
        timestamp: { type: Date, default: Date.now },
      },
    ],
    transcriptHtml: { type: String, default: null },
    transcriptTxt: { type: String, default: null },
    feedback: {
      type: new Schema({ rating: Number, comment: String }),
      default: null,
    },
    autoCloseWarned: { type: Boolean, default: false },
    lastActivityAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
    closedBy: { type: String, default: null },
  },
  { timestamps: true }
);

export const TicketModel = mongoose.model<ITicket>('Ticket', TicketSchema);
