// ─────────────────────────────────────────────────────────
// MongoDB Client — singleton connection for API routes
// ─────────────────────────────────────────────────────────

import { MongoClient, Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB = process.env.MONGODB_DB || "anime_schedule";

if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable");
}

// Cache the client promise in a global to prevent multiple connections in dev
let cached = (global as unknown as { _mongoClientPromise?: Promise<MongoClient> })._mongoClientPromise;

if (!cached) {
    const client = new MongoClient(MONGODB_URI);
    cached = client.connect();
    (global as unknown as { _mongoClientPromise?: Promise<MongoClient> })._mongoClientPromise = cached;
}

const clientPromise: Promise<MongoClient> = cached;

export async function getDb(): Promise<Db> {
    const client = await clientPromise;
    return client.db(MONGODB_DB);
}

export default clientPromise;
