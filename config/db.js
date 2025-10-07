const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("MongoDB connected succesfully");
  } catch (err) {
    console.error("MongoDB connection failed", err);
    process.exit();
  }
};

module.exports = connectDB;
