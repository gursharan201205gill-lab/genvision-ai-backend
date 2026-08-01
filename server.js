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

console.log("================================");
console.log("GENVISION AI BACKEND STARTING");
console.log("================================");

console.log(
  "Mongo URI exists:",
  Boolean(MONGO_URI)
);

console.log(
  "Runway API key exists:",
  Boolean(RUNWAY_API_KEY)
);

// ============================================
// DNS DEBUG
// ============================================

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

// ============================================
// JSON BODY PARSER
// ============================================

app.use(
  express.json({
    limit: "50mb",
  })
);

// ============================================
// REQUEST DEBUG MIDDLEWARE
// ============================================

app.use(
  (req, res, next) => {
    console.log(
      `${new Date().toISOString()} - ${req.method} ${req.originalUrl}`
    );

    next();
  }
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
// MONGODB CONNECTION EVENTS
// ============================================

mongoose.connection.on(
  "connected",
  () => {
    console.log(
      "MongoDB connection event: connected"
    );
  }
);

mongoose.connection.on(
  "error",
  (error) => {
    console.error(
      "MongoDB connection event error:",
      error
    );
  }
);

mongoose.connection.on(
  "disconnected",
  () => {
    console.log(
      "MongoDB connection event: disconnected"
    );
  }
);

// ============================================
// RUNWAY CLIENT
// ============================================

let runway = null;

if (RUNWAY_API_KEY) {
  try {
    runway = new RunwayML({
      apiKey: RUNWAY_API_KEY,
    });

    console.log(
      "Runway client initialized successfully"
    );

  } catch (error) {
    console.error(
      "Failed to initialize Runway client:"
    );

    console.error(error);

    runway = null;
  }

} else {
  console.error(
    "WARNING: RUNWAY_API_KEY is missing."
  );
}

// ============================================
// IMAGE SCHEMA
// ============================================

const imageSchema =
  new mongoose.Schema(
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

const Image =
  mongoose.model(
    "Image",
    imageSchema
  );

// ============================================
// ROOT ROUTE
// ============================================

app.get(
  "/",
  (req, res) => {
    res.status(200).json({
      success: true,

      message:
        "GenVision AI Backend is Running!",
    });
  }
);

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

      runway:
        RUNWAY_API_KEY
          ? "Configured"
          : "Not configured",
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

      // ----------------------------------------
      // VALIDATE PROMPT
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
      // VALIDATE IMAGE
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
      // CHECK MONGODB
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
      // SAVE IMAGE
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
      // CHECK MONGODB
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
      // GET IMAGES
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

    console.log(
      "================================"
    );

    console.log(
      "VIDEO GENERATION REQUEST RECEIVED"
    );

    console.log(
      "================================"
    );

    try {

      // ----------------------------------------
      // CHECK RUNWAY CLIENT
      // ----------------------------------------

      if (!runway) {

        console.error(
          "Runway client is not initialized."
        );

        return res.status(500).json({
          success: false,

          message:
            "Runway API is not configured. Please check RUNWAY_API_KEY.",
        });
      }

      // ----------------------------------------
      // PRINT REQUEST BODY
      // ----------------------------------------

      console.log(
        "Request body:",
        req.body
      );

      // ----------------------------------------
      // GET PROMPT
      // ----------------------------------------

      const prompt =
        req.body?.prompt;

      // ----------------------------------------
      // GET RATIO
      // ----------------------------------------

      const ratio =
        req.body?.ratio ||
        "1280:720";

      // ----------------------------------------
      // GET DURATION
      // ----------------------------------------

      const duration =
        Number(
          req.body?.duration || 5
        );

      // ----------------------------------------
      // LOG REQUEST DATA
      // ----------------------------------------

      console.log(
        "Video prompt:",
        prompt
      );

      console.log(
        "Video ratio:",
        ratio
      );

      console.log(
        "Video duration:",
        duration
      );

      // ----------------------------------------
      // VALIDATE PROMPT
      // ----------------------------------------

      if (
        !prompt ||
        typeof prompt !== "string" ||
        !prompt.trim()
      ) {

        console.error(
          "Invalid video prompt."
        );

        return res.status(400).json({
          success: false,

          message:
            "Please enter a valid video prompt.",
        });
      }

      // ----------------------------------------
      // VALIDATE PROMPT LENGTH
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
      // VALIDATE RATIO
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

        console.error(
          "Invalid video ratio:",
          ratio
        );

        return res.status(400).json({
          success: false,

          message:
            "Invalid video ratio. Use 1280:720 or 720:1280.",
        });
      }

      // ----------------------------------------
      // VALIDATE DURATION
      // ----------------------------------------

      if (
        !Number.isInteger(
          duration
        ) ||
        duration < 2 ||
        duration > 10
      ) {

        console.error(
          "Invalid video duration:",
          duration
        );

        return res.status(400).json({
          success: false,

          message:
            "Duration must be an integer between 2 and 10 seconds.",
        });
      }

      // ----------------------------------------
      // FINAL REQUEST DATA
      // ----------------------------------------

      console.log(
        "================================"
      );

      console.log(
        "SENDING REQUEST TO RUNWAY"
      );

      console.log(
        "================================"
      );

      console.log(
        "Model:",
        "gen4.5"
      );

      console.log(
        "Prompt:",
        prompt.trim()
      );

      console.log(
        "Ratio:",
        ratio
      );

      console.log(
        "Duration:",
        duration
      );

      // ----------------------------------------
      // RUNWAY TEXT TO VIDEO
      // ----------------------------------------

      const task =
        await runway.textToVideo.create({

          model:
            "gen4.5",

          promptText:
            prompt.trim(),

          ratio:
            ratio,

          duration:
            duration,

        });

      // ----------------------------------------
      // TASK CREATED
      // ----------------------------------------

      console.log(
        "================================"
      );

      console.log(
        "RUNWAY TASK CREATED SUCCESSFULLY"
      );

      console.log(
        "Task ID:",
        task.id
      );

      console.log(
        "Task Status:",
        task.status
      );

      console.log(
        "================================"
      );

      // ----------------------------------------
      // RETURN TASK
      // ----------------------------------------

      return res.status(202).json({

        success:
          true,

        message:
          "Video generation started.",

        taskId:
          task.id,

        status:
          task.status,

      });

    } catch (error) {

      // ========================================
      // RUNWAY ERROR
      // ========================================

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
        "Error name:",
        error?.name
      );

      console.error(
        "Error message:",
        error?.message
      );

      console.error(
        "Error status:",
        error?.status
      );

      console.error(
        "Error code:",
        error?.code
      );

      console.error(
        "Error response:",
        error?.response
      );

      console.error(
        "Error body:",
        error?.body
      );

      console.error(
        "Full error:",
        error
      );

      console.error(
        "================================"
      );

      return res.status(
        error?.status || 500
      ).json({

        success:
          false,

        message:
          "Failed to start video generation.",

        error:
          error?.message ||
          "Unknown Runway API error.",

        status:
          error?.status ||
          500,

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
      // CHECK RUNWAY
      // ----------------------------------------

      if (!runway) {

        return res.status(500).json({
          success: false,

          message:
            "Runway API is not configured.",
        });
      }

      // ----------------------------------------
      // GET TASK ID
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
      // RETRIEVE TASK
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
      // RETURN TASK STATUS
      // ----------------------------------------

      return res.status(200).json({

        success:
          true,

        taskId:
          task.id,

        status:
          task.status,

        output:
          task.output ||
          null,

        failure:
          task.failure ||
          null,

        failureCode:
          task.failureCode ||
          null,

      });

    } catch (error) {

      console.error(
        "Runway task status error:"
      );

      console.error(
        error
      );

      return res.status(500).json({

        success:
          false,

        message:
          "Failed to check video status.",

        error:
          error?.message ||
          String(error),

      });
    }
  }
);

// ============================================
// 404 ROUTE
// MUST BE LAST
// ============================================

app.use(
  (req, res) => {

    console.log(
      "404 ROUTE NOT FOUND:",
      req.method,
      req.originalUrl
    );

    res.status(404).json({

      success:
        false,

      message:
        "Route not found.",

    });
  }
);

// ============================================
// GLOBAL ERROR HANDLER
// ============================================

app.use(
  (error, req, res, next) => {

    console.error(
      "================================"
    );

    console.error(
      "GLOBAL SERVER ERROR"
    );

    console.error(
      "================================"
    );

    console.error(
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    return res.status(
      error.status || 500
    ).json({

      success:
        false,

      message:
        error.message ||
        "Internal server error.",

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
      "================================"
    );

    console.log(
      `Backend server running on port ${PORT}`
    );

    console.log(
      `Health check: http://localhost:${PORT}/api/health`
    );

    console.log(
      "================================"
    );

  }
);