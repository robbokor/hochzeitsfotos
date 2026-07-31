import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = "photos";

const loginCard = document.getElementById("login-card");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const adminArea = document.getElementById("admin-area");
const logoutBtn = document.getElementById("logout-btn");
const tabGallery = document.getElementById("tab-gallery");
const tabQr = document.getElementById("tab-qr");
const galleryView = document.getElementById("gallery-view");
const qrView = document.getElementById("qr-view");
const galleryGrid = document.getElementById("gallery-grid");
const galleryStatus = document.getElementById("gallery-status");
const qrCanvas = document.getElementById("qr-canvas");
const qrUrlText = document.getElementById("qr-url-text");
const printBtn = document.getElementById("print-btn");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = "Anmeldung fehlgeschlagen: " + error.message;
    loginError.classList.remove("hidden");
  }
});

logoutBtn.addEventListener("click", () => supabase.auth.signOut());

async function refreshUI() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    loginCard.classList.add("hidden");
    adminArea.classList.remove("hidden");
    loadGallery();
    renderQr();
  } else {
    loginCard.classList.remove("hidden");
    adminArea.classList.add("hidden");
  }
}

supabase.auth.onAuthStateChange(() => refreshUI());
refreshUI();

function switchTab(name) {
  galleryView.classList.toggle("hidden", name !== "gallery");
  qrView.classList.toggle("hidden", name !== "qr");
  tabGallery.classList.toggle("active", name === "gallery");
  tabQr.classList.toggle("active", name === "qr");
}
tabGallery.addEventListener("click", () => switchTab("gallery"));
tabQr.addEventListener("click", () => switchTab("qr"));

async function loadGallery() {
  galleryStatus.textContent = "Lädt…";
  galleryGrid.innerHTML = "";
  try {
    const { data, error } = await supabase
      .from("photos")
      .select("id, guest_name, storage_path, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!data || data.length === 0) {
      galleryStatus.textContent = "Noch keine Fotos hochgeladen.";
      return;
    }

    galleryStatus.textContent = `${data.length} Foto(s)`;
    data.forEach((photo) => {
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(photo.storage_path);
      const cell = document.createElement("div");
      cell.className = "gallery-cell";
      const link = document.createElement("a");
      link.href = urlData.publicUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.title = "Antippen für Originalgröße zum Sichern";
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = urlData.publicUrl;
      img.title = photo.guest_name || "";
      link.appendChild(img);
      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.textContent = "✕";
      delBtn.title = "Foto löschen";
      delBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        deletePhoto(photo);
      });
      cell.appendChild(link);
      cell.appendChild(delBtn);
      galleryGrid.appendChild(cell);
    });
  } catch (err) {
    console.error(err);
    galleryStatus.textContent = "Fehler beim Laden: " + err.message;
  }
}

async function deletePhoto(photo) {
  if (!confirm(`Foto von ${photo.guest_name} wirklich löschen?`)) return;
  try {
    await supabase.storage.from(BUCKET).remove([photo.storage_path]);
    const { error } = await supabase.from("photos").delete().eq("id", photo.id);
    if (error) throw error;
    loadGallery();
  } catch (err) {
    console.error(err);
    alert("Löschen fehlgeschlagen: " + err.message);
  }
}

function renderQr() {
  const url = window.location.origin + "/";
  qrUrlText.textContent = url;
  qrCanvas.innerHTML = "";
  // eslint-disable-next-line no-undef
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  qrCanvas.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 4 });
}

printBtn.addEventListener("click", () => window.print());
