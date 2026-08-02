require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ============================================================
// CONFIGURATION
// ============================================================

const PORT = process.env.PORT || 5000;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://genvision-ai-nu.vercel.app";

const MONGO_URI =
  process.env.MONGO_URI;

const REPLICATE_API_TOKEN =
  process.env.REPLICATE_API_TOKEN;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
  cors({
    origin: "*",
    methods: [
      "GET",
      "POST",
      "DELETE",
      "PUT",
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
    limit: "30mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "30mb",
  })
);

// ============================================================
// STARTUP CONFIGURATION LOGS
// ============================================================

console.log(
  "============================================"
);

console.log(
  "GENVISION AI BACKEND STARTING"
);

console.log(
  "MongoDB configured:",
  Boolean(MONGO_URI)
);

console.log(
  "Replicate configured:",
  Boolean(REPLICATE_API_TOKEN)
);

console.log(
  "Frontend URL:",
  FRONTEND_URL
);

console.log(
  "============================================"
);

// ============================================================
// MONGODB CONNECTION
// ============================================================

if (!MONGO_URI) {
  console.error(
    "ERROR: MONGO_URI is not configured."
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

// ============================================================
// IMAGE SCHEMA
// ============================================================

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

      type: {
        type: String,
        default: "text-to-image",
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

// ============================================================
// IMAGE MODEL
// ============================================================

const Image =
  mongoose.model(
    "Image",
    imageSchema
  );

// ============================================================
// ROOT ROUTE
// ============================================================

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

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
  "/api/health",
  (req, res) => {
    res.status(200).json({
      success: true,

      message:
        "Backend is healthy",

      mongodb:
        mongoose.connection.readyState === 1,

      replicate:
        Boolean(
          REPLICATE_API_TOKEN
        ),
    });
  }
);

// ============================================================
// GET IMAGE HISTORY
// ============================================================

app.get(
  "/api/images",
  async (req, res) => {
    try {
      const images =
        await Image
          .find()
          .sort({
            createdAt: -1,
          });

      res.status(200).json(
        images
      );

    } catch (error) {
      console.error(
        "GET IMAGE HISTORY ERROR:",
        error
      );

      res.status(500).json({
        success: false,

        error:
          "Failed to load image history.",
      });
    }
  }
);

// ============================================================
// SAVE IMAGE TO HISTORY
// ============================================================

app.post(
  "/api/images",
  async (req, res) => {
    try {
      const {
        prompt,
        image,
        type,
      } = req.body;

      // ------------------------------------------
      // VALIDATE PROMPT
      // ------------------------------------------

      if (
        !prompt ||
        !prompt.trim()
      ) {
        return res.status(400).json({
          success: false,

          error:
            "Prompt is required.",
        });
      }

      // ------------------------------------------
      // VALIDATE IMAGE
      // ------------------------------------------

      if (
        !image ||
        typeof image !== "string"
      ) {
        return res.status(400).json({
          success: false,

          error:
            "Image data is required.",
        });
      }

      // ------------------------------------------
      // CHECK MONGODB
      // ------------------------------------------

      if (
        mongoose.connection.readyState !==
        1
      ) {
        return res.status(503).json({
          success: false,

          error:
            "MongoDB is not connected.",
        });
      }

      // ------------------------------------------
      // SAVE IMAGE
      // ------------------------------------------

      const newImage =
        await Image.create({
          prompt:
            prompt.trim(),

          image,

          type:
            type ||
            "text-to-image",
        });

      console.log(
        "Image saved to MongoDB:",
        newImage._id
      );

      return res.status(201).json({
        success: true,

        message:
          "Image saved successfully.",

        image:
          newImage,
      });

    } catch (error) {
      console.error(
        "SAVE IMAGE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        error:
          "Failed to save image.",
      });
    }
  }
);

// ============================================================
// DELETE IMAGE FROM HISTORY
// ============================================================

app.delete(
  "/api/images/:id",
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      const deletedImage =
        await Image.findByIdAndDelete(
          id
        );

      if (!deletedImage) {
        return res.status(404).json({
          success: false,

          error:
            "Image not found.",
        });
      }

      console.log(
        "Image deleted:",
        id
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

        error:
          "Failed to delete image.",
      });
    }
  }
);

