// ============================================================
// GENVISION AI BACKEND
// TEXT-TO-IMAGE HISTORY + IMAGE-TO-IMAGE WITH REPLICATE
// ============================================================

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// ============================================================
// APP
// ============================================================

const app = express();

// ============================================================
// CONFIGURATION
// ============================================================

const PORT = process.env.PORT || 5000;

const MONGO_URI = process.env.MONGO_URI;

const REPLICATE_API_TOKEN =
  process.env.REPLICATE_API_TOKEN;

console.log(
  "Mongo URI exists:",
  Boolean(MONGO_URI)
);

console.log(
  "Replicate token exists:",
  Boolean(REPLICATE_API_TOKEN)
);

// ============================================================
// CORS
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

// ============================================================
// BODY PARSERS
// IMPORTANT FOR LARGE BASE64 IMAGES
// ============================================================

app.use(
  express.json({
    limit: "100mb",

    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "100mb",
  })
);

// ============================================================
// REQUEST ABORT HANDLING
// ============================================================

app.use((req, res, next) => {
  req.on("aborted", () => {
    console.error(
      "REQUEST ABORTED:",
      req.method,
      req.originalUrl
    );
  });

  req.on("error", (error) => {
    console.error(
      "REQUEST ERROR:",
      error
    );
  });

  next();
});

// ============================================================
// MONGODB CONNECTION
// ============================================================

if (!MONGO_URI) {
  console.error(
    "ERROR: MONGO_URI is not configured."
  );
} else {
  mongoose
    .connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
    })
    .then(() => {
      console.log(
        "MongoDB connected successfully."
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

      backend:
        "Connected",

      mongodb:
        mongoose.connection.readyState === 1
          ? "Connected"
          : "Disconnected",

      replicate:
        REPLICATE_API_TOKEN
          ? "Configured"
          : "Not configured",
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
      console.log(
        "Fetching image history..."
      );

      const images =
        await Image
          .find()
          .sort({
            createdAt: -1,
          });

      console.log(
        `Found ${images.length} images.`
      );

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
      console.log(
        "Saving image to MongoDB..."
      );

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
        typeof prompt !== "string" ||
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
        mongoose.connection.readyState !== 1
      ) {
        return res.status(503).json({
          success: false,

          error:
            "MongoDB is not connected.",
        });
      }

      // ------------------------------------------
      // CREATE IMAGE
      // ------------------------------------------

      const newImage =
        await Image.create({
          prompt:
            prompt.trim(),

          image:
            image,

          type:
            type ||
            "text-to-image",
        });

      console.log(
        "Image saved successfully:",
        newImage._id
      );

      // ------------------------------------------
      // RETURN RESPONSE
      // ------------------------------------------

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
          error.message ||
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
// IMAGE-TO-IMAGE WITH REPLICATE
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

      // ------------------------------------------
      // CHECK REPLICATE TOKEN
      // ------------------------------------------

      if (!REPLICATE_API_TOKEN) {
        return res.status(500).json({
          success: false,

          error:
            "Replicate is not configured. Please add REPLICATE_API_TOKEN to Render.",
        });
      }

      // ------------------------------------------
      // GET REQUEST BODY
      // ------------------------------------------

      const {
        image,
        prompt,
      } = req.body;

      console.log(
        "Prompt received:",
        prompt
      );

      console.log(
        "Image received:",
        Boolean(image)
      );

      if (image) {
        console.log(
          "Image data length:",
          image.length
        );
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
      // CHECK IMAGE SIZE
      // ------------------------------------------

      if (
        image.length >
        90 * 1024 * 1024
      ) {
        return res.status(413).json({
          success: false,

          error:
            "Image is too large. Please upload a smaller image.",
        });
      }

      console.log(
        "Starting Replicate image-to-image..."
      );

      // ------------------------------------------
      // REPLICATE MODEL
      // ------------------------------------------

      const model =
        "black-forest-labs/flux-kontext-pro";

      // ------------------------------------------
      // CREATE REPLICATE PREDICTION
      // ------------------------------------------

      const predictionResponse =
        await fetch(
          `https://api.replicate.com/v1/models/${model}/predictions`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${REPLICATE_API_TOKEN}`,

              "Content-Type":
                "application/json",
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
        "Replicate prediction response:",
        prediction
      );

      // ------------------------------------------
      // HANDLE REPLICATE ERROR
      // ------------------------------------------

      if (
        !predictionResponse.ok
      ) {
        return res.status(
          predictionResponse.status
        ).json({
          success: false,

          error:
            prediction.detail ||
            prediction.error ||
            "Replicate image generation failed.",
        });
      }

      // ------------------------------------------
      // POLL PREDICTION
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
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              2000
            )
        );

        attempts++;

        console.log(
          `Checking Replicate status... Attempt ${attempts}`
        );

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
          "Replicate status:",
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
          "Replicate generation failed:",
          result
        );

        return res.status(500).json({
          success: false,

          error:
            result.error ||
            "Image-to-image generation failed.",
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
        return res.status(500).json({
          success: false,

          error:
            "Replicate returned no output image.",
        });
      }

      console.log(
        "Replicate output URL:",
        outputUrl
      );

      // ------------------------------------------
      // DOWNLOAD OUTPUT
      // ------------------------------------------

      const imageResponse =
        await fetch(
          outputUrl
        );

      if (
        !imageResponse.ok
      ) {
        throw new Error(
          "Could not download generated image."
        );
      }

      const imageBuffer =
        Buffer.from(
          await imageResponse.arrayBuffer()
        );

      console.log(
        "Generated image size:",
        imageBuffer.length
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
        "Edited image saved to MongoDB:",
        savedImage._id
      );

      // ------------------------------------------
      // RETURN RESPONSE
      // ------------------------------------------

      return res.status(200).json({
        success: true,

        message:
          "Image transformed and saved successfully.",

        image:
          base64Image,

        id:
          savedImage._id,
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

    if (
      error.type ===
      "entity.too.large"
    ) {
      return res.status(413).json({
        success: false,

        error:
          "Request is too large. Please upload a smaller image.",
      });
    }

    if (
      error.type ===
      "request.aborted"
    ) {
      return res.status(400).json({
        success: false,

        error:
          "Request was aborted. Please try again with a smaller image.",
      });
    }

    return res.status(500).json({
      success: false,

      error:
        error.message ||
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