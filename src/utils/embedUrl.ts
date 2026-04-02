/**
 * Normalizes pasted Discord URLs: `<https://cdn.discordapp.com/...>`, 
 * markdown `[img](url)`, whitespace. Accepts Discord CDN URLs.
 * 
 * Supported domains:
 * - cdn.discordapp.com (Discord CDN - attachments, images, GIFs)
 * - media.discordapp.net (Discord Media CDN)
 * - images.unsplash.com (Unsplash images)
 * - i.imgur.com,imgur.com (Imgur images)
 * - i.postimg.cc, postimg.cc (Postimg images)
 * 
 * For Discord attachments: paste the FULL attachment URL from Discord,
 * NOT the message link. Example:
 * ✅ https://cdn.discordapp.com/attachments/123/456/image.png
 * ❌ https://discord.com/channels/.../message-id
 */
export function normalizeMediaUrlInput(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  let t = raw.trim();
  if (!t) return null;

  // Remove Discord-style angle brackets: <https://...>
  if (t.startsWith('<') && t.endsWith('>')) {
    t = t.slice(1, -1).trim();
  }

  // Remove markdown links: [text](url)
  const md = /^\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/i.exec(t);
  if (md) t = md[2]!;

  // Remove trailing whitespace
  t = t.replace(/\s+$/g, '');

  // Reject Discord message/channel links - they are not image URLs!
  if (t.includes('discord.com/channels/') || 
      t.includes('discord.com/messages/') ||
      t.includes('discordapp.com/channels/')) {
    return null;
  }

  return t || null;
}

/**
 * Validates that a URL is suitable for Discord embeds.
 * Discord embed image/thumbnail URLs must be valid http(s) URLs.
 * Empty or invalid strings cause EmbedBuilder validation errors.
 * 
 * @param url - The URL to validate (can be null, undefined, or raw input)
 * @returns The validated URL string, or null if invalid
 */
export function safeEmbedMediaUrl(url: string | null | undefined): string | null {
  const n = normalizeMediaUrlInput(url);
  if (!n) return null;

  try {
    const u = new URL(n);
    
    // Must be http or https
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

    // Check for supported image hosting domains
    const allowedDomains = [
      'cdn.discordapp.com',
      'media.discordapp.net',
      'images.unsplash.com',
      'i.imgur.com',
      'imgur.com',
      'i.postimg.cc',
      'postimg.cc',
      'prnt.sc',       // Lightshot screenshots
      'puu.sh',        // Puush screenshots
    ];

    const isAllowed = allowedDomains.some(domain => 
      u.hostname === domain || u.hostname.endsWith('.' + domain)
    );

    // Allow any https URL if it looks like an image (has image extension)
    // This is a fallback for other image hosts
    const imageExtensions = /\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?|$)/i;
    const hasImageExtension = imageExtensions.test(u.pathname);
    
    // Also check for common image CDN patterns
    const imagePatterns = [
      /\/attachments\//i,      // Discord attachments
      /\/avatars\//i,          // Discord avatars
      /\/icons\//i,            // Discord guild icons
      /\/emojis\//i,           // Discord emojis
      /\/a\/\d+/i,            // Discord animated images (discriminator)
      /\/thumb\//i,            // YouTube thumbnails
    ];
    
    const matchesImagePattern = imagePatterns.some(pattern => pattern.test(n));
    
    // If URL is from allowed domain OR has image extension OR matches image pattern, allow it
    if (isAllowed || hasImageExtension || matchesImagePattern) {
      return u.toString();
    }

    // For Discord CDN URLs, allow them regardless (they're always images)
    if (u.hostname.includes('discordapp.com') || u.hostname.includes('discord.com')) {
      return u.toString();
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validates if a string could be a valid image URL.
 * Useful for showing user-friendly error messages.
 */
export function isValidImageUrl(url: string): { valid: boolean; reason?: string } {
  if (!url || url.trim() === '') {
    return { valid: false, reason: 'URL is empty' };
  }

  const normalized = normalizeMediaUrlInput(url);
  if (!normalized) {
    return { valid: false, reason: 'Invalid URL format' };
  }

  try {
    const u = new URL(normalized);
    
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { valid: false, reason: 'URL must start with http:// or https://' };
    }

    // Check for Discord message links
    if (normalized.includes('discord.com/channels/') || normalized.includes('discord.com/messages/')) {
      return { 
        valid: false, 
        reason: 'This is a Discord message link, not an image. Please copy the image attachment URL directly from Discord.' 
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }
}
