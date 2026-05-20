// src/services/cloudStorage.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Initialize the S3 Client
// This configuration works for AWS S3, DigitalOcean Spaces, MinIO, or Cloudflare R2
const s3Client = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT, // e.g., 'https://s3.eu-central-1.amazonaws.com' or your MinIO IP
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
    },
    // Set to true if using a local MinIO setup without SSL yet
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', 
});

/**
 * Generates a short-lived URL where the frontend can directly upload a file.
 * * @param {string} fileKey - The unique path/name where the file will be saved (e.g., 'campaigns/client_123/file.csv')
 * @param {string} contentType - The MIME type of the file (e.g., 'text/csv')
 * @param {number} expiresIn - How long the URL is valid in seconds (default 5 minutes)
 * @returns {Promise<string>} The pre-signed URL
 */
const generatePresignedPutUrl = async (fileKey, contentType, expiresIn = 300) => {
    try {
        const command = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileKey,
            ContentType: contentType,
        });

        // Generate the pre-signed URL using the client and command
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
        
        return signedUrl;
    } catch (error) {
        console.error('Error generating pre-signed URL:', error);
        throw new Error('Failed to generate secure upload link.');
    }
};

module.exports = {
    generatePresignedPutUrl
};