const axios = require("axios");
const FormData = require("form-data");

const CLOUD_NAME = "duguezk1s"; // your Cloudinary cloud name
const UPLOAD_PRESET = "unsigned_preset"; // must be unsigned preset from Cloudinary

const uploadToCloud = async (fileBuffer, filename, mimetype) => {
  try {
    const formData = new FormData();
    formData.append("file", fileBuffer, {
      filename: filename,
      contentType: mimetype,
    });
    formData.append("upload_preset", UPLOAD_PRESET);

    // ✅ Cloudinary unsigned upload endpoint
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      }
    );

    return {
      success: true,
      fileUrl: response.data.secure_url,
      public_id: response.data.public_id,
      message: "Upload successful",
      ...response.data,
    };
  } catch (error) {
    console.error("Upload error:", error.message);

    return {
      success: false,
      error: error.message,
      details: error.response?.data || null,
    };
  }
};

module.exports = { uploadToCloud };
