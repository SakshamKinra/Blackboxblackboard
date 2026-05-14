const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Use path.resolve to ensure we have an absolute path regardless of where the process started.
const uploadsDir = path.resolve(__dirname, '..', 'uploads');

const ensureUploadsDir = () => {
  try {
    if (!fs.existsSync(uploadsDir)) {
      console.log(`[Uploads] Creating directory at: ${uploadsDir}`);
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
    console.error(`[Uploads] Failed to create directory: ${err.message}`);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      ensureUploadsDir();
      cb(null, uploadsDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit as requested
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (file.mimetype === 'image/svg+xml' || path.extname(file.originalname).toLowerCase() === '.svg') {
      return cb(new Error('SVG files are not allowed'));
    }
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpg, png, gif, webp).'));
    }
  },
});

module.exports = upload;
module.exports.ensureUploadsDir = ensureUploadsDir;
module.exports.uploadsDir = uploadsDir;
