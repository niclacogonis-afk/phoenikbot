import mongoose, { Document, Schema } from 'mongoose';

export interface IPermission extends Document {
  guildId: string;
  command: string;
  rolesAllowed: string[];
  rolesBlocked: string[];
  usersAllowed: string[];
  usersBlocked: string[];
  createdAt: Date;
  updatedAt: Date;
}

const PermissionSchema = new Schema<IPermission>(
  {
    guildId: { type: String, required: true, index: true },
    command: { type: String, required: true },
    rolesAllowed: { type: [String], default: [] },
    rolesBlocked: { type: [String], default: [] },
    usersAllowed: { type: [String], default: [] },
    usersBlocked: { type: [String], default: [] },
  },
  { timestamps: true }
);

PermissionSchema.index({ guildId: 1, command: 1 }, { unique: true });

export const PermissionModel = mongoose.model<IPermission>('Permission', PermissionSchema);
