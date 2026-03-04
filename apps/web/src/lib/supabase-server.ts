/**
 * Mock Supabase client for demo mode.
 * All queries operate on in-memory mock data — no real database connection required.
 */

import { MOCK_DATA } from './mock-data';

class MockQueryBuilder {
  private _table: string;
  private _conditions: Array<(row: Record<string, unknown>) => boolean> = [];
  private _orderField?: string;
  private _orderAsc = false;
  private _limit?: number;
  private _rangeFrom?: number;
  private _rangeTo?: number;
  private _single = false;
  private _maybeSingle = false;
  private _countExact = false;
  private _operation: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private _writeData?: Record<string, unknown> | Record<string, unknown>[];
  private _onConflict?: string;

  constructor(table: string) {
    this._table = table;
  }

  select(_cols?: string, opts?: { count?: string }) {
    if (opts?.count === 'exact') this._countExact = true;
    return this;
  }

  eq(col: string, val: unknown) {
    this._conditions.push(row => row[col] === val);
    return this;
  }

  neq(col: string, val: unknown) {
    this._conditions.push(row => row[col] !== val);
    return this;
  }

  gte(col: string, val: unknown) {
    this._conditions.push(row => row[col] != null && (row[col] as string) >= (val as string));
    return this;
  }

  lte(col: string, val: unknown) {
    this._conditions.push(row => row[col] != null && (row[col] as string) <= (val as string));
    return this;
  }

  gt(col: string, val: unknown) {
    this._conditions.push(row => row[col] != null && (row[col] as string) > (val as string));
    return this;
  }

  lt(col: string, val: unknown) {
    this._conditions.push(row => row[col] != null && (row[col] as string) < (val as string));
    return this;
  }

  ilike(col: string, pattern: string) {
    // Strip leading/trailing % for simple contains check (covers %text% pattern)
    const inner = pattern.replace(/^%+|%+$/g, '').toLowerCase();
    this._conditions.push(row => String(row[col] ?? '').toLowerCase().includes(inner));
    return this;
  }

  not(col: string, filter: string, val: unknown) {
    if (filter === 'is' && val === null) {
      this._conditions.push(row => row[col] !== null && row[col] !== undefined);
    } else {
      this._conditions.push(row => row[col] !== val);
    }
    return this;
  }

  is(col: string, val: unknown) {
    if (val === null) {
      this._conditions.push(row => row[col] === null || row[col] === undefined);
    } else {
      this._conditions.push(row => row[col] === val);
    }
    return this;
  }

  in(col: string, vals: unknown[]) {
    this._conditions.push(row => vals.includes(row[col]));
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this._orderField = col;
    this._orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this._limit = n;
    return this;
  }

  range(from: number, to: number) {
    this._rangeFrom = from;
    this._rangeTo = to;
    return this;
  }

  single() {
    this._single = true;
    return this;
  }

  maybeSingle() {
    this._maybeSingle = true;
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]) {
    this._operation = 'insert';
    this._writeData = data;
    return this;
  }

  upsert(data: Record<string, unknown> | Record<string, unknown>[], opts?: { onConflict?: string }) {
    this._operation = 'upsert';
    this._writeData = data;
    this._onConflict = opts?.onConflict;
    return this;
  }

  update(data: Record<string, unknown>) {
    this._operation = 'update';
    this._writeData = data;
    return this;
  }

  delete() {
    this._operation = 'delete';
    return this;
  }

  private _getRows(): Record<string, unknown>[] {
    return (MOCK_DATA[this._table] ?? []) as Record<string, unknown>[];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _execute(): { data: any; error: { message: string; code?: string } | null; count?: number } {
    const rows = this._getRows();

    // ── INSERT ──────────────────────────────────────────────────────────────────
    if (this._operation === 'insert') {
      const items = Array.isArray(this._writeData) ? this._writeData : [this._writeData as Record<string, unknown>];
      const inserted = items.map(item => ({
        id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        created_at: new Date().toISOString(),
        ...item,
      }));
      rows.push(...inserted);
      if (this._single || this._maybeSingle) return { data: inserted[0] ?? null, error: null };
      return { data: inserted, error: null };
    }

    // ── UPSERT ──────────────────────────────────────────────────────────────────
    if (this._operation === 'upsert') {
      const conflictKey = this._onConflict ?? 'id';
      const items = Array.isArray(this._writeData) ? this._writeData : [this._writeData as Record<string, unknown>];
      const results = items.map(item => {
        const idx = rows.findIndex(r => r[conflictKey] === (item as Record<string, unknown>)[conflictKey]);
        if (idx >= 0) {
          Object.assign(rows[idx], item);
          return rows[idx];
        }
        const newRow = { id: `mock-${Date.now()}`, created_at: new Date().toISOString(), ...item };
        rows.push(newRow);
        return newRow;
      });
      if (this._single || this._maybeSingle) return { data: results[0] ?? null, error: null };
      return { data: results, error: null };
    }

    // ── UPDATE ──────────────────────────────────────────────────────────────────
    if (this._operation === 'update') {
      const updated: Record<string, unknown>[] = [];
      for (const row of rows) {
        if (this._conditions.every(fn => fn(row))) {
          Object.assign(row, this._writeData);
          updated.push(row);
        }
      }
      if (this._single) {
        return {
          data: updated[0] ?? null,
          error: updated.length === 0 ? { message: 'No rows updated', code: 'PGRST116' } : null,
        };
      }
      return { data: updated, error: null };
    }

    // ── DELETE ──────────────────────────────────────────────────────────────────
    if (this._operation === 'delete') {
      return { data: null, error: null };
    }

    // ── SELECT ──────────────────────────────────────────────────────────────────
    let results = [...rows];
    for (const cond of this._conditions) {
      results = results.filter(cond);
    }

    if (this._orderField) {
      const field = this._orderField;
      const asc = this._orderAsc;
      results.sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        if (av < bv) return asc ? -1 : 1;
        if (av > bv) return asc ? 1 : -1;
        return 0;
      });
    }

    const totalCount = results.length;

    if (this._limit !== undefined) results = results.slice(0, this._limit);
    if (this._rangeFrom !== undefined && this._rangeTo !== undefined) {
      results = results.slice(this._rangeFrom, this._rangeTo + 1);
    }

    if (this._single) {
      return {
        data: results[0] ?? null,
        error: results.length === 0 ? { message: 'Row not found', code: 'PGRST116' } : null,
      };
    }
    if (this._maybeSingle) {
      return { data: results[0] ?? null, error: null };
    }

    return {
      data: results,
      error: null,
      ...(this._countExact ? { count: totalCount } : {}),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  then(resolve: (val: any) => any, reject?: (err: any) => any): Promise<any> {
    return Promise.resolve(this._execute()).then(resolve, reject);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  catch(fn: (err: any) => any): Promise<any> {
    return Promise.resolve(this._execute()).catch(fn);
  }
}

// Drop-in replacement for the real Supabase admin client
export const supabaseAdmin = {
  from(table: string): MockQueryBuilder {
    return new MockQueryBuilder(table);
  },
};
