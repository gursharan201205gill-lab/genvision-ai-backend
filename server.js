// ============================================================
// GENVISION AI BACKEND - SERVER.JS
// Express 5 + MongoDB + CORS
// ============================================================

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// ============================================================
// APP INITIALIZATION
// ============================================================

const app = express();

// Render provides PORT automatically
const PORT = process.env.PORT || 5000;

// ============================================================
// CORS CONFIGURATION
// ============================================================

// Add every frontend URL that may access your backend here.
const allowedOrigins = [
  "https://genvision-ai-nu.vercel.app",

  // Add your Vercel frontend URL here if it is different.
  // Example:
  // "https://your-project.vercel.app",

  // Local development
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

// CORS middleware
// ============================================================
// CORS CONFIGURATION
// ============================================================


app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without origin (Postman, server-to-server, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Allow localhost
      if (
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1")
      ) {
        return callback(null, true);
      }

      // Allow every Vercel deployment
      if (origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      // Allow manually listed domains
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("CORS blocked origin:", origin);

      return callback(new Error(`CORS policy blocked this origin: ${origin}`));
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    credentials: false,
  })
);
// ============================================================
// BODY PARSER
// ============================================================

// Base64 images can be large.
// 50MB limit is used to avoid request-size errors.
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

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error(
    "ERROR: MONGODB_URI or MONGO_URI is not defined in .env"
  );
} else {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log("MongoDB connected successfully");
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

    type: {
      type: String,
      default: "text-to-image",
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
  mongoose.models.Image ||
  mongoose.model(
    "Image",
    imageSchema
  );

// ============================================================
// ROOT ROUTE
// ============================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "GenVision AI Backend is running!",
    backend: "Connected",
    mongodb:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
    timestamp:
      new Date().toISOString(),
  });
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/health", (req, res) => {
  res.json({
    success: true,
    backend: "Connected",

    mongodb:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",

    timestamp:
      new Date().toISOString(),
  });
});

// ============================================================
// GET ALL IMAGE HISTORY
// GET /api/images
// ============================================================

app.get(
  "/api/images",
  async (req, res) => {
    try {
      console.log(
        "GET /api/images - Loading image history"
      );

      const images =
        await Image.find()
          .sort({
            createdAt: -1,
          })
          .lean();

      console.log(
        `History loaded: ${images.length} images`
      );

      return res.status(200).json(
        images
      );
    } catch (error) {
      console.error(
        "GET /api/images ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to load image history.",
        details:
          error.message,
      });
    }
  }
);

// ============================================================
// SAVE IMAGE TO MONGODB
// POST /api/images
// ============================================================

app.post(
  "/api/images",
  async (req, res) => {
    try {
      console.log(
        "POST /api/images - Save request received"
      );

      const {
        prompt,
        image,
        type,
      } = req.body;

      console.log(
        "Prompt:",
        prompt
      );

      console.log(
        "Image exists:",
        !!image
      );

      console.log(
        "Image length:",
        image
          ? image.length
          : 0
      );

      console.log(
        "Image type:",
        type
      );

      // Validate prompt
      if (
        !prompt ||
        !prompt.trim()
      ) {
        console.error(
          "SAVE IMAGE ERROR: Prompt missing"
        );

        return res.status(400).json({
          success: false,
          error:
            "Prompt is required.",
        });
      }

      // Validate image
      if (
        !image ||
        typeof image !== "string"
      ) {
        console.error(
          "SAVE IMAGE ERROR: Image missing"
        );

        return res.status(400).json({
          success: false,
          error:
            "Image data is required.",
        });
      }

      // Validate base64 format
      if (
        !image.startsWith(
          "data:image/"
        )
      ) {
        console.error(
          "SAVE IMAGE ERROR: Invalid image format"
        );

        return res.status(400).json({
          success: false,
          error:
            "Invalid image format. Expected base64 image data.",
        });
      }

      // Create MongoDB document
      const newImage =
        new Image({
          prompt:
            prompt.trim(),

          image: image,

          type:
            type ||
            "text-to-image",
        });

      // Save document
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
        "Image size:",
        image.length
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
        "POST /api/images ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Failed to save image.",
        details:
          error.message,
      });
    }
  }
);

// ============================================================
// IMAGE-TO-IMAGE EDIT
// POST /api/images/edit
// ============================================================

