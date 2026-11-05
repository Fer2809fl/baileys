/**
 * Options for WhatsApp externalAdReply cards.
 * Supply thumbnail bytes to render an image without a URL.
 */
export interface ExternalAdReplyOptions {
  title?: string;
  body?: string;
  thumbnail?: Buffer | Uint8Array;
  /** Optional source link; omit for a card without a visible URL. */
  sourceUrl?: string;
  mediaUrl?: string;
  /** 0 = none, 1 = image, 2 = video. */
  mediaType?: 0 | 1 | 2;
  /** true requests a large thumbnail; false requests a compact thumbnail. */
  renderLargerThumbnail?: boolean;
  /** Requests WhatsApp's supported ad attribution label; not a verified badge. */
  showAdAttribution?: boolean;
  containsAutoReply?: boolean;
}

export declare function makeExternalAdReply(
  options?: ExternalAdReplyOptions,
): Record<string, unknown>;

export declare function makeExternalAdReplyMessage(
  text: string,
  options?: ExternalAdReplyOptions,
): {
  extendedTextMessage: {
    text: string;
    contextInfo: {
      externalAdReply: Record<string, unknown>;
    };
  };
};

export declare function sendExternalAdReply(
  sock: {
    sendMessage(
      jid: string,
      content: any,
      options?: any,
    ): Promise<any>;
  },
  jid: string,
  text: string,
  previewOptions?: ExternalAdReplyOptions,
  messageOptions?: any,
): Promise<any>;
