import { MongoClient, type Document } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: ReturnType<MongoClient['db']> | null = null;

async function connectClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured. Unable to store observation images.');
  }

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5_000,
  });
  cachedClient = await client.connect();
  return cachedClient;
}

export async function getMongoDb() {
  if (cachedDb) {
    return cachedDb;
  }

  const client = await connectClient();
  const dbName = process.env.MONGODB_DB || 'emr';
  cachedDb = client.db(dbName);
  return cachedDb;
}

export async function getMongoCollection<TSchema extends Document = Document>(name: string) {
  const db = await getMongoDb();
  return db.collection<TSchema>(name);
}
