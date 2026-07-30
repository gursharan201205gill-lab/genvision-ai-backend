// ============================================
// GENVISION AI - BACKEND SERVER
// ============================================

require("dotenv").config();

const dns = require("dns");

dns.lookup(
  "ac-o3lai0r-shard-00-00.6oa6djk.mongodb.net",
  (err, address, family) => {
    if (err) {
      console.error(
        "DNS LOOKUP ERROR:",
        err
      );
    } else {
      console.log(
        "DNS LOOKUP SUCCESS:",
        address,
        "IPv" + family
      );
    }
  }
);

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

// Allow requests from Vercel and other frontends
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// Allow large Base64 image data
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
    "ERROR: MONGO_URI is missing from environment variables."
  );
} else {
  mongoose
    .connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    })
    .then(() => {
      console.log(
        "MongoDB connected successfully"
      );
    })
    .catch((error) => {
      console.error(
        "MongoDB connection error:"
      );

      console.error(error);
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
// SAVE GENERATED IMAGE
// ============================================

app.post(
  "/api/images",
  async (req, res) => {
    try {
      console.log(
        "Received request to save image"
      );

      const {
        prompt,
        image,
      } = req.body;


      // Validate prompt
      if (
        !prompt ||
        typeof prompt !== "string" ||
        !prompt.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A valid prompt is required.",
        });
      }


      // Validate image
      if (
        !image ||
        typeof image !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A valid image is required.",
        });
      }


      // Check MongoDB connection
      if (
        mongoose.connection.readyState !== 1
      ) {
        return res.status(503).json({
          success: false,
          message:
            "MongoDB is not connected.",
        });
      }


      // Create image document
      const newImage = new Image({
        prompt: prompt.trim(),
        image: image,
      });


      // Save image
      const savedImage =
        await newImage.save();


      console.log(
        "Image saved successfully:",
        savedImage._id
      );


      return res.status(201).json({
        success: true,

        message:
          "Image saved successfully.",

        image: savedImage,
      });

    } catch (error) {
      console.error(
        "Error saving image:",
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
// GET ALL SAVED IMAGES
// ============================================

app.get(
  "/api/images",
  async (req, res) => {
    try {
      console.log(
        "Fetching image history..."
      );


      // Check MongoDB connection
      if (
        mongoose.connection.readyState !== 1
      ) {
        return res.status(503).json({
          success: false,

          message:
            "MongoDB is not connected.",
        });
      }


      // Get all images
      const images =
        await Image
          .find()
          .sort({
            createdAt: -1,
          });


      console.log(
        `Found ${images.length} saved images`
      );


      return res.status(200).json(
        images
      );

    } catch (error) {
      console.error(
        "Error fetching image history:",
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
// GET ONE IMAGE
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


      return res.status(200).json(
        image
      );

    } catch (error) {
      console.error(
        "Error fetching image:",
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
        "Error deleting image:",
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