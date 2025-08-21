// backend/config/db.js
const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI missing in .env');
    process.exit(1);
  }

  mongoose.set('strictQuery', false);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    const { name, host, port } = mongoose.connection;
    console.log(`🍃 MongoDB connected → db: ${name} @ ${host}:${port}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });
}

module.exports = connectDB;
