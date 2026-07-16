const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const crypto = require("crypto");
const express = require("express");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
]);

const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};

function getS3Client() {
  const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION } = process.env;

  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION) {
    return null;
  }

  return new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.get("/background.png", (_req, res) => {
  res.sendFile(path.join(__dirname, "background.png"));
});

app.get("/api/health", (_req, res) => {
  const configured = Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_REGION &&
      process.env.S3_BUCKET
  );

  res.json({ ok: true, s3Configured: configured });
});

app.post("/api/upload-url", async (req, res) => {
  const { contentType } = req.body;

  if (!contentType || !ALLOWED_TYPES.has(contentType)) {
    return res.status(400).json({ error: "Only photo uploads are allowed." });
  }

  const client = getS3Client();
  const bucket = process.env.S3_BUCKET;
  const prefix = process.env.S3_PREFIX || "uploads";

  if (!client || !bucket) {
    return res.status(503).json({
      error: "Upload is not configured yet. Please add AWS credentials.",
    });
  }

  const ext = EXTENSIONS[contentType];
  const key = `${prefix}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  try {
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });

    res.json({ uploadUrl, key });
  } catch (err) {
    console.error("Failed to create upload URL:", err);
    res.status(500).json({ error: "Could not prepare upload. Try again." });
  }
});

app.listen(PORT, () => {
  console.log(`Wedding upload site running at http://localhost:${PORT}`);
});
