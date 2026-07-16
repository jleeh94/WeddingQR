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
  previewArea.classList.add("hidden");
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

function setProgress(completedCount, totalCount, filePercent = 0) {
  const overall = ((completedCount + filePercent / 100) / totalCount) * 100;
  progressFill.style.width = `${Math.round(overall)}%`;

  if (totalCount === 1) {
    progressText.textContent = filePercent ? `Uploading… ${Math.round(filePercent)}%` : "Uploading…";
    return;
  }

  progressText.textContent = filePercent
    ? `Uploading photo ${completedCount + 1} of ${totalCount}… ${Math.round(filePercent)}%`
    : `Uploading photo ${completedCount + 1} of ${totalCount}…`;
}

cameraBtn.addEventListener("click", () => {
  cameraInput.click();
});

galleryBtn.addEventListener("click", () => {
  galleryInput.click();
});

async function handleFilesSelected(files) {
  const photos = [...files].filter(isPhoto);

  if (photos.length === 0) {
    setStatus("Please choose at least one photo.", "error");
    return;
  }

  if (photos.length < files.length) {
    setStatus("Some files were skipped — photos only.", "error");
  } else {
    setStatus("");
  }

  if (photos.length === 1) {
    preview.src = URL.createObjectURL(photos[0]);
    previewArea.classList.remove("hidden");
  } else {
    previewArea.classList.add("hidden");
  }

  setButtonsDisabled(true);
  progressArea.classList.remove("hidden");
  setProgress(0, photos.length);

  let uploaded = 0;

  try {
    for (let index = 0; index < photos.length; index += 1) {
      const file = photos[index];
      const contentType = file.type || "image/jpeg";
      const { uploadUrl } = await requestUploadUrl(contentType);

      await uploadToS3(uploadUrl, file, contentType, index, photos.length);
      uploaded += 1;
      setProgress(uploaded, photos.length);
    }

    const label = uploaded === 1 ? "photo was" : "photos were";
    setStatus(`Thank you! ${uploaded} ${label} uploaded.`, "success");
    previewArea.classList.add("hidden");
  } catch (err) {
    console.error(err);
    if (uploaded > 0) {
      setStatus(
        `${uploaded} of ${photos.length} uploaded. ${err.message || "Please try again."}`,
        "error"
      );
    } else {
      setStatus(err.message || "Upload failed. Please try again.", "error");
    }
  } finally {
    resetUI();
  }
}

cameraInput.addEventListener("change", (event) => {
  const files = event.target.files;
  event.target.value = "";
  if (files.length) {
    handleFilesSelected(files);
  }
});

galleryInput.addEventListener("change", (event) => {
  const files = event.target.files;
  event.target.value = "";
  if (files.length) {
    handleFilesSelected(files);
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

function uploadToS3(uploadUrl, file, contentType, fileIndex, totalFiles) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const percent = (event.loaded / event.total) * 100;
      setProgress(fileIndex, totalFiles, percent);
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
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
