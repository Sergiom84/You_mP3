import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, conversions, InsertConversion } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Save a new conversion record to the database
 */
export async function saveConversion(data: InsertConversion) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save conversion: database not available");
    return undefined;
  }

  try {
    const result = await db.insert(conversions).values(data);
    return result;
  } catch (error) {
    console.error("[Database] Failed to save conversion:", error);
    throw error;
  }
}

/**
 * Get conversion history for a specific user
 */
export async function getUserConversions(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get conversions: database not available");
    return [];
  }

  try {
    const result = await db
      .select()
      .from(conversions)
      .where(eq(conversions.userId, userId))
      .orderBy((t) => desc(t.createdAt))
      .limit(limit);
    return result;
  } catch (error) {
    console.error("[Database] Failed to get conversions:", error);
    return [];
  }
}

/**
 * Update conversion status after processing
 */
export async function updateConversionStatus(
  conversionId: number,
  status: "success" | "failed" | "pending",
  data?: Partial<Record<string, unknown>>
) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update conversion: database not available");
    return undefined;
  }

  try {
    const result = await db
      .update(conversions)
      .set({
        status,
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(conversions.id, conversionId));
    return result;
  } catch (error) {
    console.error("[Database] Failed to update conversion:", error);
    throw error;
  }
}

// TODO: add feature queries here as your schema grows.
