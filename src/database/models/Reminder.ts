import mongoose, { Document, Schema } from 'mongoose';

export interface IReminder extends Document {
  guildId: string;
  userId: string;
  channelId: string;
  message: string;
  remindAt: Date;
  createdAt: Date;
  completed: boolean;
}

const ReminderSchema = new Schema<IReminder>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  channelId: { type: String, required: true },
  message: { type: String, required: true },
  remindAt: { type: Date, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  completed: { type: Boolean, default: false },
});

export const ReminderModel = mongoose.model<IReminder>('Reminder', ReminderSchema);

// Helper functions
export async function createReminder(
  guildId: string,
  userId: string,
  channelId: string,
  message: string,
  remindAt: Date
): Promise<IReminder> {
  return ReminderModel.create({
    guildId,
    userId,
    channelId,
    message,
    remindAt,
    createdAt: new Date(),
    completed: false,
  });
}

export async function getUserReminders(guildId: string, userId: string): Promise<IReminder[]> {
  return ReminderModel.find({ 
    guildId, 
    userId, 
    completed: false,
    remindAt: { $gt: new Date() }
  }).sort({ remindAt: 1 });
}

export async function getAllPendingReminders(): Promise<IReminder[]> {
  return ReminderModel.find({ 
    completed: false,
    remindAt: { $lte: new Date() }
  });
}

export async function completeReminder(reminderId: string): Promise<void> {
  await ReminderModel.findByIdAndUpdate(reminderId, { completed: true });
}

export async function deleteReminder(reminderId: string): Promise<void> {
  await ReminderModel.findByIdAndDelete(reminderId);
}

export async function deleteUserReminder(guildId: string, userId: string, reminderId: string): Promise<boolean> {
  const result = await ReminderModel.deleteOne({ 
    _id: reminderId, 
    guildId, 
    userId 
  });
  return result.deletedCount > 0;
}
