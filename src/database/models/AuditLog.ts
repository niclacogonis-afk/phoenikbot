import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  guildId: string;
  action: string;
  actorId: string | null;
  targetId: string | null;
  detail: string | null;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    guildId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    actorId: { type: String, default: null },
    targetId: { type: String, default: null },
    detail: { type: String, default: null },
  },
  { timestamps: true }
);

AuditLogSchema.index({ guildId: 1, createdAt: -1 });

export const AuditLogModel = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
