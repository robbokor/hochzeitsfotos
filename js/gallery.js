import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "photos";

const grid = document.getElementById("gallery-grid");
const status = document.getElementById("gallery-status");

async function loadGallery() {
  status.textContent = "Lädt…";
  grid.innerHTML = "";
  try {
    const { data, error } = await supabase
      .from("photos")
      .select("guest_name, storage_path, created_at")
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
      a.href = urlData.publicUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = photo.guest_name || "";
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = urlData.publicUrl;
      a.appendChild(img);
      grid.appendChild(a);
    });
  } catch (err) {
    console.error(err);
    status.textContent = "Fehler beim Laden: " + err.message;
  }
}

loadGallery();
