import mongoose from 'mongoose';

export async function connectDatabase({ uri, dbName }) {
  if (!uri || uri.includes('YOUR_')) throw new Error('Set MONGODB_URI before starting the server.');
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}

export { mongoose };
