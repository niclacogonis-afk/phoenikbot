import mongoose, { Document, Schema } from 'mongoose';

export interface ITicketTranscript extends Document {
  guildId: string;
  ticketId: string;
  channelId: string;
  userId: string;
  createdAt: Date;
  closedAt: Date;
  transcriptUrl: string | null;
  htmlContent: string;
  messageCount: number;
}

const TicketTranscriptSchema = new Schema<ITicketTranscript>({
  guildId: { type: String, required: true, index: true },
  ticketId: { type: String, required: true, index: true },
  channelId: { type: String, required: true },
  userId: { type: String, required: true },
  createdAt: { type: Date, required: true },
  closedAt: { type: Date, default: Date.now },
  transcriptUrl: { type: String, default: null },
  htmlContent: { type: String, default: '' },
  messageCount: { type: Number, default: 0 },
});

export const TicketTranscriptModel = mongoose.model<ITicketTranscript>('TicketTranscript', TicketTranscriptSchema);

// Helper functions
export async function saveTranscript(
  guildId: string,
  ticketId: string,
  channelId: string,
  userId: string,
  htmlContent: string,
  messageCount: number
): Promise<ITicketTranscript> {
  return TicketTranscriptModel.create({
    guildId,
    ticketId,
    channelId,
    userId,
    createdAt: new Date(),
    closedAt: new Date(),
    transcriptUrl: null,
    htmlContent,
    messageCount,
  });
}

export async function getTranscript(ticketId: string): Promise<ITicketTranscript | null> {
  return TicketTranscriptModel.findOne({ ticketId });
}

export async function getTranscriptByChannel(channelId: string): Promise<ITicketTranscript | null> {
  return TicketTranscriptModel.findOne({ channelId });
}

export async function getGuildTranscripts(guildId: string): Promise<ITicketTranscript[]> {
  return TicketTranscriptModel.find({ guildId }).sort({ closedAt: -1 }).limit(100);
}

export async function deleteTranscript(ticketId: string): Promise<void> {
  await TicketTranscriptModel.deleteOne({ ticketId });
}
