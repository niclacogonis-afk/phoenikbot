import mongoose, { Document, Schema } from 'mongoose';

interface IBackupChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parentId: string | null;
  topic: string | null;
  nsfw: boolean;
  rateLimitPerUser: number;
  permissionOverwrites: Array<{
    id: string;
    type: number;
    allow: string;
    deny: string;
  }>;
}

interface IBackupRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  permissions: string;
  position: number;
}

export interface IBackupData extends Document {
  guildId: string;
  name: string;
  createdBy: string;
  channels: IBackupChannel[];
  roles: IBackupRole[];
  guildName: string;
  guildIcon: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const BackupDataSchema = new Schema<IBackupData>(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    createdBy: { type: String, required: true },
    channels: { type: Schema.Types.Mixed, default: [] },
    roles: { type: Schema.Types.Mixed, default: [] },
    guildName: { type: String, required: true },
    guildIcon: { type: String, default: null },
  },
  { timestamps: true }
);

export const BackupDataModel = mongoose.model<IBackupData>('BackupData', BackupDataSchema);
