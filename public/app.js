let tracksData = [];
let currentlyPlayingKey = null;

// DOM Elements
const audio = document.getElementById('nativeAudio');
const playBtn = document.getElementById('playBtn');
const seekSlider = document.getElementById('seekSlider');
const volumeSlider = document.getElementById('volumeSlider');
const currentTimeDisplay = document.getElementById('currentTimeDisplay');
const durationDisplay = document.getElementById('durationDisplay');
const nowPlayingTitle = document.getElementById('nowPlayingTitle');
const nowPlayingArtist = document.getElementById('nowPlayingArtist');
const trackTableBody = document.getElementById('trackTableBody');
const trackCounter = document.getElementById('trackCounter');
const statusBanner = document.getElementById('statusBanner');

// Init
window.addEventListener('DOMContentLoaded', () => {
  loadTracks();
  setupAudioEvents();
});

// Load tracks from Cloudflare Worker / D1 API
async function loadTracks() {
  try {
    const res = await fetch('/api/tracks');
    if (!res.ok) throw new Error('API request failed');
    tracksData = await res.json();
    renderTracks(tracksData);
  } catch (err) {
    showBanner(`Failed to load tracks from D1: ${err.message}`, 'error');
  }
}

function renderTracks(tracks) {
  trackTableBody.innerHTML = '';
  trackCounter.innerText = `${tracks.length} track${tracks.length === 1 ? '' : 's'} stored in Cloudflare D1 & R2`;

  if (tracks.length === 0) {
    trackTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: #777; padding: 48px;">
          <p style="font-size: 16px; margin-bottom: 8px;">No audio tracks in library yet.</p>
          <p style="font-size: 13px;">Click <strong>"+ Upload Audio"</strong> to store your first MP3 file in Cloudflare R2!</p>
        </td>
      </tr>
    `;
    return;
  }

  tracks.forEach((track, index) => {
    const isPlaying = currentlyPlayingKey === track.r2_key && !audio.paused;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>
        <div class="track-main-cell">
          <button class="action-btn" onclick="startPlayback('${escapeHtml(track.r2_key)}', '${escapeHtml(track.title)}', '${escapeHtml(track.artist)}')">
            ${isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <strong>${escapeHtml(track.title)}</strong>
        </div>
      </td>
      <td>${escapeHtml(track.artist)}</td>
      <td><span class="genre-pill">${escapeHtml(track.genre || 'Audio')}</span></td>
      <td>
        <button class="action-btn" onclick="openEditModal(${track.id}, '${escapeHtml(track.title)}', '${escapeHtml(track.artist)}', '${escapeHtml(track.genre)}')">✏️ Edit</button>
        <button class="action-btn action-delete" onclick="deleteTrack(${track.id})">🗑️ Delete</button>
      </td>
    `;
    trackTableBody.appendChild(tr);
  });
}

// Audio Playback
function startPlayback(r2Key, title, artist) {
  if (currentlyPlayingKey === r2Key) {
    togglePlayback();
    return;
  }

  currentlyPlayingKey = r2Key;
  nowPlayingTitle.innerText = title;
  nowPlayingArtist.innerText = artist;
  audio.src = `/api/stream/${encodeURIComponent(r2Key)}`;
  audio.play();
  playBtn.innerText = '⏸';
  renderTracks(tracksData);
}

function togglePlayback() {
  if (!audio.src) {
    if (tracksData.length > 0) {
      startPlayback(tracksData[0].r2_key, tracksData[0].title, tracksData[0].artist);
    }
    return;
  }

  if (audio.paused) {
    audio.play();
    playBtn.innerText = '⏸';
  } else {
    audio.pause();
    playBtn.innerText = '▶';
  }
  renderTracks(tracksData);
}

function setupAudioEvents() {
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const progress = (audio.currentTime / audio.duration) * 100;
    seekSlider.value = progress;
    currentTimeDisplay.innerText = formatDuration(audio.currentTime);
    durationDisplay.innerText = formatDuration(audio.duration);
  });

  audio.addEventListener('ended', () => {
    playBtn.innerText = '▶';
    renderTracks(tracksData);
  });

  audio.addEventListener('play', () => {
    playBtn.innerText = '⏸';
    renderTracks(tracksData);
  });

  audio.addEventListener('pause', () => {
    playBtn.innerText = '▶';
    renderTracks(tracksData);
  });
}

