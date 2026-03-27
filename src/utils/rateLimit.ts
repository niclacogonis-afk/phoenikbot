const cooldowns = new Map<string, Map<string, number>>();

export function checkCooldown(commandName: string, userId: string, cooldownMs: number): number {
  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Map());
  }
  const timestamps = cooldowns.get(commandName)!;
  const now = Date.now();
  const expiration = (timestamps.get(userId) ?? 0) + cooldownMs;

  if (now < expiration) {
    return expiration - now;
  }

  timestamps.set(userId, now);
  setTimeout(() => timestamps.delete(userId), cooldownMs);
  return 0;
}

export function clearCooldown(commandName: string, userId: string): void {
  cooldowns.get(commandName)?.delete(userId);
}
