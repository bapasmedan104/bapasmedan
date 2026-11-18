/**
 * Cloudinary Configuration & Helper Functions
 * Menangani upload media (foto, gambar, video) ke Cloudinary
 */

const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');

dotenv.config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
const apiKey = process.env.CLOUDINARY_API_KEY || '314147995126986';
const apiSecret = process.env.CLOUDINARY_API_SECRET || 's973tydm6PUqzMsBsT_S5sb6VR8';

function isCloudinaryConfigured() {
  return Boolean(cloudName && apiKey && apiSecret);
}

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
  console.log(`☁️ Cloudinary terkonfigurasi (Cloud Name: ${cloudName})`);
} else {
  console.log('ℹ️ Cloudinary belum lengkap (CLOUDINARY_CLOUD_NAME belum diisi). Mode upload lokal aktif sebagai fallback.');
}

/**
 * Upload buffer file ke Cloudinary
 * @param {Buffer} buffer 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      return reject(new Error('Cloudinary belum terkonfigurasi. Harap isi CLOUDINARY_CLOUD_NAME di file .env'));
    }

    const uploadOptions = {
      folder: 'bapas_medan',
      resource_type: 'auto', // Mendukung gambar dan video
      ...options
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        return reject(error);
      }
      resolve(result);
    });

    stream.end(buffer);
  });
}

/**
 * Upload file lokal dari disk ke Cloudinary
 * @param {string} filePath 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
async function uploadFile(filePath, options = {}) {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary belum terkonfigurasi. Harap isi CLOUDINARY_CLOUD_NAME di file .env');
  }

  const uploadOptions = {
    folder: 'bapas_medan',
    resource_type: 'auto',
    ...options
  };

  return await cloudinary.uploader.upload(filePath, uploadOptions);
}

/**
 * Upload data base64 (contoh: snapshot webcam) ke Cloudinary
 * @param {string} base64String 
 * @param {Object} options 
 * @returns {Promise<Object>}
 */
async function uploadBase64(base64String, options = {}) {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary belum terkonfigurasi. Harap isi CLOUDINARY_CLOUD_NAME di file .env');
  }

  // Pastikan prefix data URI ada
  const dataUri = base64String.startsWith('data:')
    ? base64String
    : `data:image/jpeg;base64,${base64String}`;

  const uploadOptions = {
    folder: 'bapas_medan',
    resource_type: 'auto',
    ...options
  };

  return await cloudinary.uploader.upload(dataUri, uploadOptions);
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadBuffer,
  uploadFile,
  uploadBase64
};

