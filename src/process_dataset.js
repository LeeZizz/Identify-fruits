console.log(`[${new Date().toISOString()}] SCRIPT_START: process_dataset.js`);

const fs = require('fs-extra');
const path = require('path');
const { extractFeatures } = require('./feature_extractor');
const { pool } = require('./database');
const { DATASET_DIR, PUBLIC_DIR } = require('./config');

async function processSingleImage(imagePath, relativeImagePath) {
    console.log(`[${new Date().toISOString()}] processSingleImage START for: ${relativeImagePath}`);
    try {
        console.log(`[${new Date().toISOString()}] Calling extractFeatures for: ${imagePath}`);
        const featuresData = await extractFeatures(imagePath);
        console.log(`[${new Date().toISOString()}] extractFeatures returned for: ${imagePath}`, featuresData && featuresData.combined_vector ? 'with data' : 'without data or combined_vector');

        if (featuresData && featuresData.combined_vector) {
            const featuresJson = JSON.stringify(featuresData.combined_vector);
            const filename = path.basename(imagePath);
            
            const query = 'INSERT INTO images (filename, filepath, features) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE features = VALUES(features)';
            console.log(`[${new Date().toISOString()}] DB query START for: ${relativeImagePath}`);
            await pool.query(query, [filename, relativeImagePath, featuresJson]);
            console.log(`[${new Date().toISOString()}] DB query END for: ${relativeImagePath}`);
            console.log(`Processed and saved features for: ${relativeImagePath}`);
        } else {
            console.warn(`[${new Date().toISOString()}] Could not extract features or missing combined_vector for ${imagePath}, skipping.`);
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error processing image ${imagePath}:`, error);
    }
    console.log(`[${new Date().toISOString()}] processSingleImage END for: ${relativeImagePath}`);
}

async function processDataset() {
    console.log(`[${new Date().toISOString()}] PROCESS_DATASET_START`);
    try {
        const fruitTypeFolders = await fs.readdir(DATASET_DIR);
        console.log('Found items in DATASET_DIR:', fruitTypeFolders); // Log quan trọng

        let folderProcessingAttempt = 0; // Đếm số lần thử xử lý thư mục

        for (const fruitType of fruitTypeFolders) {
            folderProcessingAttempt++;
            console.log(`\\n--- Folder Processing Attempt #${folderProcessingAttempt} ---`);
            console.log(`Current fruitType from loop: '${fruitType}'`);

            const fruitTypePath = path.join(DATASET_DIR, fruitType);
            console.log(`Checking path: ${fruitTypePath}`);
            try {
                const stats = await fs.stat(fruitTypePath);
                if (stats.isDirectory()) {
                    console.log(`Processing folder: ${fruitType} (Attempt #${folderProcessingAttempt})`);
                    const imageFiles = await fs.readdir(fruitTypePath);
                    console.log(`Found ${imageFiles.length} files in ${fruitType}`);
                    for (const imageFile of imageFiles) {
                        console.log(`Checking image file: ${imageFile} in ${fruitType}`);
                        // Corrected REGEX HERE
                        if (imageFile.match(/\.(jpg|jpeg|png)$/i)) {
                            const fullImagePath = path.join(fruitTypePath, imageFile);
                            // Corrected path replacement
                            const relativeImagePath = path.relative(PUBLIC_DIR, fullImagePath).replace(/\\/g, '/');
                            console.log(`Attempting to process: ${relativeImagePath}`);
                            await processSingleImage(fullImagePath, relativeImagePath);
                            console.log(`Successfully finished call to processSingleImage for: ${relativeImagePath}`);
                        } else {
                            console.log(`Skipping non-image file: ${imageFile} in ${fruitType}`);
                        }
                    }
                    console.log(`Finished processing all images in folder: ${fruitType} (Attempt #${folderProcessingAttempt})`);
                } else {
                    console.log(`Skipping '${fruitType}' as it is not a directory. (Attempt #${folderProcessingAttempt})`);
                }
            } catch (statError) {
                console.error(`Error stating path ${fruitTypePath} (Attempt #${folderProcessingAttempt}):`, statError);
            }
        }
        console.log('\\n--- All folders from fruitTypeFolders have been iterated ---');
        console.log(`[${new Date().toISOString()}] PROCESS_DATASET_END`);
    } catch (error) {
        console.error('Error during dataset processing:', error);
    }
}

// Ensure database connection is established before processing
async function main() {
    console.log(`[${new Date().toISOString()}] MAIN_START`);
    try {
        // Attempt to get a connection to ensure DB is ready
        const connection = await pool.getConnection();
        console.log('Database connection successful for dataset processing.');
        connection.release();
        await processDataset();
    } catch (dbError) {
        console.error('Failed to connect to the database for dataset processing:', dbError);
        // If processDataset throws an error, it might be caught here if not caught within processDataset itself.
    } finally {
        if (pool) { // Check if pool exists before trying to end it
            console.log(`[${new Date().toISOString()}] Closing database pool in main function...`);
            await pool.end();
            console.log(`[${new Date().toISOString()}] Database pool closed in main function.`);
        }
        console.log(`[${new Date().toISOString()}] MAIN_END`);
    }
}

main().then(() => {
    console.log(`[${new Date().toISOString()}] SCRIPT_SHOULD_EXIT_NOW`);
}).catch(err => {
    console.error(`[${new Date().toISOString()}] SCRIPT_ERROR_AT_END:`, err);
});
