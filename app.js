const form = document.getElementById("qr-form");
const urlInput = document.getElementById("url-input");
const generateBtn = document.getElementById("generate-btn");
const errorMsg = document.getElementById("error-msg");
const qrContainer = document.getElementById("qr-container");
const placeholder = document.getElementById("qr-placeholder");
const qrImage = document.getElementById("qr-image");
const copyBtn = document.getElementById("copy-btn");
const downloadBtn = document.getElementById("download-btn");

const settingsBtn = document.getElementById("settings-btn");
const settingsDialog = document.getElementById("settings-dialog");
const fgColor = document.getElementById("fg-color");
const bgColor = document.getElementById("bg-color");
const scaleInput = document.getElementById("scale");
const scaleValue = document.getElementById("scale-value");
const borderInput = document.getElementById("border");
const borderValue = document.getElementById("border-value");

let currentBlob = null;

settingsBtn.addEventListener("click", () => settingsDialog.showModal());
scaleInput.addEventListener("input", () => (scaleValue.textContent = scaleInput.value));
borderInput.addEventListener("input", () => (borderValue.textContent = borderInput.value));

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove("hidden");
}

function clearError() {
  errorMsg.classList.add("hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const url = urlInput.value.trim();
  if (!url) return;

  generateBtn.disabled = true;
  generateBtn.textContent = "Generating…";

  const params = new URLSearchParams({
    url,
    dark: fgColor.value,
    light: bgColor.value,
    scale: scaleInput.value,
    border: borderInput.value,
  });

  try {
    const response = await fetch(`/api/generate?${params}`);
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const body = await response.json();
        if (body.error) message = body.error;
      } catch (_) {
        /* non-JSON error body */
      }
      throw new Error(message);
    }

    currentBlob = await response.blob();
    if (qrImage.src) URL.revokeObjectURL(qrImage.src);
    qrImage.src = URL.createObjectURL(currentBlob);
    qrImage.classList.remove("hidden");
    placeholder.classList.add("hidden");
    qrContainer.classList.add("has-qr");
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
  } catch (err) {
    showError(err.message);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate";
  }
});

copyBtn.addEventListener("click", async () => {
  if (!currentBlob) return;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": currentBlob }),
    ]);
    const original = copyBtn.textContent;
    copyBtn.textContent = "Copied!";
    setTimeout(() => (copyBtn.textContent = original), 1500);
  } catch (err) {
    showError("Copying images is not supported in this browser. Use Download instead.");
  }
});

downloadBtn.addEventListener("click", () => {
  if (!currentBlob) return;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(currentBlob);
  link.download = "qr-code.png";
  link.click();
  URL.revokeObjectURL(link.href);
});