function handleSeek() {
  if (!audio.duration) return;
  audio.currentTime = (seekSlider.value / 100) * audio.duration;
}

function handleVolume() {
  audio.volume = volumeSlider.value;
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Upload Audio to R2 + D1 (CREATE)
async function submitUpload(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('uploadSubmitBtn');
  submitBtn.innerText = 'Streaming to R2 & D1...';
  submitBtn.disabled = true;

  const fileInput = document.getElementById('audioFileInput');
  if (!fileInput.files.length) {
    alert('Please select an audio file.');
    submitBtn.disabled = false;
    submitBtn.innerText = 'Upload to R2 & Save to D1';
    return;
  }

  const formData = new FormData();
  formData.append('title', document.getElementById('trackTitle').value);
  formData.append('artist', document.getElementById('trackArtist').value);
  formData.append('genre', document.getElementById('trackGenre').value);
  formData.append('file', fileInput.files[0]);

  try {
    const res = await fetch('/api/tracks', { method: 'POST', body: formData });
    const data = await res.json();

    if (res.ok && data.success) {
      closeUploadModal();
      document.getElementById('uploadForm').reset();
      showBanner(`Track successfully uploaded to Cloudflare R2 and indexed in D1!`, 'success');
      await loadTracks();
    } else {
      showBanner(`Upload failed: ${data.error || 'Unknown error'}`, 'error');
    }
  } catch (err) {
    showBanner(`Upload error: ${err.message}`, 'error');
  } finally {
    submitBtn.innerText = 'Upload to R2 & Save to D1';
    submitBtn.disabled = false;
  }
}

// Edit Track Metadata (UPDATE)
function openEditModal(id, title, artist, genre) {
  document.getElementById('editTrackId').value = id;
  document.getElementById('editTitle').value = title;
  document.getElementById('editArtist').value = artist;
  document.getElementById('editGenre').value = genre;
  document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

async function submitEdit(e) {
  e.preventDefault();
  const id = document.getElementById('editTrackId').value;
  const payload = {
    title: document.getElementById('editTitle').value,
    artist: document.getElementById('editArtist').value,
    genre: document.getElementById('editGenre').value,
  };

  try {
    const res = await fetch(`/api/tracks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      closeEditModal();
      showBanner('Track metadata successfully updated in Cloudflare D1!', 'success');
      await loadTracks();
    } else {
      showBanner('Failed to update track', 'error');
    }
  } catch (err) {
    showBanner(`Update error: ${err.message}`, 'error');
  }
}

// Delete Track (DELETE)
async function deleteTrack(id) {
  if (!confirm('Are you sure you want to delete this track from Cloudflare D1 and R2?')) {
    return;
  }

  try {
    const res = await fetch(`/api/tracks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (currentlyPlayingKey) {
        audio.pause();
        audio.src = '';
        currentlyPlayingKey = null;
        nowPlayingTitle.innerText = 'No track selected';
        nowPlayingArtist.innerText = '—';
      }
      showBanner('Track deleted from Cloudflare D1 database and R2 storage.', 'success');
      await loadTracks();
    } else {
      showBanner('Failed to delete track', 'error');
    }
  } catch (err) {
    showBanner(`Delete error: ${err.message}`, 'error');
  }
}

// Search
function handleSearch() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const filtered = tracksData.filter(t =>
    t.title.toLowerCase().includes(q) ||
    t.artist.toLowerCase().includes(q) ||
    (t.genre && t.genre.toLowerCase().includes(q))
  );
  renderTracks(filtered);
}

// Modals & Helpers
function openUploadModal() {
  document.getElementById('uploadModal').style.display = 'flex';
}

function closeUploadModal() {
  document.getElementById('uploadModal').style.display = 'none';
}

function showBanner(message, type) {
  statusBanner.innerText = message;
  statusBanner.className = `status-banner status-${type}`;
  statusBanner.style.display = 'block';
  setTimeout(() => {
    statusBanner.style.display = 'none';
  }, 4500);
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[m]);
}
