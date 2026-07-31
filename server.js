// ============================================
// GENVISION AI - BACKEND SERVER
// ============================================

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ============================================
// PORT
// ============================================

const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(
  express.json({
    limit: "50mb",
  })
);

// ============================================
// MONGODB CONNECTION
// ============================================

const MONGO_URI = process.env.MONGO_URI;

console.log(
  "Mongo URI exists:",
  Boolean(MONGO_URI)
);

if (!MONGO_URI) {
  console.error(
    "ERROR: MONGO_URI is missing."
  );
} else {
  mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log(
        "MongoDB connected successfully"
      );
    })
    .catch((error) => {
      console.error(
        "MongoDB connection error:",
        error
      );
    });
}

// ============================================
// IMAGE SCHEMA
// ============================================

const imageSchema = new mongoose.Schema(
  {
    prompt: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================
// IMAGE MODEL
// ============================================

const Image = mongoose.model(
  "Image",
  imageSchema
);

// ============================================
// ROOT ROUTE
// ============================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message:
      "GenVision AI Backend is Running!",
  });
});

// ============================================
// HEALTH CHECK
// ============================================

app.get(
  "/api/health",
  (req, res) => {
    res.status(200).json({
      success: true,

      server:
        "Backend is running",

      mongodb:
        mongoose.connection.readyState === 1
          ? "Connected"
          : "Disconnected",
    });
  }
);

// ============================================
// SAVE IMAGE
// ============================================

app.post(
  "/api/images",
  async (req, res) => {
    try {
      console.log(
        "================================"
      );

      console.log(
        "SAVE IMAGE REQUEST RECEIVED"
      );

      const {
        prompt,
        image,
      } = req.body;

      // ----------------------------------------
      // CHECK PROMPT
      // ----------------------------------------

      if (
        !prompt ||
        typeof prompt !== "string" ||
        !prompt.trim()
      ) {
        console.log(
          "ERROR: Invalid prompt"
        );

        return res.status(400).json({
          success: false,
          message:
            "A valid prompt is required.",
        });
      }

      // ----------------------------------------
      // CHECK IMAGE
      // ----------------------------------------

      if (
        !image ||
        typeof image !== "string"
      ) {
        console.log(
          "ERROR: Invalid image"
        );

        return res.status(400).json({
          success: false,
          message:
            "A valid image is required.",
        });
      }

      // ----------------------------------------
      // CHECK MONGODB
      // ----------------------------------------

      if (
        mongoose.connection.readyState !== 1
      ) {
        console.log(
          "ERROR: MongoDB is not connected"
        );

        return res.status(503).json({
          success: false,
          message:
            "MongoDB is not connected.",
        });
      }

      console.log(
        "Prompt:",
        prompt
      );

      console.log(
        "Image length:",
        image.length
      );

      // ----------------------------------------
      // CREATE IMAGE
      // ----------------------------------------

      const newImage =
        new Image({
          prompt:
            prompt.trim(),

          image:
            image,
        });

      // ----------------------------------------
      // SAVE TO MONGODB
      // ----------------------------------------

      const savedImage =
        await newImage.save();

      console.log(
        "IMAGE SAVED SUCCESSFULLY"
      );

      console.log(
        "MongoDB ID:",
        savedImage._id
      );

      console.log(
        "================================"
      );

      return res.status(201).json({
        success: true,

        message:
          "Image saved successfully.",

        image: savedImage,
      });

    } catch (error) {
      console.error(
        "SAVE IMAGE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to save image.",

        error:
          error.message,
      });
    }
  }
);

// ============================================
// GET IMAGE HISTORY
// ============================================

app.get(
  "/api/images",
  async (req, res) => {
    try {
      console.log(
        "================================"
      );

      console.log(
        "FETCHING IMAGE HISTORY..."
      );

      // ----------------------------------------
      // CHECK MONGODB
      // ----------------------------------------

      if (
        mongoose.connection.readyState !== 1
      ) {
        console.log(
          "MongoDB is not connected"
        );

        return res.status(503).json({
          success: false,

          message:
            "MongoDB is not connected.",
        });
      }

      // ----------------------------------------
      // FETCH IMAGES
      // ----------------------------------------

      const images =
        await Image
          .find({})
          .sort({
            createdAt: -1,
          });

      console.log(
        "Found",
        images.length,
        "saved images"
      );

      console.log(
        "================================"
      );

      return res.status(200).json({
        success: true,

        count:
          images.length,

        images:
          images,
      });

    } catch (error) {
      console.error(
        "FETCH HISTORY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to fetch image history.",

        error:
          error.message,
      });
    }
  }
);

// ============================================
// GET SINGLE IMAGE
// ============================================

app.get(
  "/api/images/:id",
  async (req, res) => {
    try {
      const image =
        await Image.findById(
          req.params.id
        );

      if (!image) {
        return res.status(404).json({
          success: false,

          message:
            "Image not found.",
        });
      }

      return res.status(200).json({
        success: true,

        image:
          image,
      });

    } catch (error) {
      console.error(
        "GET IMAGE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to fetch image.",

        error:
          error.message,
      });
    }
  }
);

// ============================================
// DELETE IMAGE
// ============================================

app.delete(
  "/api/images/:id",
  async (req, res) => {
    try {
      const deletedImage =
        await Image.findByIdAndDelete(
          req.params.id
        );

      if (!deletedImage) {
        return res.status(404).json({
          success: false,

          message:
            "Image not found.",
        });
      }

      console.log(
        "Image deleted:",
        req.params.id
      );

      return res.status(200).json({
        success: true,

        message:
          "Image deleted successfully.",
      });

    } catch (error) {
      console.error(
        "DELETE IMAGE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to delete image.",

        error:
          error.message,
      });
    }
  }
);

// ============================================
// 404 ROUTE
// ============================================

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,

      message:
        "Route not found.",
    });
  }
);

// ============================================
// START SERVER
// ============================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Backend server running on port ${PORT}`
    );
  }
);