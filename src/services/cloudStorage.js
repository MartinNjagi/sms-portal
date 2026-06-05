const { 
    S3Client, 
    PutObjectCommand, 
    CreateBucketCommand, 
    PutBucketCorsCommand, 
    HeadBucketCommand 
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// ==========================================
// 1. Initialize the Shared S3 Client
// ==========================================
const s3Client = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT, // e.g., 'https://a5f5d63f.nip.io/s3'
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
    },
    // Hardcoded to true to force Path-Style routing and prevent SSL AltName errors
    forcePathStyle: true, 
});

const bucketName = process.env.S3_BUCKET_NAME;

// ==========================================
// 2. Storage Initialization (Run on Startup)
// ==========================================
const initializeStorage = async () => {
    try {
        // Check if bucket already exists
        try {
            await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
            console.log(`Bucket "${bucketName}" already exists.`);
        } catch (error) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                console.log(`Bucket "${bucketName}" not found. Creating it now...`);
                await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
                console.log(`Bucket "${bucketName}" successfully created.`);
            } else {
                throw error;
            }
        }

        // Apply CORS Configuration so browsers can directly upload via presigned URLs
        const corsConfiguration = {
            Bucket: bucketName,
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ['*'],
                        AllowedMethods: ['PUT', 'POST', 'GET', 'HEAD'],
                        AllowedOrigins: ['*'], // In production, replace '*' with your frontend URL
                        ExposedHeaders: ['ETag'],
                        MaxAgeSeconds: 3000
                    }
                ]
            }
        };

        await s3Client.send(new PutBucketCorsCommand(corsConfiguration));
        console.log(`CORS policy applied to bucket "${bucketName}".`);

    } catch (error) {
        console.error('Critical: Failed to initialize MinIO storage structure:', error);
    }
};

// ==========================================
// 3. Application Helpers (Run during app use)
// ==========================================
/**
 * Generates a short-lived URL where the frontend can directly upload a file.
 * @param {string} fileKey - The unique path/name where the file will be saved
 * @param {string} contentType - The MIME type of the file
 * @param {number} expiresIn - How long the URL is valid in seconds (default 5 minutes)
 * @returns {Promise<string>} The pre-signed URL
 */
const generatePresignedPutUrl = async (fileKey, contentType, expiresIn = 300) => {
    try {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
            ContentType: contentType,
        });

        // Generate the pre-signed URL using the shared client
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
        return signedUrl;
    } catch (error) {
        console.error('Error generating pre-signed URL:', error);
        throw new Error('Failed to generate secure upload link.');
    }
};

module.exports = {
    initializeStorage,
    generatePresignedPutUrl
};