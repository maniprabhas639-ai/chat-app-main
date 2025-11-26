// backend/config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI is not defined in environment variables");
    // avoid indefinite hang in prod — let caller handle
    throw new Error("MONGO_URI not defined");
  }

  mongoose.set("strictQuery", false);

  const maxAttempts = 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      attempt += 1;
      console.log(`MongoDB: connecting (attempt ${attempt}/${maxAttempts})...`);
      await mongoose.connect(uri, {
        // recommended options are internal to mongoose 6/7; leave defaults otherwise
        // useUnifiedTopology, useNewUrlParser are handled by mongoose already
      });
      console.log("🟢 MongoDB connected");
      break;
    } catch (error) {
      console.error(`❌ MongoDB connection attempt ${attempt} failed:`, error.message);
      if (attempt >= maxAttempts) {
        console.error("💥 MongoDB: max attempts reached. Throwing error.");
        // throw so caller (server) can decide to exit / retry / crash-loop
        throw error;
      }
      const delay = 1000 * Math.pow(2, attempt); // exponential backoff
      console.log(`MongoDB: retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️ MongoDB disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("🔄 MongoDB reconnected");
  });

  mongoose.connection.on("error", (err) => {
    console.error("💥 MongoDB error:", err);
  });
};

module.exports = connectDB;
