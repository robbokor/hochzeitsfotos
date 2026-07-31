import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "photos";

const grid = document.getElementById("gallery-grid");
const status = document.getElementById("gallery-status");

// Leichte, aber stabile "Zufalls"-Neigung pro Foto (gleiches Foto = gleicher Winkel
// bei jedem Laden, kein Springen beim Neuladen der Seite).
function tiltFor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const degrees = (Math.abs(hash) % 70) / 10 - 3.5; // -3.5° bis +3.5°
  return degrees;
}

async function loadGallery() {
  status.textContent = "Lädt…";
  grid.innerHTML = "";
  try {
    const { data, error } = await supabase
      .from("photos")
      .select("guest_name, storage_path, created_at, kind, challenge")
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!data || data.length === 0) {
      status.textContent = "Noch keine Fotos hochgeladen.";
      return;
    }

    status.textContent = `${data.length} Foto(s)`;
    data.forEach((photo) => {
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(photo.storage_path);
      const a = document.createElement("a");
      a.className = "photo-card";
      a.href = urlData.publicUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = photo.guest_name || "";
      a.style.setProperty("--tilt", `${tiltFor(photo.storage_path)}deg`);
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = urlData.publicUrl;
      a.appendChild(img);
      if (photo.kind === "challenge" && photo.challenge) {
        const caption = document.createElement("span");
        caption.className = "challenge-caption";
        caption.textContent = `🎯 ${photo.challenge}`;
        a.appendChild(caption);
      }
      grid.appendChild(a);
    });
  } catch (err) {
    console.error(err);
    status.textContent = "Fehler beim Laden: " + err.message;
  }
}

loadGallery();
