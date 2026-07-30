// ============================================
// GENVISION AI - BACKEND SERVER
// ============================================

// Fix MongoDB SRV DNS resolution
const dns = require("dns");

dns.setServers([
  "8.8.8.8",
  "8.8.4.4",
]);


// Load environment variables
require("dotenv").config();


// Import packages
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");


// Create Express app
const app = express();


// Port
const PORT = process.env.PORT || 5000;


// ============================================
// MIDDLEWARE
// ============================================

// Allow requests from frontend
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
    ],
  })
);


// Parse JSON requests
// 50 MB limit because Base64 images can be large
app.use(
  express.json({
    limit: "50mb",
  })
);


// ============================================
// MONGODB CONNECTION
// ============================================

console.log(
  "Mongo URI exists:",
  Boolean(process.env.MONGO_URI)
);


if (!process.env.MONGO_URI) {

  console.error(
    "ERROR: MONGO_URI is missing."
  );

} else {

  mongoose
    .connect(
      process.env.MONGO_URI
    )
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


      // Create new image document

      const newImage =
        new Image({

          prompt:
            prompt.trim(),

          image:
            image,

        });


      // Save to MongoDB

      const savedImage =
        await newImage.save();


      console.log(
        "Image saved successfully:",
        savedImage._id
      );


      // Send response

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
// GET ALL IMAGES
// ============================================

app.get(
  "/api/images",
  async (req, res) => {

    try {

      console.log(
        "Fetching image history"
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


      // Find all images

      const images =
        await Image
          .find()
          .sort({
            createdAt: -1,
          });


      console.log(
        `Found ${images.length} images`
      );


      return res.status(200).json(

        images

      );


    } catch (error) {

      console.error(
        "Error fetching images:",
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