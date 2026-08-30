import { openDB, type IDBPDatabase } from 'idb'

import type { BudgetDoc } from '@/lib/domain/types'
import { MemoryStorage, type BudgetStorage } from './storage'

const DB_NAME = 'finance-budget'
const DB_VERSION = 1
const STORE = 'doc'
const KEY = 'current'

class IndexedDbStorage implements BudgetStorage {
  private db: Promise<IDBPDatabase> | null = null

  private connect() {
    if (!this.db) {
      this.db = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
        },
      })
    }
    return this.db
  }

  async load(): Promise<BudgetDoc | null> {
    const db = await this.connect()
    return (await db.get(STORE, KEY)) ?? null
  }

  async save(doc: BudgetDoc): Promise<void> {
    const db = await this.connect()
    await db.put(STORE, doc, KEY)
  }

  async clear(): Promise<void> {
    const db = await this.connect()
    await db.delete(STORE, KEY)
  }
}

let instance: BudgetStorage | null = null

export function getStorage(): BudgetStorage {
  if (instance) return instance
  instance =
    typeof indexedDB === 'undefined' ? new MemoryStorage() : new IndexedDbStorage()
  return instance
}
