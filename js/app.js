import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, MAX_PHOTOS_PER_GAST } from "./supabase-config.js";
import { CHALLENGES, MAX_CHALLENGE_PHOTOS } from "./challenges-config.js";

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
const actionsDiv = document.getElementById("actions");

const challengeSection = document.getElementById("challenge-section");
const challengeToggleBtn = document.getElementById("challenge-toggle-btn");
const challengeSkipBtn = document.getElementById("challenge-skip-btn");
const challengeCard = document.getElementById("challenge-card");
const challengeDoneCard = document.getElementById("challenge-done-card");
const challengeCounterNum = document.getElementById("challenge-counter-num");
const challengeText = document.getElementById("challenge-text");
const challengeFileInput = document.getElementById("challenge-file-input");
const challengeFileLabel = document.getElementById("challenge-file-label");
const challengeUploadList = document.getElementById("challenge-upload-list");

let normalizedName = null;
let displayName = null;
let remaining = MAX_PHOTOS_PER_GAST;
let challengeRemaining = MAX_CHALLENGE_PHOTOS;
let currentChallenge = null;
let doneChallenges = new Set();
let busy = false;
let challengeBusy = false;

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

function pickNextChallenge() {
  const unused = CHALLENGES.filter((c) => !doneChallenges.has(c));
  const pool = unused.length > 0 ? unused : CHALLENGES;
  currentChallenge = pool[Math.floor(Math.random() * pool.length)];
  challengeText.textContent = currentChallenge;
}

function updateChallengeUI() {
  challengeCounterNum.textContent = Math.max(challengeRemaining, 0);
  if (challengeRemaining <= 0) {
    challengeCard.classList.add("hidden");
    challengeDoneCard.classList.remove("hidden");
  } else {
    challengeCard.classList.remove("hidden");
    challengeDoneCard.classList.add("hidden");
    pickNextChallenge();
  }
}

async function loadRemaining(name, kind) {
  const { data, error } = await supabase.rpc("get_remaining", { p_name: name, p_kind: kind });
  if (error) throw error;
  return data;
}

async function loadDoneChallenges(name) {
  const { data, error } = await supabase
    .from("photos")
    .select("challenge")
    .eq("normalized_name", name)
    .eq("kind", "challenge");
  if (error) throw error;
  return new Set((data || []).map((row) => row.challenge).filter(Boolean));
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
    remaining = await loadRemaining(normalizedName, "normal");
    challengeRemaining = await loadRemaining(normalizedName, "challenge");
    doneChallenges = await loadDoneChallenges(normalizedName);
  } catch (err) {
    console.error(err);
    showMessage("Verbindung fehlgeschlagen. Bitte prüfe dein Internet und versuche es erneut.", "error");
    return;
  }
  greeting.textContent = `Hallo ${displayName}!`;
  nameCard.classList.add("hidden");
  actionsDiv.classList.remove("hidden");
  updateCounterUI();
  updateChallengeUI();
}

nameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  startForName(nameInput.value);
});

changeNameBtn.addEventListener("click", () => {
  normalizedName = null;
  greeting.textContent = "";
  nameCard.classList.remove("hidden");
  actionsDiv.classList.add("hidden");
  uploadCard.classList.add("hidden");
  doneCard.classList.add("hidden");
  challengeSection.classList.add("hidden");
  clearMessage();
});

challengeToggleBtn.addEventListener("click", () => {
  challengeSection.classList.toggle("hidden");
});

challengeSkipBtn.addEventListener("click", () => {
  pickNextChallenge();
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

async function uploadOne(file, { kind, challenge, targetList }) {
  const row = document.createElement("div");
  row.className = "upload-item";
  const thumb = document.createElement("img");
  thumb.className = "thumb";
  const status = document.createElement("span");
  status.className = "status";
  status.textContent = "Komprimiere…";
  row.appendChild(thumb);
  row.appendChild(status);
  targetList.prepend(row);

  const prefix = kind === "challenge" ? "challenge-" : "";
  const fileName = `${normalizedName}/${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
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
      p_storage_path: fileName,
      p_kind: kind,
      p_challenge: challenge || null
    });

    if (rpcError) {
      if (rpcError.message && rpcError.message.includes("LIMIT_REACHED")) {
        status.textContent = "Limit erreicht";
        row.classList.add("error");
        if (kind === "challenge") {
          challengeRemaining = 0;
          updateChallengeUI();
        } else {
          remaining = 0;
          updateCounterUI();
        }
        await supabase.storage.from(BUCKET).remove([fileName]);
        return false;
      }
      throw rpcError;
    }

    if (kind === "challenge") {
      challengeRemaining = MAX_CHALLENGE_PHOTOS - newCount;
      if (challenge) doneChallenges.add(challenge);
      updateChallengeUI();
    } else {
      remaining = MAX_PHOTOS_PER_GAST - newCount;
      updateCounterUI();
    }

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
  await uploadOne(file, { kind: "normal", targetList: uploadList });
  fileLabel.classList.remove("hidden");
  busy = false;
});

challengeFileInput.addEventListener("change", async () => {
  clearMessage();
  const file = challengeFileInput.files && challengeFileInput.files[0];
  challengeFileInput.value = "";
  if (!file || challengeBusy) return;

  if (challengeRemaining <= 0) {
    showMessage(`Du hast dein Challenge-Kontingent von ${MAX_CHALLENGE_PHOTOS} Fotos aufgebraucht.`, "error");
    return;
  }

  challengeBusy = true;
  challengeFileLabel.classList.add("hidden");
  await uploadOne(file, { kind: "challenge", challenge: currentChallenge, targetList: challengeUploadList });
  challengeFileLabel.classList.remove("hidden");
  challengeBusy = false;
});
