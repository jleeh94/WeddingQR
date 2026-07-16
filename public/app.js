const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
];

const cameraInput = document.getElementById("camera-input");
const galleryInput = document.getElementById("gallery-input");
const cameraBtn = document.getElementById("camera-btn");
const galleryBtn = document.getElementById("gallery-btn");
const uploadButtons = [cameraBtn, galleryBtn];
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

function setButtonsDisabled(disabled) {
  uploadButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

function resetUI() {
  progressArea.classList.add("hidden");
  progressFill.style.width = "0%";
  progressText.textContent = "Uploading…";
  setButtonsDisabled(false);
}

function isPhoto(file) {
  if (ALLOWED_TYPES.includes(file.type)) {
    return true;
  }

  return /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name);
}

cameraBtn.addEventListener("click", () => {
  cameraInput.click();
});

galleryBtn.addEventListener("click", () => {
  galleryInput.click();
});

async function handleFileSelected(file) {
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
  setButtonsDisabled(true);
  progressArea.classList.remove("hidden");

  try {
    const contentType = file.type || "image/jpeg";
    const { uploadUrl } = await requestUploadUrl(contentType);

    await uploadToS3(uploadUrl, file, contentType);

    setStatus("Thank you! Your photo was uploaded.", "success");
    previewArea.classList.add("hidden");
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Upload failed. Please try again.", "error");
  } finally {
    resetUI();
  }
}

function handleInputChange(event) {
  const file = event.target.files[0];
  event.target.value = "";
  handleFileSelected(file);
}

cameraInput.addEventListener("change", handleInputChange);
galleryInput.addEventListener("change", handleInputChange);

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

function uploadToS3(uploadUrl, file, contentType) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);

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

      reject(new Error(`Upload failed (${xhr.status}). Check S3 permissions and CORS.`));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload."));
    });

    xhr.send(file);
  });
}