app.post(
  "/api/images/edit",
  async (req, res) => {
    try {
      console.log(
        "POST /api/images/edit - Request received"
      );

      const {
        image,
        prompt,
      } = req.body;

      // Validate image
      if (
        !image ||
        typeof image !== "string"
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Image is required.",
        });
      }

      // Validate prompt
      if (
        !prompt ||
        !prompt.trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Transformation prompt is required.",
        });
      }

      console.log(
        "Image-to-image prompt:",
        prompt
      );

      console.log(
        "Input image size:",
        image.length
      );

      // --------------------------------------------------------
      // REPLICATE
      // --------------------------------------------------------

      if (
        !process.env.REPLICATE_API_TOKEN
      ) {
        console.error(
          "REPLICATE_API_TOKEN is missing"
        );

        return res.status(500).json({
          success: false,
          error:
            "Replicate API token is not configured.",
        });
      }

      const Replicate =
        require("replicate");

      const replicate =
        new Replicate({
          auth:
            process.env.REPLICATE_API_TOKEN,
        });

      // --------------------------------------------------------
      // IMAGE EDIT MODEL
      // --------------------------------------------------------

      const output =
        await replicate.run(
          "black-forest-labs/flux-kontext-pro",
          {
            input: {
              prompt:
                prompt.trim(),

              input_image:
                image,
            },
          }
        );

      console.log(
        "Replicate image edit completed"
      );

      // --------------------------------------------------------
      // GET IMAGE URL
      // --------------------------------------------------------

      let generatedImage =
        null;

      if (
        typeof output === "string"
      ) {
        generatedImage =
          output;
      } else if (
        output &&
        output.url
      ) {
        generatedImage =
          output.url();
      } else if (
        output &&
        typeof output.url ===
          "string"
      ) {
        generatedImage =
          output.url;
      } else if (
        Array.isArray(output) &&
        output.length > 0
      ) {
        const first =
          output[0];

        if (
          typeof first ===
          "string"
        ) {
          generatedImage =
            first;
        } else if (
          first &&
          typeof first.url ===
            "function"
        ) {
          generatedImage =
            first.url();
        } else if (
          first &&
          typeof first.url ===
            "string"
        ) {
          generatedImage =
            first.url;
        }
      }

      if (
        !generatedImage
      ) {
        console.error(
          "No generated image URL found:",
          output
        );

        return res.status(500).json({
          success: false,
          error:
            "No generated image was returned.",
        });
      }

      console.log(
        "Generated image URL:",
        generatedImage
      );

      // --------------------------------------------------------
      // DOWNLOAD GENERATED IMAGE
      // --------------------------------------------------------

      const axios =
        require("axios");

      const imageResponse =
        await axios.get(
          generatedImage,
          {
            responseType:
              "arraybuffer",
          }
        );

      const contentType =
        imageResponse.headers[
          "content-type"
        ] ||
        "image/png";

      const base64 =
        Buffer.from(
          imageResponse.data
        ).toString(
          "base64"
        );

      const finalImage =
        `data:${contentType};base64,${base64}`;

      console.log(
        "Final image size:",
        finalImage.length
      );

      // --------------------------------------------------------
      // SAVE EDITED IMAGE TO MONGODB
      // --------------------------------------------------------

      const savedImage =
        await Image.create({
          prompt:
            prompt.trim(),

          image:
            finalImage,

          type:
            "image-to-image",
        });

      console.log(
        "Image-to-image saved successfully:",
        savedImage._id
      );

      // --------------------------------------------------------
      // RETURN RESULT
      // --------------------------------------------------------

      return res.status(200).json({
        success: true,

        image:
          finalImage,

        id:
          savedImage._id,

        message:
          "Image transformed and saved successfully.",
      });
    } catch (error) {
      console.error(
        "IMAGE-TO-IMAGE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Image transformation failed.",
      });
    }
  }
);

// ============================================================
// DELETE IMAGE
// DELETE /api/images/:id
// ============================================================

app.delete(
  "/api/images/:id",
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      console.log(
        "DELETE /api/images/:id",
        id
      );

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid image ID.",
        });
      }

      const deletedImage =
        await Image.findByIdAndDelete(
          id
        );

      if (
        !deletedImage
      ) {
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
        details:
          error.message,
      });
    }
  }
);

// ============================================================
// EXPRESS 5 ERROR HANDLER
// ============================================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      "SERVER ERROR:",
      err
    );

    // CORS error
    if (
      err.message &&
      err.message.startsWith(
        "CORS policy blocked"
      )
    ) {
      return res.status(403).json({
        success: false,
        error:
          err.message,
      });
    }

    return res.status(500).json({
      success: false,
      error:
        err.message ||
        "Internal server error.",
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  () => {
    console.log(
      "================================================"
    );

    console.log(
      `GenVision AI Backend running on port ${PORT}`
    );

    console.log(
      `Environment: ${
        process.env.NODE_ENV ||
        "development"
      }`
    );

    console.log(
      "CORS allowed origins:"
    );

    allowedOrigins.forEach(
      (origin) => {
        console.log(
          ` - ${origin}`
        );
      }
    );

    console.log(
      "================================================"
    );
  }
);