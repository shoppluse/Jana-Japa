// app.js
import { db, storage } from "./firebase-config.js";
import {
  ref as dbRef,
  onValue,
  update,
  push,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ==========================================
// 1. MARATHON CONFIGURATION (Edit dates here)
// ==========================================
const START_DATE = "2026-11-15"; // YYYY-MM-DD
const END_DATE   = "2026-12-25"; // YYYY-MM-DD
const TARGET_COUNT = 20000;
const TEAMS = ["A", "B", "C", "D", "E", "F"];

// Helper: Get local YYYY-MM-DD string
function getTodayKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2500);
}

// ==========================================
// 2. DASHBOARD LOGIC (index.html)
// ==========================================
const totalCountEl = document.getElementById("total-count");
if (totalCountEl) {
  const todayKey = getTodayKey();
  document.getElementById("today-date").textContent = todayKey;
  document.getElementById("target-display").textContent = TARGET_COUNT.toLocaleString();
  document.getElementById("marathon-dates").textContent = `${START_DATE} to ${END_DATE}`;

  // Calculate Day X of Y
  const start = new Date(START_DATE);
  const end = new Date(END_DATE);
  const today = new Date(todayKey);
  const totalDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const currentDay = Math.min(totalDays, Math.max(1, Math.round((today - start) / 86400000) + 1));
  document.getElementById("day-badge").textContent = `Day ${currentDay} of ${totalDays}`;

  // Real-time listener for all teams
  const teamsRef = dbRef(db, "marathon/teams");
  onValue(teamsRef, (snapshot) => {
    const data = snapshot.val() || {};
    let grandTotal = 0;
    let todayTotal = 0;

    const grid = document.getElementById("teams-grid");
    grid.innerHTML = "";

    TEAMS.forEach((team) => {
      const teamData = data[team] || {};
      const teamTotal = Number(teamData.total || 0);
      const teamToday = Number((teamData.daily && teamData.daily[todayKey]) || 0);

      grandTotal += teamTotal;
      todayTotal += teamToday;

      const card = document.createElement("div");
      card.className = "team-card";
      card.innerHTML = `
        <div class="team-card-top">
          <span class="team-name">Team ${team}</span>
          <span class="team-today">+${teamToday} today</span>
        </div>
        <div class="team-total">${teamTotal.toLocaleString()}</div>
      `;
      grid.appendChild(card);
    });

    totalCountEl.textContent = grandTotal.toLocaleString();
    document.getElementById("today-count").textContent = todayTotal.toLocaleString();

    const pct = Math.min(100, ((grandTotal / TARGET_COUNT) * 100)).toFixed(1);
    document.getElementById("progress-fill").style.width = `${pct}%`;
    document.getElementById("progress-percent").textContent = `${pct}%`;
  });

  // Modal & Increment Controls
  const modal = document.getElementById("increment-modal");
  const openBtn = document.getElementById("open-increment");
  const closeBtn = document.getElementById("close-modal");
  const amountInput = document.getElementById("round-amount");
  let selectedTeam = "A";

  if (window.location.hash === "#add") {
    modal.classList.remove("hidden");
  }

  openBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  closeBtn.addEventListener("click", () => modal.classList.add("hidden"));

  document.querySelectorAll(".team-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".team-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedTeam = btn.dataset.team;
    });
  });

  document.getElementById("dec-amt").addEventListener("click", () => {
    amountInput.value = Math.max(1, Number(amountInput.value) - 1);
  });

  document.getElementById("inc-amt").addEventListener("click", () => {
    amountInput.value = Number(amountInput.value) + 1;
  });

  document.getElementById("submit-count").addEventListener("click", async () => {
    const count = Math.max(1, parseInt(amountInput.value, 10) || 1);
    const activeDay = getTodayKey();

    const updates = {};
    updates[`marathon/teams/${selectedTeam}/total`] = increment(count);
    updates[`marathon/teams/${selectedTeam}/daily/${activeDay}`] = increment(count);

    try {
      await update(dbRef(db), updates);
      modal.classList.add("hidden");
      amountInput.value = 1;
      showToast(`+${count} added to Team ${selectedTeam}!`);
    } catch (err) {
      alert("Error updating count: " + err.message);
    }
  });
}

// ==========================================
// 3. ALBUM LOGIC (album.html)
// ==========================================
const albumGrid = document.getElementById("album-grid");
if (albumGrid) {
  const photoInput = document.getElementById("photo-input");
  const teamSelect = document.getElementById("album-team-select");
  const statusEl = document.getElementById("upload-status");

  // Compress image before uploading so mobile uploads are fast
  function compressImage(file, maxWidth = 1080, quality = 0.75) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  photoInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const team = teamSelect.value;
    statusEl.textContent = "Compressing & uploading photo...";

    try {
      const compressedBlob = await compressImage(file);
      const fileName = `marathon/${Date.now()}_team_${team}.jpg`;
      const imgRef = storageRef(storage, fileName);

      await uploadBytes(imgRef, compressedBlob);
      const downloadURL = await getDownloadURL(imgRef);

      await push(dbRef(db, "marathon/album"), {
        team,
        imageUrl: downloadURL,
        timestamp: Date.now()
      });

      statusEl.textContent = "";
      photoInput.value = "";
      showToast("Photo shared with all teams!");
    } catch (err) {
      statusEl.textContent = "Upload failed: " + err.message;
    }
  });

  // Real-time listener for album photos
  const albumRef = dbRef(db, "marathon/album");
  onValue(albumRef, (snapshot) => {
    const data = snapshot.val();
    albumGrid.innerHTML = "";

    if (!data) {
      albumGrid.innerHTML = `<p class="empty-state">No photos yet. Be the first team to share!</p>`;
      return;
    }

    const entries = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
    entries.forEach((item) => {
      const timeStr = new Date(item.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      });

      const card = document.createElement("div");
      card.className = "photo-card";
      card.innerHTML = `
        <img src="${item.imageUrl}" alt="Team ${item.team} chanting" loading="lazy" />
        <div class="photo-meta">
          <span class="photo-team">Team ${item.team}</span>
          <span>${timeStr}</span>
        </div>
      `;
      albumGrid.appendChild(card);
    });
  });
}
