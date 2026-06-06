const { 
    S3Client, 
    PutObjectCommand, 
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
        // CORS configuration removed because MinIO handles it globally by default!
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
const generatePresignedPutUrl = async (fileKey, contentType, expiresIn = 300) => {
    try {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
            ContentType: contentType,
        });

        return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
        console.error('Error generating pre-signed URL:', error);
        throw new Error('Failed to generate secure upload link.');
    }
};

module.exports = {
    initializeStorage,
    generatePresignedPutUrl
};