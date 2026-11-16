// app.js
import { db } from "./firebase-config.js";
import {
  ref as dbRef,
  onValue,
  update,
  push,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ==========================================
// 1. MARATHON CONFIGURATION (Edit dates here)
// ==========================================
const START_DATE = "2026-11-15"; // YYYY-MM-DD
const END_DATE   = "2027-01-31"; // YYYY-MM-DD
const TARGET_COUNT = 20000;
const TEAMS = ["A", "B", "C", "D", "E", "F"];
const BOOK_TYPES = ["S", "M", "B", "MB"];

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

  const start = new Date(START_DATE);
  const end = new Date(END_DATE);
  const today = new Date(todayKey);
  const totalDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const currentDay = Math.min(totalDays, Math.max(1, Math.round((today - start) / 86400000) + 1));
  document.getElementById("day-badge").textContent = `Day ${currentDay} of ${totalDays}`;

  const teamsRef = dbRef(db, "marathon/teams");
  onValue(teamsRef, (snapshot) => {
    const data = snapshot.val() || {};
    let grandTotal = 0;
    let todayTotal = 0;
    let grandBooksTotal = 0;
    let todayBooksTotal = 0;

    const grid = document.getElementById("teams-grid");
    grid.innerHTML = "";

    TEAMS.forEach((team) => {
      const teamData = data[team] || {};
      const teamTotal = Number(teamData.total || 0);
      const teamToday = Number((teamData.daily && teamData.daily[todayKey]) || 0);

      grandTotal += teamTotal;
      todayTotal += teamToday;

      // Book counts for S, M, B, MB
      const booksTotalObj = (teamData.books && teamData.books.total) || {};
      const booksDailyObj = (teamData.books && teamData.books.daily && teamData.books.daily[todayKey]) || {};

      BOOK_TYPES.forEach((type) => {
        grandBooksTotal += Number(booksTotalObj[type] || 0);
        todayBooksTotal += Number(booksDailyObj[type] || 0);
      });

      const todayCells = BOOK_TYPES.map((type) => `<td class="today-val">${Number(booksDailyObj[type] || 0)}</td>`).join("");
      const totalCells = BOOK_TYPES.map((type) => `<td class="total-val">${Number(booksTotalObj[type] || 0)}</td>`).join("");

      const card = document.createElement("div");
      card.className = "team-row-card";
      card.innerHTML = `
        <div class="team-japa-side">
          <div class="team-title-row">
            <span class="team-name">Team ${team}</span>
            <span class="team-today">+${teamToday} today</span>
          </div>
          <div class="team-total">${teamTotal.toLocaleString()}</div>
        </div>

        <table class="books-table">
          <thead>
            <tr>
              <th class="row-label">Books</th>
              <th>S</th>
              <th>M</th>
              <th>B</th>
              <th>MB</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="row-label">Today</td>
              ${todayCells}
            </tr>
            <tr>
              <td class="row-label">Total</td>
              ${totalCells}
            </tr>
          </tbody>
        </table>
      `;
      grid.appendChild(card);
    });

    totalCountEl.textContent = grandTotal.toLocaleString();
    document.getElementById("today-count").textContent = todayTotal.toLocaleString();

    const totalBooksEl = document.getElementById("total-books-count");
    const todayBooksEl = document.getElementById("today-books-count");
    if (totalBooksEl) totalBooksEl.textContent = grandBooksTotal.toLocaleString();
    if (todayBooksEl) todayBooksEl.textContent = todayBooksTotal.toLocaleString();

    const pct = Math.min(100, ((grandTotal / TARGET_COUNT) * 100)).toFixed(1);
    document.getElementById("progress-fill").style.width = `${pct}%`;
    document.getElementById("progress-percent").textContent = `${pct}%`;
  });

  // --- Japa Modal Controls ---
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
      showToast(`+${count} Japa added to Team ${selectedTeam}!`);
    } catch (err) {
      alert("Error updating count: " + err.message);
    }
  });

  // --- Books Modal Controls ---
  const bookModal = document.getElementById("book-modal");
  const openBookBtn = document.getElementById("open-book-modal");
  const closeBookBtn = document.getElementById("close-book-modal");
  const bookAmountInput = document.getElementById("book-amount");
  let selectedBookTeam = "A";
  let selectedBookType = "S";

  if (window.location.hash === "#books") {
    bookModal.classList.remove("hidden");
  }

  openBookBtn.addEventListener("click", () => bookModal.classList.remove("hidden"));
  closeBookBtn.addEventListener("click", () => bookModal.classList.add("hidden"));

  document.querySelectorAll(".book-team-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".book-team-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedBookTeam = btn.dataset.team;
    });
  });

  document.querySelectorAll(".book-type-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".book-type-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedBookType = btn.dataset.book;
    });
  });

  document.getElementById("dec-book-amt").addEventListener("click", () => {
    bookAmountInput.value = Math.max(1, Number(bookAmountInput.value) - 1);
  });

  document.getElementById("inc-book-amt").addEventListener("click", () => {
    bookAmountInput.value = Number(bookAmountInput.value) + 1;
  });

  document.getElementById("submit-book-count").addEventListener("click", async () => {
    const qty = Math.max(1, parseInt(bookAmountInput.value, 10) || 1);
    const activeDay = getTodayKey();

    const updates = {};
    updates[`marathon/teams/${selectedBookTeam}/books/total/${selectedBookType}`] = increment(qty);
    updates[`marathon/teams/${selectedBookTeam}/books/daily/${activeDay}/${selectedBookType}`] = increment(qty);

    try {
      await update(dbRef(db), updates);
      bookModal.classList.add("hidden");
      bookAmountInput.value = 1;
      showToast(`+${qty} ${selectedBookType} book(s) added to Team ${selectedBookTeam}!`);
    } catch (err) {
      alert("Error updating books: " + err.message);
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

  function compressToDataURL(file, maxWidth = 720, quality = 0.65) {
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
          resolve(canvas.toDataURL("image/jpeg", quality));
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
    statusEl.textContent = "Compressing & sharing photo...";

    try {
      const compressedDataUrl = await compressToDataURL(file);

      await push(dbRef(db, "marathon/album"), {
        team,
        imageUrl: compressedDataUrl,
        timestamp: Date.now()
      });

      statusEl.textContent = "";
      photoInput.value = "";
      showToast("Photo shared with all teams!");
    } catch (err) {
      statusEl.textContent = "Upload failed: " + err.message;
    }
  });

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

// ==========================================
// 4. JOIN COMMUNITY LOGIC (community.html)
// ==========================================
const qrSwipeArea = document.getElementById("qr-swipe-area");
if (qrSwipeArea) {
  const COMMUNITIES = [
    {
      title: "ISKCON Mysore - Harinam Japa ಹರೇ ಕೃಷ್ಣ",
      image: "image1.png",
      points: [
        "Daily Japa chanting updates and marathon sankalpa reminders.",
        "Connect with devotees chanting together across Mysuru.",
        "Share inspiring photos and daily round milestones.",
        "Open WhatsApp camera and scan the QR code above to join."
      ]
    },
    {
      title: "Krishna Connect - Youth | ISKCON Mysore",
      image: "image2.png",
      points: [
        "Weekly youth spiritual sessions, kirtans, and Gita discussions.",
        "Stay updated on ISKCON Mysore youth festivals and retreats.",
        "Collaborate in Book Marathon seva and campus outreach.",
        "Open WhatsApp camera and scan the QR code above to join."
      ]
    }
  ];

  const badgeEl = document.getElementById("community-badge");
  const titleEl = document.getElementById("community-title");
  const imgEl = document.getElementById("community-qr-img");
  const pointsEl = document.getElementById("community-points");
  const dots = document.querySelectorAll(".qr-dot");
  let activeSlide = 0;

  function renderCommunitySlide(idx) {
    activeSlide = (idx + COMMUNITIES.length) % COMMUNITIES.length;
    const item = COMMUNITIES[activeSlide];

    badgeEl.textContent = `${activeSlide + 1} of ${COMMUNITIES.length}`;
    titleEl.textContent = item.title;
    imgEl.src = item.image;
    pointsEl.innerHTML = item.points.map((pt) => `<li>${pt}</li>`).join("");

    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === activeSlide);
    });
  }

  document.getElementById("qr-prev").addEventListener("click", () => {
    renderCommunitySlide(activeSlide - 1);
  });

  document.getElementById("qr-next").addEventListener("click", () => {
    renderCommunitySlide(activeSlide + 1);
  });

  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      renderCommunitySlide(Number(dot.dataset.index));
    });
  });

  let startX = 0;
  qrSwipeArea.addEventListener("touchstart", (e) => {
    startX = e.changedTouches[0].screenX;
  }, { passive: true });

  qrSwipeArea.addEventListener("touchend", (e) => {
    const diff = startX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 40) {
      renderCommunitySlide(diff > 0 ? activeSlide + 1 : activeSlide - 1);
    }
  }, { passive: true });
}
