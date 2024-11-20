import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import cloudinary from "cloudinary";

dotenv.config();

const app = express();

// Middleware for parsing JSON and enabling CORS
app.use(express.json());
app.use(cors());

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Multer configuration for handling file uploads (in-memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Define the Movie schema
const movieSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  imageUrl: { type: String, required: true },
  genre: { type: String, required: true },
  rating: { type: Number, min: 0, max: 10, required: true },
  releaseDate: { type: Date, required: true },
});

// Create the Movie model
const Movie = mongoose.model("Movie", movieSchema);

// API endpoint to add a new movie with image upload
app.post("/api/movies", upload.single("image"), async (req, res) => {
  console.log("File received:", req.file); // Log the received file
  console.log("Body data:", req.body); // Log the other form data (e.g., title, description)

  try {
    // Check if an image file is uploaded
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    console.log("Uploading file to Cloudinary...");

    // Upload the image to Cloudinary and get the result
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        { resource_type: "image" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer); // Stream the file buffer to Cloudinary
    });

    console.log("Cloudinary upload result:", result);

    // Now save the movie details, using the Cloudinary URL
    const newMovie = new Movie({
      title: req.body.title,
      description: req.body.description,
      imageUrl: result.secure_url, // Use the Cloudinary image URL
      genre: req.body.genre,
      rating: req.body.rating,
      releaseDate: req.body.releaseDate,
    });

    // Save the movie document to the database
    const savedMovie = await newMovie.save();
    res.status(201).json(savedMovie);
  } catch (err) {
    console.error("Error details:", err);
    res.status(500).json({ message: "Error uploading image", error: err.message });
  }
});

// Get all movies
app.get("/api/movies", async (req, res) => {
  try {
    const movies = await Movie.find();
    res.status(200).json(movies);
  } catch (err) {
    res.status(500).json({ message: "Error fetching movies", err });
  }
});

// Get a single movie by ID
app.get("/api/movies/:id", async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ message: "Movie not found" });
    res.status(200).json(movie);
  } catch (err) {
    res.status(500).json({ message: "Error fetching movie", err });
  }
});

// Update a movie by ID
app.put("/api/movies/:id", upload.single("image"), async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    // Handle image upload if provided
    let imageUrl = movie.imageUrl; // Keep the existing imageUrl if no new file is uploaded
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.v2.uploader.upload_stream(
          { resource_type: "image" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer); // Stream the file buffer
      });
      imageUrl = result.secure_url;
    }

    // Update the movie details
    const updatedMovie = await Movie.findByIdAndUpdate(
      req.params.id,
      {
        title: req.body.title || movie.title,
        description: req.body.description || movie.description,
        imageUrl: imageUrl,
        genre: req.body.genre || movie.genre,
        rating: req.body.rating || movie.rating,
        releaseDate: req.body.releaseDate || movie.releaseDate,
      },
      { new: true }
    );

    res.status(200).json(updatedMovie);
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Error updating movie", error: err.message });
  }
});


// Delete a movie by ID
app.delete("/api/movies/:id", async (req, res) => {
  try {
    const deletedMovie = await Movie.findByIdAndDelete(req.params.id);
    if (!deletedMovie)
      return res.status(404).json({ message: "Movie not found" });
    res.status(200).json({ message: "Movie deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting movie", err });
  }
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
