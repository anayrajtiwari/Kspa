const AWS = require('aws-sdk');
const sharp = require('sharp');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Generate unique filename
const generateFileName = (originalName, userId) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalName);
  return `${userId}/${timestamp}-${randomString}${extension}`;
};

// Upload file to S3
const uploadToS3 = async (buffer, fileName, contentType) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileName,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read' // Make files publicly accessible
  };

  try {
    const result = await s3.upload(params).promise();
    return result.Location;
  } catch (error) {
    logger.error('S3 upload error', error);
    throw new Error('Failed to upload file to S3');
  }
};

// Process image (resize, optimize)
const processImage = async (buffer, options = {}) => {
  const {
    width = 1200,
    height = 800,
    quality = 80,
    generateThumbnail = true
  } = options;

  try {
    // Main image processing
    const processedImage = await sharp(buffer)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality })
      .toBuffer();

    let thumbnailBuffer = null;
    if (generateThumbnail) {
      thumbnailBuffer = await sharp(buffer)
        .resize(300, 200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 70 })
        .toBuffer();
    }

    return { processedImage, thumbnailBuffer };
  } catch (error) {
    logger.error('Image processing error', error);
    throw new Error('Failed to process image');
  }
};

// Upload vehicle photos
const uploadVehiclePhotos = async (files, vehicleId, angleTags = []) => {
  try {
    const uploadedPhotos = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const angle = angleTags[i] || 'other';

      // Process image
      const { processedImage, thumbnailBuffer } = await processImage(file.buffer, {
        width: 1920,
        height: 1080,
        quality: 85,
        generateThumbnail: true
      });

      // Generate filenames
      const fileName = `vehicles/${vehicleId}/${generateFileName(file.originalname, vehicleId)}`;
      const thumbnailFileName = `vehicles/${vehicleId}/thumbnails/${generateFileName(file.originalname, vehicleId)}`;

      // Upload main image
      const imageUrl = await uploadToS3(processedImage, fileName, 'image/jpeg');

      // Upload thumbnail
      const thumbnailUrl = thumbnailBuffer
        ? await uploadToS3(thumbnailBuffer, thumbnailFileName, 'image/jpeg')
        : imageUrl;

      uploadedPhotos.push({
        url: imageUrl,
        thumbnail: thumbnailUrl,
        caption: `${angle.replace('_', ' ').toUpperCase()} view`,
        isPrimary: i === 0, // First photo is primary
        angle,
        uploadedAt: new Date()
      });
    }

    return uploadedPhotos;
  } catch (error) {
    logger.error('Vehicle photos upload error', error);
    throw new Error('Failed to upload vehicle photos');
  }
};

// Upload vehicle videos
const uploadVehicleVideos = async (files, vehicleId) => {
  try {
    const uploadedVideos = [];

    for (const file of files) {
      const fileName = `vehicles/${vehicleId}/videos/${generateFileName(file.originalname, vehicleId)}`;
      const videoUrl = await uploadToS3(file.buffer, fileName, file.mimetype);

      uploadedVideos.push({
        url: videoUrl,
        title: file.originalname,
        type: 'walkthrough',
        uploadedAt: new Date()
      });
    }

    return uploadedVideos;
  } catch (error) {
    logger.error('Vehicle videos upload error', error);
    throw new Error('Failed to upload vehicle videos');
  }
};

// Upload documents
const uploadDocument = async (file, documentType, userId) => {
  try {
    const fileName = `documents/${userId}/${documentType}/${generateFileName(file.originalname, userId)}`;
    const documentUrl = await uploadToS3(file.buffer, fileName, file.mimetype);

    return {
      url: documentUrl,
      fileName: file.originalname,
      documentType,
      uploadedAt: new Date()
    };
  } catch (error) {
    logger.error('Document upload error', error);
    throw new Error('Failed to upload document');
  }
};

// Upload user avatar
const uploadAvatar = async (file, userId) => {
  try {
    // Process avatar image
    const { processedImage } = await processImage(file.buffer, {
      width: 400,
      height: 400,
      quality: 85,
      generateThumbnail: false
    });

    const fileName = `users/${userId}/avatar/${generateFileName(file.originalname, userId)}`;
    const avatarUrl = await uploadToS3(processedImage, fileName, 'image/jpeg');

    return { url: avatarUrl };
  } catch (error) {
    logger.error('Avatar upload error', error);
    throw new Error('Failed to upload avatar');
  }
};

// Delete file from S3
const deleteFile = async (fileUrl) => {
  try {
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // Remove leading slash

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    };

    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    logger.error('File deletion error', error);
    throw new Error('Failed to delete file');
  }
};

// Bulk delete files
const deleteFiles = async (fileUrls) => {
  try {
    const deletePromises = fileUrls.map(url => deleteFile(url));
    await Promise.all(deletePromises);
    return true;
  } catch (error) {
    logger.error('Bulk file deletion error', error);
    throw new Error('Failed to delete files');
  }
};

// Get file info from S3
const getFileInfo = async (fileUrl) => {
  try {
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1);

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    };

    const result = await s3.headObject(params).promise();
    return {
      size: result.ContentLength,
      lastModified: result.LastModified,
      contentType: result.ContentType
    };
  } catch (error) {
    logger.error('Get file info error', error);
    throw new Error('Failed to get file info');
  }
};

// Validate image file
const validateImage = (file) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
  }

  if (file.size > maxSize) {
    throw new Error('File size too large. Maximum size is 5MB.');
  }

  return true;
};

// Validate document file
const validateDocument = (file) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only PDF, JPEG, and PNG files are allowed.');
  }

  if (file.size > maxSize) {
    throw new Error('File size too large. Maximum size is 10MB.');
  }

  return true;
};

// Validate video file
const validateVideo = (file) => {
  const allowedTypes = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ];
  const maxSize = 100 * 1024 * 1024; // 100MB

  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only MP4, MOV, AVI, and WebM videos are allowed.');
  }

  if (file.size > maxSize) {
    throw new Error('File size too large. Maximum size is 100MB.');
  }

  return true;
};

module.exports = {
  uploadVehiclePhotos,
  uploadVehicleVideos,
  uploadDocument,
  uploadAvatar,
  deleteFile,
  deleteFiles,
  getFileInfo,
  validateImage,
  validateDocument,
  validateVideo,
  generateFileName
};