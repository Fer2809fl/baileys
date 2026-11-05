/**
 * Build an externalAdReply card for WhatsApp messages.
 * A local thumbnail Buffer can be used without any URL.
 * WhatsApp itself controls official/verified account badges.
 */

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const makeExternalAdReply = (options = {}) => {
  if (!isObject(options)) {
    throw new TypeError('externalAdReply options must be an object');
  }

  const {
    title,
    body,
    thumbnail,
    sourceUrl,
    mediaUrl,
    mediaType = 1,
    renderLargerThumbnail = true,
    showAdAttribution = false,
    containsAutoReply,
  } = options;

  if (title !== undefined && typeof title !== 'string') {
    throw new TypeError('title must be a string');
  }
  if (body !== undefined && typeof body !== 'string') {
    throw new TypeError('body must be a string');
  }
  if (sourceUrl !== undefined && typeof sourceUrl !== 'string') {
    throw new TypeError('sourceUrl must be a string');
  }
  if (mediaUrl !== undefined && typeof mediaUrl !== 'string') {
    throw new TypeError('mediaUrl must be a string');
  }
  if (![0, 1, 2].includes(mediaType)) {
    throw new RangeError('mediaType must be 0 (none), 1 (image), or 2 (video)');
  }
  if (typeof renderLargerThumbnail !== 'boolean') {
    throw new TypeError('renderLargerThumbnail must be a boolean');
  }
  if (typeof showAdAttribution !== 'boolean') {
    throw new TypeError('showAdAttribution must be a boolean');
  }
  if (containsAutoReply !== undefined && typeof containsAutoReply !== 'boolean') {
    throw new TypeError('containsAutoReply must be a boolean');
  }
  if (
    thumbnail !== undefined &&
    !Buffer.isBuffer(thumbnail) &&
    !(thumbnail instanceof Uint8Array)
  ) {
    throw new TypeError('thumbnail must be a Buffer or Uint8Array');
  }

  const reply = {
    mediaType,
    renderLargerThumbnail,
    showAdAttribution,
  };

  if (title !== undefined) reply.title = title;
  if (body !== undefined) reply.body = body;
  if (thumbnail !== undefined) reply.thumbnail = Buffer.from(thumbnail);
  if (sourceUrl) reply.sourceUrl = sourceUrl;
  if (mediaUrl) reply.mediaUrl = mediaUrl;
  if (containsAutoReply !== undefined) {
    reply.containsAutoReply = containsAutoReply;
  }

  return reply;
};

export const makeExternalAdReplyMessage = (text, options = {}) => {
  if (typeof text !== 'string') {
    throw new TypeError('message text must be a string');
  }

  return {
    extendedTextMessage: {
      text,
      contextInfo: {
        externalAdReply: makeExternalAdReply(options),
      },
    },
  };
};

export const sendExternalAdReply = (
  sock,
  jid,
  text,
  previewOptions = {},
  messageOptions = {},
) => {
  if (!sock || typeof sock.sendMessage !== 'function') {
    throw new TypeError('sock must expose sendMessage()');
  }
  if (typeof jid !== 'string' || !jid) {
    throw new TypeError('jid must be a non-empty string');
  }

  return sock.sendMessage(
    jid,
    {
      text,
      contextInfo: {
        externalAdReply: makeExternalAdReply(previewOptions),
      },
    },
    messageOptions,
  );
};
