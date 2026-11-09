





import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dmiacxpbp',
  api_key: process.env.CLOUDINARY_API_KEY || '743114659653647',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'ifbBcCPSeSt_3uztZrMV4HP82OQ',
  secure: true,
});

export const downloadMetaMedia = async (mediaId) => {
  try {
    const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

    const mediaInfoRes = await axios.get(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    });

    const fileUrl = mediaInfoRes.data.url;
    const mimeType = mediaInfoRes.data.mime_type || 'application/octet-stream';

    // Include a user-agent header to avoid a 403 response from Meta.
    const fileRes = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });

    const base64Data = Buffer.from(fileRes.data).toString('base64');
    const fileDataUri = `data:${mimeType};base64,${base64Data}`;

    let resourceType = 'auto';
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('word') ||
      mimeType.includes('text') ||
      mimeType.includes('zip')
    ) {
      resourceType = 'raw';
    }



    const result = await cloudinary.uploader.upload(fileDataUri, {
      folder: 'whatsapp_crm',
      resource_type: resourceType,
      type: 'authenticated', // 🔒 Private
    });

    // Cloudinary delivery type must be 'image', 'video', or 'raw', never 'auto'.
    const deliveryType = result.resource_type || (resourceType === 'raw' ? 'raw' : 'image');

    // Generate a signed URL with the correct format and resource type.
    const signedUrl = cloudinary.url(result.public_id, {
      type: 'authenticated',
      sign_url: true,
      secure: true,
      resource_type: deliveryType,
      format: result.format,
      expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 3600),
    });

    return {
      mediaUrl: signedUrl,
      publicId: result.public_id,
      mimeType,
    };

  } catch (error) {
    console.error('Exact Error:', error.response?.data || error);
    return null;
  }
};



export const uploadLocalFileToCloudinary = async (localFilePath) => {
  try {

    // Upload the file privately.
    const result = await cloudinary.uploader.upload(localFilePath, {
      folder: 'whatsapp_crm',
      resource_type: 'auto',
      type: 'authenticated',
    });

    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    // Generate a signed URL for the uploaded file.
    const signedUrl = cloudinary.url(result.public_id, {
      type: 'authenticated',
      sign_url: true,
      secure: true,
      resource_type: result.resource_type || 'auto',
      expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 3600),
    });

    return signedUrl;
  } catch (error) {
    console.error('Cloudinary local upload error:', error);
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    return null;
  }
};