// ============================================================
// IMAGE-TO-IMAGE GENERATION
//
// FRONTEND SENDS:
//
// {
//   image: "data:image/png;base64,...",
//   prompt: "Transform this image..."
// }
//
// FLOW:
//
// App.jsx
//    ↓
// POST /api/images/edit
//    ↓
// Replicate
//    ↓
// Generated image
//    ↓
// MongoDB
//    ↓
// App.jsx
// ============================================================

app.post(
  "/api/images/edit",
  async (req, res) => {
    try {
      console.log(
        "============================================"
      );

      console.log(
        "IMAGE-TO-IMAGE REQUEST RECEIVED"
      );

      // ------------------------------------------
      // GET REQUEST DATA
      // ------------------------------------------

      const {
        image,
        prompt,
      } = req.body;

      // ------------------------------------------
      // VALIDATE IMAGE
      // ------------------------------------------

      if (
        !image ||
        typeof image !== "string"
      ) {
        return res.status(400).json({
          success: false,

          error:
            "Input image is required.",
        });
      }

      // ------------------------------------------
      // VALIDATE PROMPT
      // ------------------------------------------

      if (
        !prompt ||
        typeof prompt !== "string" ||
        !prompt.trim()
      ) {
        return res.status(400).json({
          success: false,

          error:
            "Modification prompt is required.",
        });
      }

      // ------------------------------------------
      // CHECK REPLICATE TOKEN
      // ------------------------------------------

      if (
        !REPLICATE_API_TOKEN
      ) {
        console.error(
          "REPLICATE_API_TOKEN is missing."
        );

        return res.status(500).json({
          success: false,

          error:
            "Replicate is not configured. Add REPLICATE_API_TOKEN to Render environment variables.",
        });
      }

      console.log(
        "Replicate configured: YES"
      );

      console.log(
        "Image-to-image prompt:",
        prompt.trim()
      );

      // ------------------------------------------
      // REPLICATE MODEL
      // ------------------------------------------

      const model =
        "black-forest-labs/flux-kontext-pro";

      const replicateUrl =
        `https://api.replicate.com/v1/models/${model}/predictions`;

      console.log(
        "Calling Replicate model:",
        model
      );

      // ------------------------------------------
      // CREATE REPLICATE PREDICTION
      // ------------------------------------------

      const predictionResponse =
        await fetch(
          replicateUrl,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${REPLICATE_API_TOKEN}`,

              "Content-Type":
                "application/json",

              Prefer:
                "wait",
            },

            body:
              JSON.stringify({
                input: {
                  prompt:
                    prompt.trim(),

                  input_image:
                    image,
                },
              }),
          }
        );

      const prediction =
        await predictionResponse.json();

      console.log(
        "Replicate HTTP status:",
        predictionResponse.status
      );

      console.log(
        "Replicate prediction status:",
        prediction.status
      );

      // ------------------------------------------
      // HANDLE REPLICATE ERROR
      // ------------------------------------------

      if (
        !predictionResponse.ok
      ) {
        console.error(
          "REPLICATE API ERROR:",
          prediction
        );

        return res.status(
          predictionResponse.status
        ).json({
          success: false,

          error:
            prediction.detail ||
            prediction.error ||
            "Replicate image generation failed.",

          details:
            prediction,
        });
      }

      // ------------------------------------------
      // WAIT FOR PREDICTION IF NEEDED
      // ------------------------------------------

      let result =
        prediction;

      let attempts = 0;

      const maxAttempts =
        60;

      while (
        result.status !==
          "succeeded" &&
        result.status !==
          "failed" &&
        result.status !==
          "canceled" &&
        attempts <
          maxAttempts
      ) {
        console.log(
          `Waiting for Replicate... Attempt ${attempts + 1}`
        );

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              2000
            )
        );

        attempts++;

        if (
          !result.urls ||
          !result.urls.get
        ) {
          break;
        }

        const statusResponse =
          await fetch(
            result.urls.get,
            {
              headers: {
                Authorization:
                  `Bearer ${REPLICATE_API_TOKEN}`,
              },
            }
          );

        result =
          await statusResponse.json();

        console.log(
          "Current Replicate status:",
          result.status
        );
      }

      // ------------------------------------------
      // CHECK FINAL STATUS
      // ------------------------------------------

      if (
        result.status !==
        "succeeded"
      ) {
        console.error(
          "REPLICATE GENERATION FAILED:",
          result
        );

        return res.status(500).json({
          success: false,

          error:
            result.error ||
            "Image-to-image generation failed.",

          status:
            result.status,
        });
      }

      // ------------------------------------------
      // GET OUTPUT
      // ------------------------------------------

      let outputUrl =
        result.output;

      if (
        Array.isArray(
          outputUrl
        )
      ) {
        outputUrl =
          outputUrl[0];
      }

      if (
        !outputUrl
      ) {
        console.error(
          "Replicate returned no output:",
          result
        );

        return res.status(500).json({
          success: false,

          error:
            "Replicate returned no generated image.",
        });
      }

      console.log(
        "Generated image URL:",
        outputUrl
      );

      // ------------------------------------------
      // DOWNLOAD OUTPUT IMAGE
      // ------------------------------------------

      const imageResponse =
        await fetch(
          outputUrl
        );

      if (
        !imageResponse.ok
      ) {
        throw new Error(
          "Could not download generated image from Replicate."
        );
      }

      const imageBuffer =
        Buffer.from(
          await imageResponse.arrayBuffer()
        );

      if (
        imageBuffer.length === 0
      ) {
        throw new Error(
          "Generated image is empty."
        );
      }

      console.log(
        "Generated image size:",
        imageBuffer.length,
        "bytes"
      );

      // ------------------------------------------
      // CONVERT TO BASE64
      // ------------------------------------------

      const base64Image =
        `data:image/png;base64,${imageBuffer.toString(
          "base64"
        )}`;

      // ------------------------------------------
      // SAVE TO MONGODB
      // ------------------------------------------

      const savedImage =
        await Image.create({
          prompt:
            prompt.trim(),

          image:
            base64Image,

          type:
            "image-to-image",
        });

      console.log(
        "Image-to-image saved to MongoDB:",
        savedImage._id
      );

      // ------------------------------------------
      // RETURN RESULT
      // ------------------------------------------

      return res.status(200).json({
        success: true,

        message:
          "Image transformed successfully.",

        image:
          base64Image,

        id:
          savedImage._id,

        type:
          "image-to-image",
      });

    } catch (error) {
      console.error(
        "============================================"
      );

      console.error(
        "IMAGE-TO-IMAGE ERROR"
      );

      console.error(
        "Error name:",
        error.name
      );

      console.error(
        "Error message:",
        error.message
      );

      console.error(
        "Full error:",
        error
      );

      console.error(
        "============================================"
      );

      return res.status(500).json({
        success: false,

        error:
          error.message ||
          "Image-to-image generation failed.",
      });
    }
  }
);

// ============================================================
// 404 ROUTE
// ============================================================

app.use(
  (req, res) => {
    res.status(404).json({
      success: false,

      error:
        "Route not found.",
    });
  }
);

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "GLOBAL SERVER ERROR:",
      error
    );

    res.status(500).json({
      success: false,

      error:
        "Internal server error.",
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `GenVision AI Backend running on port ${PORT}`
    );
  }
);