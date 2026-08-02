require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ============================================================
// CONFIGURATION
// ============================================================

const PORT = process.env.PORT || 5000;

const MONGO_URI = process.env.MONGO_URI;

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

// Base64 images can be large
app.use(
  express.json({
    limit: "50mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
  })
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

      if (!image) {
        return res.status(400).json({
          success: false,

          error:
            "Image data is required.",
        });
      }

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

      res.status(201).json({
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

      res.status(500).json({
        success: false,

        error:
          "Failed to save image.",
      });
    }
  }
);

// ============================================================
// DELETE IMAGE
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

      res.status(200).json({
        success: true,

        message:
          "Image deleted successfully.",
      });

    } catch (error) {
      console.error(
        "DELETE IMAGE ERROR:",
        error
      );

      res.status(500).json({
        success: false,

        error:
          "Failed to delete image.",
      });
    }
  }
);

// ============================================================
// IMAGE-TO-IMAGE GENERATION
// REPLICATE
// ============================================================

app.post(
  "/api/images/edit",
  async (req, res) => {
    try {
      console.log(
        "===================================="
      );

      console.log(
        "IMAGE-TO-IMAGE REQUEST RECEIVED"
      );

      console.log(
        "===================================="
      );

      // ------------------------------------------------------
      // GET REQUEST DATA
      // ------------------------------------------------------

      const {
        image,
        prompt,
      } = req.body;

      // ------------------------------------------------------
      // VALIDATE IMAGE
      // ------------------------------------------------------

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

      // ------------------------------------------------------
      // VALIDATE PROMPT
      // ------------------------------------------------------

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

      // ------------------------------------------------------
      // CHECK REPLICATE TOKEN
      // ------------------------------------------------------

      if (
        !REPLICATE_API_TOKEN
      ) {
        return res.status(500).json({
          success: false,

          error:
            "REPLICATE_API_TOKEN is not configured.",
        });
      }

      console.log(
        "Replicate configured: TRUE"
      );

      console.log(
        "Prompt:",
        prompt.trim()
      );

      console.log(
        "Input image received."
      );

      // ------------------------------------------------------
      // CALL REPLICATE
      // ------------------------------------------------------

      const replicateResponse =
        await fetch(
          "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions",
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

      const replicateData =
        await replicateResponse.json();

      console.log(
        "Replicate HTTP status:",
        replicateResponse.status
      );

      console.log(
        "Replicate response:",
        replicateData
      );

      // ------------------------------------------------------
      // HANDLE REPLICATE ERROR
      // ------------------------------------------------------

      if (
        !replicateResponse.ok
      ) {
        return res.status(
          replicateResponse.status
        ).json({
          success: false,

          error:
            replicateData.detail ||
            replicateData.error ||
            "Replicate image generation failed.",

          replicateResponse:
            replicateData,
        });
      }

      // ------------------------------------------------------
      // GET OUTPUT
      // ------------------------------------------------------

      let output =
        replicateData.output;

      // If output is an array
      if (
        Array.isArray(output)
      ) {
        output =
          output[0];
      }

      // ------------------------------------------------------
      // IF OUTPUT NOT AVAILABLE
      // POLL PREDICTION
      // ------------------------------------------------------

      if (
        !output &&
        replicateData.urls &&
        replicateData.urls.get
      ) {
        console.log(
          "Prediction still running. Starting polling..."
        );

        let prediction =
          replicateData;

        let attempts = 0;

        const maxAttempts =
          60;

        while (
          prediction.status !==
            "succeeded" &&
          prediction.status !==
            "failed" &&
          prediction.status !==
            "canceled" &&
          attempts <
            maxAttempts
        ) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                2000
              )
          );

          attempts++;

          console.log(
            "Polling attempt:",
            attempts
          );

          const statusResponse =
            await fetch(
              prediction.urls.get,
              {
                headers: {
                  Authorization:
                    `Bearer ${REPLICATE_API_TOKEN}`,
                },
              }
            );

          prediction =
            await statusResponse.json();

          console.log(
            "Prediction status:",
            prediction.status
          );
        }

        if (
          prediction.status !==
          "succeeded"
        ) {
          console.error(
            "Replicate prediction failed:",
            prediction
          );

          return res.status(500).json({
            success: false,

            error:
              prediction.error ||
              "Image-to-image generation failed.",
          });
        }

        output =
          prediction.output;

        if (
          Array.isArray(output)
        ) {
          output =
            output[0];
        }
      }

      // ------------------------------------------------------
      // CHECK OUTPUT
      // ------------------------------------------------------

      if (!output) {
        console.error(
          "No output from Replicate."
        );

        return res.status(500).json({
          success: false,

          error:
            "Replicate returned no generated image.",
        });
      }

      console.log(
        "Generated image URL:",
        output
      );

      // ------------------------------------------------------
      // DOWNLOAD GENERATED IMAGE
      // ------------------------------------------------------

      const generatedImageResponse =
        await fetch(
          output
        );

      if (
        !generatedImageResponse.ok
      ) {
        throw new Error(
          "Could not download generated image from Replicate."
        );
      }

      const imageBuffer =
        Buffer.from(
          await generatedImageResponse.arrayBuffer()
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
        imageBuffer.length
      );

      // ------------------------------------------------------
      // CONVERT TO BASE64
      // ------------------------------------------------------

      const base64Image =
        `data:image/png;base64,${imageBuffer.toString(
          "base64"
        )}`;

      // ------------------------------------------------------
      // SAVE TO MONGODB
      // ------------------------------------------------------

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

      // ------------------------------------------------------
      // RETURN RESULT
      // ------------------------------------------------------

      return res.status(200).json({
        success: true,

        message:
          "Image transformed and saved successfully.",

        image:
          base64Image,

        id:
          savedImage._id,

        type:
          "image-to-image",
      });

    } catch (error) {
      console.error(
        "===================================="
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
        "===================================="
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
// START SERVER
// ============================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `GenVision AI Backend running on port ${PORT}`
    );

    console.log(
      "Replicate configured:",
      Boolean(
        REPLICATE_API_TOKEN
      )
    );
  }
);