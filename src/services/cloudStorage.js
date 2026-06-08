const { 
    S3Client, 
    PutObjectCommand, 
    GetObjectCommand,
    CreateBucketCommand, 
    HeadBucketCommand 
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// ==========================================
// 1. Initialize the Shared S3 Client
// ==========================================
const s3Client = new S3Client({
    region: 'us-east-1',
    endpoint: process.env.S3_ENDPOINT, 
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
    },
    forcePathStyle: true, 
});

const bucketName = process.env.S3_BUCKET_NAME;

// ==========================================
// 2. Storage Initialization
// ==========================================
const initializeStorage = async () => {
    try {
        try {
            await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
            console.log(`Bucket "${bucketName}" is ready and verified.`);
        } catch (error) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                console.log(`Bucket "${bucketName}" not found. Creating it now...`);
                await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
                console.log(`Bucket "${bucketName}" successfully created.`);
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('\n=== MINIO INITIALIZATION FAILED ===');
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('===================================\n');
    }
};

// ==========================================
// 3. Application Helpers
// ==========================================

// For Uploads (Frontend to S3)
const generatePresignedPutUrl = async (fileKey, contentType, expiresIn = 300) => {
    try {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
            ContentType: contentType,
        });

        return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
        console.error('Error generating pre-signed PUT URL:', error);
        throw new Error('Failed to generate secure upload link.');
    }
};

// For Downloads (Go Engine pulling from S3)
const generatePresignedGetUrl = async (fileKey, expiresIn = 3600) => {
    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
        });

        // Expires in 1 hour by default to give the RabbitMQ queue plenty of time
        return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
        console.error('Error generating pre-signed GET URL:', error);
        throw new Error('Failed to generate secure download link.');
    }
};

module.exports = {
    initializeStorage,
    generatePresignedPutUrl,
    generatePresignedGetUrl
};