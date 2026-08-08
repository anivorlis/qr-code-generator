const form = document.getElementById("qr-form");
const modeSelect = document.getElementById("mode");
const generateBtn = document.getElementById("generate-btn");
const errorMsg = document.getElementById("error-msg");
const warningMsg = document.getElementById("warning-msg");
const qrContainer = document.getElementById("qr-container");
const placeholder = document.getElementById("qr-placeholder");
const qrImage = document.getElementById("qr-image");
const copyBtn = document.getElementById("copy-btn");
const downloadBtn = document.getElementById("download-btn");
const linkBtn = document.getElementById("link-btn");

const settingsBtn = document.getElementById("settings-btn");
const settingsDialog = document.getElementById("settings-dialog");
const fgColor = document.getElementById("fg-color");
const bgColor = document.getElementById("bg-color");
const scaleInput = document.getElementById("scale");
const scaleValue = document.getElementById("scale-value");
const borderInput = document.getElementById("border");
const borderValue = document.getElementById("border-value");
const errorLevel = document.getElementById("error-level");
const formatSelect = document.getElementById("format");
const logoInput = document.getElementById("logo-input");
const logoClear = document.getElementById("logo-clear");

let currentBlob = null;
let currentFormat = "png";
let logoDataUrl = null;

/* ---------- settings dialog ---------- */

settingsBtn.addEventListener("click", () => settingsDialog.showModal());
scaleInput.addEventListener("input", () => (scaleValue.textContent = scaleInput.value));
borderInput.addEventListener("input", () => (borderValue.textContent = borderInput.value));

logoInput.addEventListener("change", () => {
  const file = logoInput.files[0];
  if (!file) {
    logoDataUrl = null;
    logoClear.classList.add("hidden");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    logoDataUrl = reader.result;
    logoClear.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

logoClear.addEventListener("click", () => {
  logoInput.value = "";
  logoDataUrl = null;
  logoClear.classList.add("hidden");
});

/* ---------- mode switching ---------- */

modeSelect.addEventListener("change", () => {
  document.querySelectorAll(".mode-fields").forEach((fs) => {
    const active = fs.dataset.mode === modeSelect.value;
    fs.hidden = !active;
    fs.disabled = !active;
  });
});

const wifiSecurity = document.getElementById("wifi-security");
const wifiPassword = document.getElementById("wifi-password");
wifiSecurity.addEventListener("change", () => {
  const nopass = wifiSecurity.value === "nopass";
  wifiPassword.disabled = nopass;
  wifiPassword.required = !nopass;
  if (nopass) wifiPassword.value = "";
});

/* ---------- payload builders ---------- */

const escapeWifi = (s) => s.replace(/([\\;,:"])/g, "\\$1");
const escapeVcard = (s) => s.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");

function buildPayload() {
  const val = (id) => document.getElementById(id).value.trim();

  switch (modeSelect.value) {
    case "url": {
      let url = val("url-input");
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) url = "https://" + url;
      return url;
    }
    case "text":
      return val("text-input");
    case "wifi": {
      const security = wifiSecurity.value;
      let payload = `WIFI:T:${security};S:${escapeWifi(val("wifi-ssid"))};`;
      if (security !== "nopass") payload += `P:${escapeWifi(val("wifi-password"))};`;
      if (document.getElementById("wifi-hidden").checked) payload += "H:true;";
      return payload + ";";
    }
    case "email": {
      const parts = [];
      const subject = val("email-subject");
      const body = val("email-body");
      if (subject) parts.push("subject=" + encodeURIComponent(subject));
      if (body) parts.push("body=" + encodeURIComponent(body));
      return "mailto:" + val("email-to") + (parts.length ? "?" + parts.join("&") : "");
    }
    case "vcard": {
      const lines = ["BEGIN:VCARD", "VERSION:3.0", "FN:" + escapeVcard(val("vcard-name"))];
      if (val("vcard-phone")) lines.push("TEL:" + escapeVcard(val("vcard-phone")));
      if (val("vcard-email")) lines.push("EMAIL:" + escapeVcard(val("vcard-email")));
      if (val("vcard-org")) lines.push("ORG:" + escapeVcard(val("vcard-org")));
      if (val("vcard-url")) lines.push("URL:" + escapeVcard(val("vcard-url")));
      lines.push("END:VCARD");
      return lines.join("\n");
    }
  }
}

/* ---------- contrast check ---------- */

function luminance(hex) {
  const rgb = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrastWarning() {
  const dark = luminance(fgColor.value);
  const light = luminance(bgColor.value);
  if (dark > light) {
    return "The foreground is lighter than the background — inverted QR codes often fail to scan.";
  }
  const ratio = (light + 0.05) / (dark + 0.05);
  if (ratio < 2.5) {
    return "Low contrast between the colors — this QR code may be hard to scan.";
  }
  return null;
}

/* ---------- generate ---------- */

function setMessage(el, message) {
  el.textContent = message || "";
  el.classList.toggle("hidden", !message);
}

function currentSettings() {
  const settings = {
    dark: fgColor.value,
    light: bgColor.value,
    scale: scaleInput.value,
    border: borderInput.value,
    error: errorLevel.value,
    format: logoDataUrl ? "png" : formatSelect.value,
  };
  return settings;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(errorMsg, null);
  setMessage(warningMsg, contrastWarning());

  const data = buildPayload();
  if (!data) return;

  generateBtn.disabled = true;
  generateBtn.textContent = "Generating…";

  const body = { data, ...currentSettings() };
  if (logoDataUrl) body.logo = logoDataUrl;

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const err = await response.json();
        if (err.error) message = err.error;
      } catch (_) {
        /* non-JSON error body */
      }
      throw new Error(message);
    }

    currentBlob = await response.blob();
    currentFormat = body.format;
    if (qrImage.src) URL.revokeObjectURL(qrImage.src);
    qrImage.src = URL.createObjectURL(currentBlob);
    qrImage.classList.remove("hidden");
    placeholder.classList.add("hidden");
    qrContainer.classList.add("has-qr");
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
    linkBtn.disabled = false;
  } catch (err) {
    setMessage(errorMsg, err.message);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate";
  }
});

/* ---------- actions ---------- */

function flash(btn, text) {
  const original = btn.lastChild.textContent;
  btn.lastChild.textContent = text;
  setTimeout(() => (btn.lastChild.textContent = original), 1500);
}

copyBtn.addEventListener("click", async () => {
  if (!currentBlob) return;
  try {
    if (currentFormat === "svg") {
      await navigator.clipboard.writeText(await currentBlob.text());
    } else {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": currentBlob }),
      ]);
    }
    flash(copyBtn, " Copied!");
  } catch (err) {
    setMessage(errorMsg, "Copying is not supported in this browser. Use Download instead.");
  }
});

downloadBtn.addEventListener("click", () => {
  if (!currentBlob) return;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(currentBlob);
  link.download = `qr-code.${currentFormat}`;
  link.click();
  URL.revokeObjectURL(link.href);
});

linkBtn.addEventListener("click", async () => {
  const data = buildPayload();
  if (!data) return;
  const params = new URLSearchParams({ data, ...currentSettings() });
  const url = `${location.origin}/api/generate?${params}`;
  try {
    await navigator.clipboard.writeText(url);
    flash(linkBtn, " Link copied!");
  } catch (err) {
    setMessage(errorMsg, "Could not copy the link to the clipboard.");
  }
});
