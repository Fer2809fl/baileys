import { proto } from '../../WAProto/index.js';
import { initAuthCreds } from './auth-utils.js';
import { BufferJSON } from './generics.js';

const CREDS_ROW_KEY = '__creds__';

const CREATE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS creds (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS signal_keys (
  type TEXT NOT NULL,
  id TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (type, id)
);
CREATE INDEX IF NOT EXISTS signal_keys_type_idx ON signal_keys(type);
`;

async function useSqliteAuthState(opts = {}) {
    if (!opts || typeof opts !== 'object' || Array.isArray(opts)) {
        throw new TypeError('SQLite auth options must be an object');
    }
    if (opts.database === undefined && (typeof opts.dbPath !== 'string' || !opts.dbPath.trim())) {
        throw new TypeError('dbPath must be a non-empty string when database is not provided');
    }
    let Database;
    try {
        Database = (await import('better-sqlite3')).default;
    } catch (err) {
        throw new Error('`better-sqlite3` is required for `useSqliteAuthState`. Install with: npm install better-sqlite3');
    }

    const ownsDatabase = opts.database === undefined;
    const db = opts.database || new Database(opts.dbPath);
    if (!db || typeof db.pragma !== 'function' || typeof db.exec !== 'function' || typeof db.prepare !== 'function' || typeof db.transaction !== 'function' || typeof db.close !== 'function') {
        throw new TypeError('database must be a better-sqlite3 compatible database instance');
    }
    db.pragma('busy_timeout = 5000');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.exec(CREATE_SCHEMA_SQL);

    const stmts = {
        credsSelect: db.prepare('SELECT value FROM creds WHERE key = ?'),
        credsUpsert: db.prepare('INSERT INTO creds (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
        keySelect: db.prepare('SELECT value FROM signal_keys WHERE type = ? AND id = ?'),
        keyUpsert: db.prepare('INSERT INTO signal_keys (type, id, value) VALUES (?, ?, ?) ON CONFLICT(type, id) DO UPDATE SET value = excluded.value'),
        keyDelete: db.prepare('DELETE FROM signal_keys WHERE type = ? AND id = ?'),
        keyListIds: db.prepare('SELECT id FROM signal_keys WHERE type = ?'),
        keyList: db.prepare('SELECT id, value FROM signal_keys WHERE type = ?'),
        clearKeys: db.prepare('DELETE FROM signal_keys')
    };

    const writeKeys = db.transaction(data => {
        for (const [category, entries] of Object.entries(data || {})) {
            if (!entries || typeof entries !== 'object' || Array.isArray(entries)) continue;
            for (const [id, value] of Object.entries(entries)) {
                if (value) stmts.keyUpsert.run(category, id, JSON.stringify(value, BufferJSON.replacer));
                else stmts.keyDelete.run(category, id);
            }
        }
    });

    const loadCreds = () => {
        const row = stmts.credsSelect.get(CREDS_ROW_KEY);
        if (!row) return initAuthCreds();
        return JSON.parse(row.value, BufferJSON.reviver);
    };

    const persistCreds = creds => {
        stmts.credsUpsert.run(CREDS_ROW_KEY, JSON.stringify(creds, BufferJSON.replacer));
    };

    const creds = loadCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        const row = stmts.keySelect.get(type, id);
                        if (row) {
                            let value = JSON.parse(row.value, BufferJSON.reviver);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        }
                    }
                    return data;
                },
                set: async data => {
                    if (!data || typeof data !== 'object' || Array.isArray(data)) {
                        throw new TypeError('Signal keys data must be an object');
                    }
                    writeKeys(data);
                }
            }
        },
        saveCreds: async () => { persistCreds(creds); },
        clearKeys: async () => { stmts.clearKeys.run(); },
        close: () => {
            if (ownsDatabase && db.open) db.close();
        }
    };
}

export { useSqliteAuthState };
