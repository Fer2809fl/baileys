import { Carousel, downloadContentFromMessage, getUrlFromDirectPath } from '../lib/index.js';
import type { WASocket } from '../lib/index.js';
import type { MediaDownloadOptions } from '../lib/Utils/messages-media.js';

declare const socket: WASocket;

const carousel = new Carousel(socket);
carousel.addCard({
  header: {
    hasMediaAttachment: true,
    imageMessage: { mimetype: 'image/jpeg' }
  }
});

const mediaOptions: MediaDownloadOptions = {
  host: 'mmg.whatsapp.net',
  startByte: 0
};

const mediaUrl: string = getUrlFromDirectPath('/media/path', mediaOptions.host);

void mediaUrl;
void downloadContentFromMessage(
  {
    mediaKey: new Uint8Array(32),
    directPath: '/media/path'
  },
  'image',
  mediaOptions
);
