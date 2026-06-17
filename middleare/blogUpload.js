import multer from "multer";
import fs from "fs";
import path from "path";

// ensure folder exists
const uploadPath = "uploads/blogs";

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

// file filter to accept image files only
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|webp/i;
  const isExtensionValid = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const isMimeTypeValid = allowedExtensions.test(file.mimetype);

  if (isExtensionValid && isMimeTypeValid) {
    cb(null, true);
  } else {
    cb(new Error("Only jpeg, jpg, png, and webp images are allowed!"), false);
  }
};

export const blogUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
