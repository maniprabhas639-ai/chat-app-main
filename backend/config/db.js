// backend/config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    // Optional: silence strictQuery warnings (Mongoose 7+)
    mongoose.set("strictQuery", false);

    await mongoose.connect(uri);

    console.log("🟢 MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }

  // Log connection events for better visibility in dev/prod
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
