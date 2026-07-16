const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
];

const fileInput = document.getElementById("file-input");
const uploadBtn = document.getElementById("upload-btn");
const previewArea = document.getElementById("preview-area");
const preview = document.getElementById("preview");
const progressArea = document.getElementById("progress-area");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const statusEl = document.getElementById("status");

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function resetUI() {
  progressArea.classList.add("hidden");
  progressFill.style.width = "0%";
  progressText.textContent = "Uploading…";
  uploadBtn.disabled = false;
}

function isPhoto(file) {
  return ALLOWED_TYPES.includes(file.type);
}

uploadBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  fileInput.value = "";

  if (!file) {
    return;
  }

  if (!isPhoto(file)) {
    setStatus("Please choose a photo file.", "error");
    return;
  }

  setStatus("");
  preview.src = URL.createObjectURL(file);
  previewArea.classList.remove("hidden");
  uploadBtn.disabled = true;
  progressArea.classList.remove("hidden");

  try {
    const { uploadUrl } = await requestUploadUrl(file.type);

    await uploadToS3(uploadUrl, file);

    setStatus("Thank you! Your photo was uploaded.", "success");
    previewArea.classList.add("hidden");
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Upload failed. Please try again.", "error");
  } finally {
    resetUI();
  }
});

async function requestUploadUrl(contentType) {
  const response = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not start upload.");
  }

  return data;
}

function uploadToS3(uploadUrl, file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const percent = Math.round((event.loaded / event.total) * 100);
      progressFill.style.width = `${percent}%`;
      progressText.textContent = `Uploading… ${percent}%`;
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        progressFill.style.width = "100%";
        progressText.textContent = "Done!";
        resolve();
        return;
      }

      reject(new Error("Upload failed. Please try again."));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload."));
    });

    xhr.send(file);
  });
}
