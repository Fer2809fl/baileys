import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Carousel, downloadContentFromMessage } from '../lib/index.js';

const socket = { relayMessage: async () => undefined };
const card = () => ({
  header: {
    hasMediaAttachment: true,
    imageMessage: { mimetype: 'image/jpeg' }
  }
});

const carousel = new Carousel(socket);
assert.equal(carousel.addCard(card()), carousel);

const tenCards = new Carousel(socket);
tenCards.addCard(Array.from({ length: 10 }, card));
assert.throws(() => tenCards.addCard(card()), RangeError);
assert.throws(
  () => new Carousel(socket).addCard({ header: { hasMediaAttachment: true } }),
  TypeError
);
await assert.rejects(
  () => new Carousel(socket).build('123@s.whatsapp.net'),
  /at least one card/
);

const directPath = '/v/t62.15575-24/123_456_n.enc?ccb=11-4&oh=abc&oe=def&_nc_sid=5e03e0';
const originalFetch = globalThis.fetch;
let requestedUrl;

globalThis.fetch = async url => {
  requestedUrl = String(url);
  throw new Error('stop-after-url-capture');
};

try {
  const capture = message =>
    downloadContentFromMessage(
      { mediaKey: randomBytes(32), ...message },
      'sticker'
    );

  await assert.rejects(
    () => capture({
      url: `https://a.whatsapp.net${directPath}&mms3=true`,
      directPath
    }),
    /stop-after-url-capture/
  );
  assert.equal(requestedUrl, `https://mmg.whatsapp.net${directPath}`);

  requestedUrl = undefined;
  await assert.rejects(
    () => capture({
      url: `https://media-cdn-1.cdn.whatsapp.net${directPath}&mms3=true`,
      directPath
    }),
    /stop-after-url-capture/
  );
  assert.equal(requestedUrl, `https://media-cdn-1.cdn.whatsapp.net${directPath}`);

  requestedUrl = undefined;
  await assert.rejects(
    () => capture({ directPath }),
    /stop-after-url-capture/
  );
  assert.equal(requestedUrl, `https://mmg.whatsapp.net${directPath}`);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Runtime smoke tests passed');
