const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs-extra'); // For ensuring directory exists and cleaning up
const { extractFeatures, calculateSimilarity } = require('./feature_extractor');
const { pool } = require('./database');
const { UPLOAD_DIR, PUBLIC_DIR } = require('./config');

const app = express();
const port = 3000;

// Middleware for parsing JSON bodies (if you need to send JSON to server besides form-data)
app.use(express.json());
// Middleware for parsing URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Ensure upload directory exists
fs.ensureDirSync(UPLOAD_DIR);

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    cb(null, Date.now() + '-' + file.originalname); // More unique filename
  }
});
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb('Error: File upload only supports the following filetypes - ' + allowedTypes);
  }
});

// Phục vụ các file tĩnh từ thư mục public
app.use(express.static(PUBLIC_DIR));

// Route mặc định trả về file index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// API endpoint for image search
app.post('/api/search', upload.single('queryImage'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }

  const queryImagePath = req.file.path;
  let connection;

  try {
    console.log(`Processing uploaded image: ${queryImagePath}`);
    const queryFeaturesData = await extractFeatures(queryImagePath);

    if (!queryFeaturesData || !queryFeaturesData.combined_vector) {
      // Clean up uploaded file
      await fs.remove(queryImagePath);
      return res.status(500).json({ error: 'Could not extract features from uploaded image.' });
    }
    const queryFeatureVector = queryFeaturesData.combined_vector;
    console.log('Query Image Path:', queryImagePath);
    console.log('Query Feature Vector (first 10 elements):', queryFeatureVector ? queryFeatureVector.slice(0, 10) : 'N/A', 'Length:', queryFeatureVector ? queryFeatureVector.length : 'N/A');

    connection = await pool.getConnection();
    // 3. Retrieve features of all images from the database
    const [rows] = await connection.query('SELECT id, filepath, features FROM images');
    if (!rows || rows.length === 0) {
      // Clean up uploaded file before returning, as we are done with it.
      if (queryImagePath) await fs.remove(queryImagePath).catch(err => console.error(`Error cleaning up ${queryImagePath} on no DB images:`, err));
      return res.status(404).json({ message: 'No images found in the database.' });
    }

    const allImageFeatures = rows.map((row, index) => {
      let parsedFeatures;
      // Log raw features from DB for the first few rows for inspection
      if (index < 3) { // Log for the first 3 images from DB
        //console.log(`DB Image ID ${row.id} (filepath: ${row.filepath}) - Raw DB features (type: ${typeof row.features}):`, row.features);
      }

      if (typeof row.features === 'object' && row.features !== null) {
        // If features are already an object (potentially pre-parsed by the DB driver),
        // and assuming it's an array as expected.
        if (Array.isArray(row.features)) {
          parsedFeatures = row.features;
          //console.log(`Features for image ID ${row.id} (filepath: ${row.filepath}) were already an array object. Using directly.`);
        } else {
          console.warn(`Features for image ID ${row.id} (filepath: ${row.filepath}) is an object but not an array (type: ${typeof row.features}, value: ${JSON.stringify(row.features)}). Defaulting to empty array.`);
          parsedFeatures = [];
        }
      } else if (typeof row.features === 'string') {
        // If features are a string, try to parse it with recovery logic
        try {
          parsedFeatures = JSON.parse(row.features);
        } catch (parseError) {
          console.error(`Initial JSON.parse error for image ID ${row.id} (filepath: ${row.filepath}): ${parseError.message}`);
          if (parseError instanceof SyntaxError && parseError.message && typeof parseError.message.includes === 'function' && parseError.message.includes('at position')) {
            const match = parseError.message.match(/at position (\d+)/);
            if (match && match[1]) {
              const position = parseInt(match[1], 10);
              const potentiallyValidJsonString = row.features.substring(0, position);
              const problematicCharPreview = row.features.substring(position, Math.min(row.features.length, position + 10));
              
              console.warn(`Attempting to recover from SyntaxError for image ID ${row.id} at position ${position}. Problematic part starts with: "${problematicCharPreview}...". Trying to parse: "${potentiallyValidJsonString.substring(Math.max(0, potentiallyValidJsonString.length - 30))}" (last 30 chars of potentially valid string)`);
              
              try {
                parsedFeatures = JSON.parse(potentiallyValidJsonString);
                console.log(`Successfully recovered and parsed features for image ID ${row.id} by using content up to position ${position}.`);
              } catch (recoveryError) {
                console.error(`Recovery attempt by truncation failed for image ID ${row.id}: ${recoveryError.message}. Assigning empty features.`);
                parsedFeatures = [];
              }
            } else {
              console.warn(`SyntaxError for image ID ${row.id} but position could not be extracted. Message: ${parseError.message}. Assigning empty features.`);
              parsedFeatures = [];
            }
          } else {
            console.warn(`Non-SyntaxError or no position info for image ID ${row.id}. Type: ${parseError.name}. Message: ${parseError.message}. Assigning empty features.`);
            parsedFeatures = [];
          }
        }
      } else {
        // Handle cases where features are neither string nor object (e.g., null, undefined, number)
        console.error(`Features for image ID ${row.id} (filepath: ${row.filepath}) is not a string or object (type: ${typeof row.features}). Assigning empty features.`);
        parsedFeatures = [];
      }

      // Final check to ensure parsedFeatures is an array
      if (!Array.isArray(parsedFeatures)) {
        // This log might be redundant if already logged above, but serves as a final safeguard.
        // Avoid logging if it was already an array and assigned, or if it was defaulted to [] due to an error.
        if (!(typeof row.features === 'object' && Array.isArray(row.features)) && parsedFeatures !== undefined && parsedFeatures !== null) { 
            console.warn(`Parsed features for image ID ${row.id} (filepath: ${row.filepath}) ended up not being an array (final type: ${typeof parsedFeatures}, value: ${JSON.stringify(parsedFeatures)}). Defaulting to empty array.`);
        }
        parsedFeatures = []; // Default to empty array if not already an array
      }

      // Log parsed features for the first few rows
      if (index < 3) { // Log for the first 3 images from DB
        //console.log(`DB Image ID ${row.id} - Parsed Features (first 10 elements):`, parsedFeatures ? parsedFeatures.slice(0, 10) : 'N/A', 'Length:', parsedFeatures ? parsedFeatures.length : 'N/A');
      }
      
      return {
        id: row.id,
        filepath: row.filepath,
        features: parsedFeatures
      };
    });

    // 4. Calculate similarity for each image
    for (const imageFeatures of allImageFeatures) {
      // Log inputs to calculateSimilarity for the first few DB images being compared
      if (allImageFeatures.indexOf(imageFeatures) < 3) { // Log for the first 3 comparisons
        // console.log(`Comparing with DB Image ID ${imageFeatures.id} (filepath: ${imageFeatures.filepath})`);
        // console.log('  Query Features (first 5):', queryFeatureVector ? queryFeatureVector.slice(0, 5) : 'N/A', `(len: ${queryFeatureVector ? queryFeatureVector.length : 'N/A'})`);
        // console.log(`  DB Image Features (first 5):`, imageFeatures.features ? imageFeatures.features.slice(0, 5) : 'N/A', `(len: ${imageFeatures.features ? imageFeatures.features.length : 'N/A'})`);
      }

      imageFeatures.similarity_score = calculateSimilarity(
        { combined_vector: queryFeatureVector },
        { combined_vector: imageFeatures.features }
      );
    }

    // 5. Sort by similarity and get top N results
    allImageFeatures.sort((a, b) => b.similarity_score - a.similarity_score);
    const topN = parseInt(req.query.topN) || 3;
    const topResults = allImageFeatures.slice(0, topN).map(r => ({
      id: r.id,
      filepath: r.filepath, // Send filepath instead of filename
      similarity_score: r.similarity_score
    }));

    // 6. Log the query
    const resultImageIds = JSON.stringify(topResults.map(r => r.id));
    const similarityScores = JSON.stringify(topResults.map(r => r.similarity_score));
    const queryFeaturesJson = JSON.stringify(queryFeatureVector);
    // Store relative path for query_image_path if possible, or just filename
    const relativeQueryImagePath = path.relative(PUBLIC_DIR, queryImagePath).replace(/\\\\/g, '/');


    await connection.query(
      'INSERT INTO query_logs (query_image_path, query_features, result_image_ids, similarity_scores) VALUES (?, ?, ?, ?)',
      [relativeQueryImagePath, queryFeaturesJson, resultImageIds, similarityScores]
    );

    res.json(topResults);

  } catch (error) {
    console.error('Error during image search:', error);
    res.status(500).json({ error: 'Internal server error during search.' });
  } finally {
    if (connection) {
      connection.release();
    }
    // Clean up the uploaded file after processing
    if (queryImagePath) {
      try {
        await fs.remove(queryImagePath);
        console.log(`Cleaned up uploaded file: ${queryImagePath}`);
      } catch (cleanupError) {
        console.error(`Error cleaning up file ${queryImagePath}:`, cleanupError);
      }
    }
  }
});

// Khởi động server
app.listen(port, () => {
  console.log(`Server chạy tại http://localhost:${port}`);
  // Optionally, initialize database schema if it hasn't been done
  // const { initializeDatabase } = require('./database');
  // initializeDatabase().catch(err => console.error("Failed to initialize database on startup:", err));
});