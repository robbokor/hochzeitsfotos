import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, MAX_PHOTOS_PER_GAST } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "photos";

const NAME_KEY = "hochzeitsfotos_gastname";

const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("name-input");
const nameCard = document.getElementById("name-card");
const uploadCard = document.getElementById("upload-card");
const doneCard = document.getElementById("done-card");
const counterNum = document.getElementById("counter-num");
const fileInput = document.getElementById("file-input");
const fileLabel = document.getElementById("file-label");
const uploadList = document.getElementById("upload-list");
const changeNameBtn = document.getElementById("change-name-btn");
const messageBox = document.getElementById("message-box");
const greeting = document.getElementById("greeting");

let normalizedName = null;
let displayName = null;
let remaining = MAX_PHOTOS_PER_GAST;
let busy = false;

function normalizeName(raw) {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function showMessage(text, type) {
  messageBox.textContent = text;
  messageBox.className = "message " + type;
  messageBox.classList.remove("hidden");
}

function clearMessage() {
  messageBox.classList.add("hidden");
}

function updateCounterUI() {
  counterNum.textContent = Math.max(remaining, 0);
  if (remaining <= 0) {
    uploadCard.classList.add("hidden");
    doneCard.classList.remove("hidden");
  } else {
    uploadCard.classList.remove("hidden");
    doneCard.classList.add("hidden");
  }
}

async function loadRemainingForName(name) {
  const { data, error } = await supabase.rpc("get_remaining", { p_name: name });
  if (error) throw error;
  return data;
}

async function startForName(raw) {
  clearMessage();
  displayName = raw.trim();
  normalizedName = normalizeName(raw);
  if (!normalizedName) {
    showMessage("Bitte gib deinen Namen ein.", "error");
    return;
  }
  localStorage.setItem(NAME_KEY, displayName);
  try {
    remaining = await loadRemainingForName(normalizedName);
  } catch (err) {
    console.error(err);
    showMessage("Verbindung fehlgeschlagen. Bitte prüfe dein Internet und versuche es erneut.", "error");
    return;
  }
  greeting.textContent = `Hallo ${displayName}!`;
  nameCard.classList.add("hidden");
  updateCounterUI();
}

nameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  startForName(nameInput.value);
});

changeNameBtn.addEventListener("click", () => {
  normalizedName = null;
  nameCard.classList.remove("hidden");
  uploadCard.classList.add("hidden");
  doneCard.classList.add("hidden");
  clearMessage();
});

const saved = localStorage.getItem(NAME_KEY);
if (saved) nameInput.value = saved;

function compressImage(file, maxDim = 1920, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Komprimierung fehlgeschlagen"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bild konnte nicht gelesen werden"));
    };
    img.src = url;
  });
}

async function uploadOne(file) {
  const row = document.createElement("div");
  row.className = "upload-item";
  const thumb = document.createElement("img");
  thumb.className = "thumb";
  const status = document.createElement("span");
  status.className = "status";
  status.textContent = "Komprimiere…";
  row.appendChild(thumb);
  row.appendChild(status);
  uploadList.prepend(row);

  const fileName = `${normalizedName}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  let uploaded = false;

  try {
    const compressed = await compressImage(file);
    thumb.src = URL.createObjectURL(compressed);

    status.textContent = "Lädt hoch…";
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, compressed, { contentType: "image/jpeg" });
    if (uploadError) throw uploadError;
    uploaded = true;

    status.textContent = "Reserviere Platz…";
    const { data: newCount, error: rpcError } = await supabase.rpc("submit_photo", {
      p_name: normalizedName,
      p_display_name: displayName,
      p_storage_path: fileName
    });

    if (rpcError) {
      if (rpcError.message && rpcError.message.includes("LIMIT_REACHED")) {
        status.textContent = "Limit erreicht";
        row.classList.add("error");
        remaining = 0;
        updateCounterUI();
        await supabase.storage.from(BUCKET).remove([fileName]);
        return false;
      }
      throw rpcError;
    }

    remaining = MAX_PHOTOS_PER_GAST - newCount;
    updateCounterUI();

    status.textContent = "Fertig";
    row.classList.add("done");
    return true;
  } catch (err) {
    console.error(err);
    status.textContent = "Fehlgeschlagen";
    row.classList.add("error");
    if (uploaded) {
      await supabase.storage.from(BUCKET).remove([fileName]);
    }
    return false;
  }
}

fileInput.addEventListener("change", async () => {
  clearMessage();
  const file = fileInput.files && fileInput.files[0];
  fileInput.value = "";
  if (!file || busy) return;

  if (remaining <= 0) {
    showMessage("Du hast dein Kontingent von 20 Fotos aufgebraucht.", "error");
    return;
  }

  busy = true;
  fileLabel.classList.add("hidden");
  await uploadOne(file);
  fileLabel.classList.remove("hidden");
  busy = false;
});
