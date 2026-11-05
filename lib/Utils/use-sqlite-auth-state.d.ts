import type { AuthenticationState } from "../Types/index.js";

export interface SqliteStatement {
    get(...params: unknown[]): { value: string } | undefined;
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
}

export interface SqliteDatabase {
    readonly open: boolean;
    pragma(source: string): unknown;
    exec(source: string): unknown;
    prepare(source: string): SqliteStatement;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
    close(): void;
}

export interface SqliteAuthStateOptions {
    dbPath?: string;
    database?: SqliteDatabase;
}

export declare function useSqliteAuthState(opts: SqliteAuthStateOptions): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
    clearKeys: () => Promise<void>;
    close: () => void;
}>;
