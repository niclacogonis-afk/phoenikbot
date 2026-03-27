import mongoose, { Document, Schema } from 'mongoose';

interface IReactionRoleButton {
  label: string;
  emoji: string;
  roleId: string;
  style: number;
}

export interface IReactionRole extends Document {
  guildId: string;
  channelId: string;
  messageId: string | null;
  title: string;
  description: string | null;
  color: string;
  buttons: IReactionRoleButton[];
  mode: 'multi' | 'exclusive';
  maxRoles: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const ReactionRoleSchema = new Schema<IReactionRole>(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, default: null },
    title: { type: String, required: true },
    description: { type: String, default: null },
    color: { type: String, default: '#5865F2' },
    buttons: [
      {
        label: String,
        emoji: String,
        roleId: String,
        style: Number,
      },
    ],
    mode: { type: String, enum: ['multi', 'exclusive'], default: 'multi' },
    maxRoles: { type: Number, default: null },
  },
  { timestamps: true }
);

export const ReactionRoleModel = mongoose.model<IReactionRole>('ReactionRole', ReactionRoleSchema);
