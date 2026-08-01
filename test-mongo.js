require("dotenv").config();

const mongoose = require("mongoose");

console.log("Testing MongoDB connection...");
console.log(
  "MONGO_URI exists:",
  Boolean(process.env.MONGO_URI)
);

mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
  })
  .then(() => {
    console.log("✅ MONGODB CONNECTION SUCCESSFUL");

    process.exit(0);
  })
  .catch((error) => {
    console.error(
      "❌ MONGODB CONNECTION FAILED"
    );

    console.error(
      error
    );

    process.exit(1);
  });