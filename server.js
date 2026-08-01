// ============================================
// GENVISION AI - BACKEND SERVER
// IMAGE HISTORY + FAL.AI TEXT TO VIDEO
// ============================================

require("dotenv").config();

const dns = require("dns");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { fal } = require("@fal-ai/client");

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
const FAL_KEY = process.env.FAL_KEY;

console.log("================================");
console.log("GENVISION AI BACKEND STARTING");
console.log("================================");

console.log(
  "Mongo URI exists:",
  Boolean(MONGO_URI)
);

console.log(
  "FAL API key exists:",
  Boolean(FAL_KEY)
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
// REQUEST LOGGER
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
// FAL.AI CONFIGURATION
// ============================================

if (FAL_KEY) {
  fal.config({
    credentials: FAL_KEY,
  });

  console.log(
    "fal.ai client initialized successfully"
  );
} else {
  console.error(
    "WARNING: FAL_KEY is missing."
  );
}

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

      console.error(
        error
      );

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

      success:
        true,

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

      success:
        true,

      server:
        "Backend is running",

      mongodb:
        mongoose.connection.readyState === 1
          ? "Connected"
          : "Disconnected",

      fal:
        FAL_KEY
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

          success:
            false,

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

          success:
            false,

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

          success:
            false,

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

      // ----------------------------------------
      // RETURN RESPONSE
      // ----------------------------------------

      return res.status(201).json({

        success:
          true,

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

        success:
          false,

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

          success:
            false,

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

        success:
          false,

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

          success:
            false,

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

        success:
          false,

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

          success:
            false,

          message:
            "Image not found.",

        });

      }

      console.log(
        "Image deleted:",
        req.params.id
      );

      return res.status(200).json({

        success:
          true,

        message:
          "Image deleted successfully.",

      });

    } catch (error) {

      console.error(
        "Error deleting image:",
        error
      );

      return res.status(500).json({

        success:
          false,

        message:
          "Failed to delete image.",

        error:
          error.message,

      });

    }

  }
);

// ============================================
// FAL.AI TEXT TO VIDEO
// ============================================

app.post(
  "/api/videos/generate",
  async (req, res) => {

    console.log(
      "================================"
    );

    console.log(
      "FAL TEXT-TO-VIDEO REQUEST RECEIVED"
    );

    console.log(
      "================================"
    );

    try {

      // ----------------------------------------
      // CHECK FAL KEY
      // ----------------------------------------

      if (!FAL_KEY) {

        console.error(
          "FAL_KEY is missing."
        );

        return res.status(500).json({

          success:
            false,

          message:
            "FAL_KEY is missing from environment variables.",

        });

      }

      // ----------------------------------------
      // GET REQUEST BODY
      // ----------------------------------------

      console.log(
        "Request body:",
        req.body
      );

      const {
        prompt,
      } = req.body;

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

          success:
            false,

          message:
            "A valid video prompt is required.",

        });

      }

      // ----------------------------------------
      // VALIDATE PROMPT LENGTH
      // ----------------------------------------

      if (
        prompt.trim().length > 1000
      ) {

        return res.status(400).json({

          success:
            false,

          message:
            "Video prompt must be 1000 characters or less.",

        });

      }

      console.log(
        "Video prompt:",
        prompt.trim()
      );

      // ----------------------------------------
      // CALL FAL.AI
      // ----------------------------------------

      console.log(
        "Sending request to fal.ai..."
      );

      const result =
        await fal.subscribe(
          "fal-ai/kling-video/v3/turbo/standard/text-to-video",
          {

            input: {

              prompt:
                prompt.trim(),

            },

            logs:
              true,

            onQueueUpdate:
              (update) => {

                console.log(
                  "fal.ai queue status:",
                  update.status
                );

                if (
                  update.status ===
                  "IN_PROGRESS"
                ) {

                  if (
                    update.logs
                  ) {

                    update.logs
                      .map(
                        (log) =>
                          log.message
                      )
                      .forEach(
                        (message) => {

                          console.log(
                            "fal.ai:",
                            message
                          );

                        }
                      );

                  }

                }

              },

          }
        );

      // ----------------------------------------
      // PRINT RESULT
      // ----------------------------------------

      console.log(
        "fal.ai generation completed."
      );

      console.log(
        "fal.ai result:",
        JSON.stringify(
          result.data,
          null,
          2
        )
      );

      // ----------------------------------------
      // GET VIDEO URL
      // ----------------------------------------

      const videoUrl =
        result.data?.video?.url ||
        result.data?.video_url ||
        null;

      // ----------------------------------------
      // CHECK VIDEO URL
      // ----------------------------------------

      if (!videoUrl) {

        console.error(
          "No video URL returned by fal.ai."
        );

        return res.status(500).json({

          success:
            false,

          message:
            "Video generation completed but no video URL was returned.",

          data:
            result.data ||
            null,

        });

      }

      // ----------------------------------------
      // SUCCESS
      // ----------------------------------------

      console.log(
        "================================"
      );

      console.log(
        "VIDEO GENERATED SUCCESSFULLY"
      );

      console.log(
        "Video URL:",
        videoUrl
      );

      console.log(
        "================================"
      );

      // ----------------------------------------
      // RETURN VIDEO
      // ----------------------------------------

      return res.status(200).json({

        success:
          true,

        message:
          "Video generated successfully.",

        videoUrl:
          videoUrl,

        requestId:
          result.requestId ||
          null,

      });

    } catch (error) {

      // ----------------------------------------
      // ERROR LOGGING
      // ----------------------------------------

      console.error(
        "================================"
      );

      console.error(
        "FAL TEXT-TO-VIDEO ERROR"
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
          "Failed to generate video.",

        error:
          error?.message ||
          String(error),

      });

    }

  }
);

// ============================================
// 404 ROUTE
// ============================================

app.use(
  (req, res) => {

    console.log(
      "404 ROUTE NOT FOUND:",
      req.method,
      req.originalUrl
    );

    return res.status(404).json({

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
  (
    error,
    req,
    res,
    next
  ) => {

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

    if (
      res.headersSent
    ) {

      return next(
        error
      );

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