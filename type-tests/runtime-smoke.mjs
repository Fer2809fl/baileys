import assert from 'node:assert/strict';
import { createCipheriv, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { Agent } from 'node:https';
import { writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadEncryptedContent, getWAUploadToServer, toBuffer } from '../lib/Utils/messages-media.js';
import { proto } from '../WAProto/index.js';
import processMessage from '../lib/Utils/process-message.js';
import { decodeMessageNode } from '../lib/Utils/decode-wa-message.js';
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


const ownJid = '5210000000000@s.whatsapp.net';
const ownLid = '5210000000000@lid';
const decodedOwnPn = decodeMessageNode({
  tag: 'message',
  attrs: { id: 'self-pn', from: ownJid, t: '1' },
  content: []
}, ownJid, ownLid);
assert.equal(decodedOwnPn.fullMessage.key.fromMe, true);

const decodedOwnLid = decodeMessageNode({
  tag: 'message',
  attrs: { id: 'self-lid', from: ownLid, t: '1' },
  content: []
}, ownJid, ownLid);
assert.equal(decodedOwnLid.fullMessage.key.fromMe, true);

const protocolEvents = [];
const securityWarnings = [];
const processContext = {
  shouldProcessHistoryMsg: false,
  ev: {
    emit: (event, payload) => protocolEvents.push({ event, payload })
  },
  creds: { me: { id: ownJid }, accountSettings: {} },
  signalRepository: {},
  keyStore: {},
  logger: {
    info: () => undefined,
    debug: () => undefined,
    warn: (...args) => securityWarnings.push(args)
  },
  options: {},
  getMessage: async () => undefined
};

const selfOnlyTypes = [
  proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION,
  proto.Message.ProtocolMessage.Type.APP_STATE_SYNC_KEY_SHARE,
  proto.Message.ProtocolMessage.Type.LID_MIGRATION_MAPPING_SYNC,
  proto.Message.ProtocolMessage.Type.PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE
];

for (const type of selfOnlyTypes) {
  await processMessage({
    key: {
      remoteJid: '5211111111111@s.whatsapp.net',
      fromMe: false,
      id: `spoofed-${type}`
    },
    message: { protocolMessage: { type } },
    messageTimestamp: 1
  }, processContext);
}

assert.equal(protocolEvents.length, 0);
assert.equal(securityWarnings.length, selfOnlyTypes.length);

await processMessage({
  key: {
    remoteJid: ownJid,
    fromMe: true,
    id: 'valid-self-history'
  },
  message: {
    protocolMessage: {
      type: proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION
    }
  },
  messageTimestamp: 1
}, processContext);
assert.equal(securityWarnings.length, selfOnlyTypes.length);

await processMessage({
  key: {
    remoteJid: '5211111111111@s.whatsapp.net',
    fromMe: false,
    id: 'valid-revoke'
  },
  message: {
    protocolMessage: {
      type: proto.Message.ProtocolMessage.Type.REVOKE,
      key: { id: 'message-to-revoke' }
    }
  },
  messageTimestamp: 1
}, processContext);
assert.equal(protocolEvents.length, 1);
assert.equal(protocolEvents[0].event, 'messages.update');


const uploadPath = join(tmpdir(), `baileys-dispatcher-smoke-${process.pid}-${Date.now()}.bin`);
const originalFetchForUpload = globalThis.fetch;
const originalBunDescriptor = Object.getOwnPropertyDescriptor(process.versions, 'bun');
let uploadFetchInit;
await writeFile(uploadPath, Buffer.from('baileys upload smoke test'));
Object.defineProperty(process.versions, 'bun', {
  value: 'test-runtime',
  configurable: true
});
globalThis.fetch = async (_url, init) => {
  uploadFetchInit = init;
  if (init?.body) {
    await new Response(init.body).text();
  }
  return new Response(JSON.stringify({
    url: 'https://example.com/media',
    direct_path: '/media'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

try {
  const mediaConn = {
    auth: 'auth-token',
    ttl: 60,
    hosts: [{ hostname: 'upload.example.com', maxContentLengthBytes: 1024 }],
    fetchDate: new Date()
  };
  const upload = getWAUploadToServer({
    customUploadHosts: [],
    fetchAgent: new Agent(),
    logger: { debug: () => undefined, warn: () => undefined, error: () => undefined },
    options: {}
  }, async () => mediaConn);
  const uploadResult = await upload(uploadPath, {
    fileEncSha256B64: 'abc123',
    mediaType: 'image'
  });
  assert.equal(uploadResult.mediaUrl, 'https://example.com/media');
  assert.equal(uploadResult.directPath, '/media');
  assert.equal(uploadFetchInit?.dispatcher, undefined);
} finally {
  globalThis.fetch = originalFetchForUpload;
  if (originalBunDescriptor) {
    Object.defineProperty(process.versions, 'bun', originalBunDescriptor);
  } else {
    delete process.versions.bun;
  }
  await rm(uploadPath, { force: true });
}


const encryptMedia = (plaintext, cipherKey, iv) => {
  const cipher = createCipheriv('aes-256-cbc', cipherKey, iv);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
};

const withMediaServer = async (handler, run) => {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine the media test server port');
  }
  try {
    await run(`http://127.0.0.1:${address.port}/media`);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(() => resolve()));
  }
};

const mediaCipherKey = randomBytes(32);
const mediaIv = randomBytes(16);
const completePlaintext = randomBytes(64 * 1024);
const completeCiphertext = encryptMedia(completePlaintext, mediaCipherKey, mediaIv);

await withMediaServer((_req, res) => {
  res.writeHead(200, { 'Content-Length': completeCiphertext.length });
  res.end(completeCiphertext);
}, async url => {
  const stream = await downloadEncryptedContent(url, {
    cipherKey: mediaCipherKey,
    iv: mediaIv
  });
  assert.deepEqual(await toBuffer(stream), completePlaintext);
});

const interruptedCiphertext = encryptMedia(
  randomBytes(256 * 1024),
  mediaCipherKey,
  mediaIv
);

await withMediaServer((req, res) => {
  res.writeHead(200, { 'Content-Length': interruptedCiphertext.length });
  res.write(interruptedCiphertext.subarray(0, 64 * 1024), () => req.socket.destroy());
}, async url => {
  const stream = await downloadEncryptedContent(url, {
    cipherKey: mediaCipherKey,
    iv: mediaIv
  });
  await assert.rejects(
    () => toBuffer(stream),
    /terminated|aborted|other side closed|fetch failed/i
  );
});

console.log('Runtime smoke tests passed');
