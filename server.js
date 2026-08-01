// ============================================
// GENVISION AI - BACKEND SERVER
// IMAGE HISTORY + RUNWAY TEXT TO VIDEO
// ============================================

require("dotenv").config();

const dns = require("dns");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const RunwayML = require("@runwayml/sdk");

// ============================================
// APP
// ============================================

const app = express();

// ============================================
// PORT
// ============================================

const PORT = process.env.PORT || 5000;

// ============================================
// ENVIRONMENT VARIABLES
// ============================================

const MONGO_URI = process.env.MONGO_URI;
const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;

console.log("Mongo URI exists:", Boolean(MONGO_URI));
console.log("Runway API key exists:", Boolean(RUNWAY_API_KEY));

// ============================================
// DNS DEBUG
// ============================================

dns.lookup(
  "ac-o3lai0r-shard-00-00.6oa6djk.mongodb.net",
  (err, address, family) => {
    if (err) {
      console.error("DNS LOOKUP ERROR:", err);
    } else {
      console.log(
        "DNS LOOKUP SUCCESS:",
        address,
        "IPv" + family
      );
    }
  }
);

// ============================================
// MIDDLEWARE
// ============================================

app.use(
  cors({
    origin: "*",
    methods: [
      "GET",
      "POST",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
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
// RUNWAY CLIENT
// ============================================

let runway = null;

if (RUNWAY_API_KEY) {
  runway = new RunwayML({
    apiKey: RUNWAY_API_KEY,
  });

  console.log(
    "Runway client initialized successfully"
  );
} else {
  console.error(
    "WARNING: RUNWAY_API_KEY is missing."
  );
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

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,

    server:
      "Backend is running",

    mongodb:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",

    runway:
      RUNWAY_API_KEY
        ? "Configured"
        : "Not configured",
  });
});

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

      // ----------------------------------------
      // Validate prompt
      // ----------------------------------------

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

      // ----------------------------------------
      // Validate image
      // ----------------------------------------

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

      // ----------------------------------------
      // Check MongoDB connection
      // ----------------------------------------

      if (
        mongoose.connection.readyState !== 1
      ) {
        return res.status(503).json({
          success: false,
          message:
            "MongoDB is not connected.",
        });
      }

      // ----------------------------------------
      // Create image document
      // ----------------------------------------

      const newImage = new Image({
        prompt: prompt.trim(),
        image: image,
      });

      // ----------------------------------------
      // Save image
      // ----------------------------------------

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

        image:
          savedImage,
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

      // ----------------------------------------
      // Check MongoDB connection
      // ----------------------------------------

      if (
        mongoose.connection.readyState !== 1
      ) {
        return res.status(503).json({
          success: false,

          message:
            "MongoDB is not connected.",
        });
      }

      // ----------------------------------------
      // Get all images
      // ----------------------------------------

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
// RUNWAY TEXT TO VIDEO
// ============================================

app.post(
  "/api/videos/generate",
  async (req, res) => {
    try {
      console.log(
        "================================"
      );

      console.log(
        "Received Text-to-Video request"
      );

      console.log(
        "================================"
      );

      // ----------------------------------------
      // Check Runway configuration
      // ----------------------------------------

      if (!runway) {
        return res.status(500).json({
          success: false,

          message:
            "Runway API is not configured. Please check RUNWAY_API_KEY.",
        });
      }

      // ----------------------------------------
      // Get request body
      // ----------------------------------------

      const {
        prompt,
        ratio = "1280:720",
      } = req.body;

      // ----------------------------------------
      // Validate prompt
      // ----------------------------------------

      if (
        !prompt ||
        typeof prompt !== "string" ||
        !prompt.trim()
      ) {
        return res.status(400).json({
          success: false,

          message:
            "A valid video prompt is required.",
        });
      }

      // ----------------------------------------
      // Validate prompt length
      // ----------------------------------------

      if (
        prompt.trim().length > 1000
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Video prompt must be 1000 characters or less.",
        });
      }

      // ----------------------------------------
      // Validate ratio
      // ----------------------------------------

      const allowedRatios = [
        "1280:720",
        "720:1280",
      ];

      if (
        !allowedRatios.includes(
          ratio
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid video ratio. Use 1280:720 or 720:1280.",
        });
      }

      console.log(
        "Video prompt:",
        prompt.trim()
      );

      console.log(
        "Video ratio:",
        ratio
      );

      // ----------------------------------------
      // CREATE RUNWAY TEXT-TO-VIDEO TASK
      // ----------------------------------------

      const task =
      await runway.textToVideo
      .create({
      model: "gen4.5",

      promptText:
      prompt.trim(),
        ratio:
          ratio,
        
        duration:
          numericDuration,
      });

console.log(
  "Runway task created:",
  task.id
);

      // ----------------------------------------
      // LOG TASK
      // ----------------------------------------

      console.log(
        "Runway task created successfully"
      );

      console.log(
        "Runway task ID:",
        task.id
      );

      console.log(
        "Runway task status:",
        task.status
      );

      // ----------------------------------------
      // RETURN TASK ID
      // ----------------------------------------

      return res.status(202).json({
        success: true,

        message:
          "Video generation started.",

        taskId:
          task.id,
      });

    } catch (error) {
      console.error(
        "================================"
      );

      console.error(
        "RUNWAY TEXT-TO-VIDEO ERROR"
      );

      console.error(
        "================================"
      );

      console.error(
        "Error message:",
        error.message
      );

      console.error(
        "Error status:",
        error.status
      );

      console.error(
        "Error response:",
        error.response
      );

      console.error(
        "Full error:",
        error
      );

      return res.status(
        error.status || 500
      ).json({
        success: false,

        message:
          "Failed to start video generation.",

        error:
          error.message ||
          String(error),

        status:
          error.status || 500,
      });
    }
  }
);

// ============================================
// RUNWAY VIDEO STATUS
// ============================================

app.get(
  "/api/videos/status/:taskId",
  async (req, res) => {
    try {
      // ----------------------------------------
      // Check Runway configuration
      // ----------------------------------------

      if (!runway) {
        return res.status(500).json({
          success: false,

          message:
            "Runway API is not configured.",
        });
      }

      // ----------------------------------------
      // Get task ID
      // ----------------------------------------

      const taskId =
        req.params.taskId;

      if (!taskId) {
        return res.status(400).json({
          success: false,

          message:
            "Task ID is required.",
        });
      }

      console.log(
        "Checking Runway task:",
        taskId
      );

      // ----------------------------------------
      // Get Runway task
      // ----------------------------------------

      const task =
        await runway.tasks.retrieve(
          taskId
        );

      console.log(
        "Runway task status:",
        task.status
      );

      // ----------------------------------------
      // Return status
      // ----------------------------------------

      return res.status(200).json({
        success: true,

        taskId:
          task.id,

        status:
          task.status,

        output:
          task.output || null,

        failure:
          task.failure || null,

        failureCode:
          task.failureCode || null,
      });

    } catch (error) {
      console.error(
        "Runway task status error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to check video status.",

        error:
          error.message ||
          String(error),
      });
    }
  }
);

// ============================================
// 404 ROUTE
// MUST ALWAYS BE LAST
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