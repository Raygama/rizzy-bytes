import mongoose from "mongoose";

let connectionPromise = null;

export const connectToMongo = async (uri, dbName = null) => {
  if (!uri) {
    throw new Error("MONGO_URI is required to persist chat history");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    mongoose.set("strictQuery", true);
    connectionPromise = mongoose.connect(uri, dbName ? { dbName } : {});
  }

  return connectionPromise;
};

export const disconnectMongo = async () => {
  if (mongoose.connection.readyState === 0) {
    return;
  }
  await mongoose.disconnect();
  connectionPromise = null;
};
