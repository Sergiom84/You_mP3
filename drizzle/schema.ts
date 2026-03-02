import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Conversions table to store YouTube to MP3 conversion history for authenticated users.
 * Tracks video metadata, conversion status, and timestamps.
 */
export const conversions = mysqlTable("conversions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  youtubeUrl: varchar("youtubeUrl", { length: 512 }).notNull(),
  videoTitle: varchar("videoTitle", { length: 255 }),
  videoId: varchar("videoId", { length: 64 }),
  duration: int("duration"), // Duration in seconds
  fileSize: int("fileSize"), // File size in bytes
  status: mysqlEnum("status", ["success", "failed", "pending"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  downloadUrl: varchar("downloadUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Conversion = typeof conversions.$inferSelect;
export type InsertConversion = typeof conversions.$inferInsert;