function toggleMobileMenu() {
  document.querySelector('.nav-links').classList.toggle('active');
}

let audioContext = null;
let audioQueue = [];
let isPlaying = false;
let nextPlayTime = 0;
let currentBroadcasterId = null;
let wsConnection = null;
let reconnectTimer = null;
let lastAudioTime = 0;
let audioSilenceTimer = null;

async function init() {
  await loadBroadcasters();

  const params = new URLSearchParams(window.location.search);
  const broadcasterId = params.get('broadcaster');
  if (broadcasterId) {
    listenToBroadcaster(broadcasterId);
  }

  setInterval(loadBroadcasters, 5000);
  checkAudioContext();
}

function checkAudioContext() {
  setInterval(() => {
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
  }, 2000);
}

async function loadBroadcasters() {
  if (currentBroadcasterId) {
    return;
  }
  try {
    const res = await fetch('/api/live');
    const data = await res.json();
    const container = document.getElementById('broadcastersList');
    const noBroadcasts = document.getElementById('noBroadcasts');

    if (data.broadcasters.length === 0) {
      container.style.display = 'none';
      noBroadcasts.style.display = 'block';
      return;
    }

    container.style.display = 'grid';
    noBroadcasts.style.display = 'none';

    container.innerHTML = data.broadcasters.map(b => `
      <div class="broadcaster-card" id="card-${b.id}">
        <div class="broadcaster-avatar">
          ${b.display_name ? b.display_name.charAt(0).toUpperCase() : 'R'}
        </div>
        <div class="broadcaster-info">
          <h3>${b.display_name || b.username}</h3>
          <p><i class="fas fa-map-marker-alt"></i> ${b.location || 'Unknown location'}</p>
          <p><i class="fas fa-headphones"></i> ${b.listeners} listening now</p>
        </div>
        <button onclick="listenToBroadcaster('${b.id}')" class="btn btn-primary">
          <i class="fas fa-play"></i> Listen
        </button>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading broadcasters:', error);
  }
}

async function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  return audioContext;
}

async function listenToBroadcaster(broadcasterId) {
  if (currentBroadcasterId === broadcasterId) {
    return;
  }

  if (currentBroadcasterId) {
    stopListening(currentBroadcasterId);
  }

  try {
    const res = await fetch('/api/live');
    const data = await res.json();
    const broadcaster = data.broadcasters.find(b => b.id == broadcasterId);

    if (!broadcaster) {
      alert('Broadcaster not found or offline');
      return;
    }

    currentBroadcasterId = broadcasterId;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsConnection = new WebSocket(`${protocol}//${window.location.host}?type=listener&broadcasterId=${broadcasterId}`);
    wsConnection.binaryType = 'arraybuffer';

    await ensureAudioContext();
    nextPlayTime = 0;
    audioQueue = [];
    isPlaying = true;
    lastAudioTime = Date.now();

    const playerHtml = `
      <div class="player-container" id="player-${broadcasterId}">
        <div class="player-header">
          <div class="player-broadcaster">
            <div class="broadcaster-avatar small">
              ${broadcaster.display_name ? broadcaster.display_name.charAt(0).toUpperCase() : 'R'}
            </div>
            <div>
              <h3>${broadcaster.display_name || broadcaster.username}</h3>
              <p><i class="fas fa-map-marker-alt"></i> ${broadcaster.location || 'Unknown location'}</p>
            </div>
          </div>
          <div class="player-controls-group">
            <span class="listener-count"><i class="fas fa-headphones"></i> <span id="listenerCountDisplay">${broadcaster.listeners || 0}</span></span>
            <button onclick="shareBroadcast('${broadcasterId}')" class="btn btn-sm btn-share" title="Share this broadcast">
              <i class="fas fa-share-alt"></i>
            </button>
            <button onclick="stopListening('${broadcasterId}')" class="btn btn-secondary btn-sm">
              <i class="fas fa-times"></i> Stop
            </button>
          </div>
        </div>
        <div class="player-visualizer">
          <canvas id="playerCanvas-${broadcasterId}"></canvas>
        </div>
        <div class="player-controls">
          <div class="now-playing">
            <i class="fas fa-broadcast-tower pulse-dot"></i>
            <span id="nowPlayingStatus">Live</span>
          </div>
          <div class="audio-quality-indicator" id="audioQualityIndicator">
            <i class="fas fa-wifi"></i>
            <span>Connected</span>
          </div>
        </div>
      </div>
    `;

    const container = document.getElementById('broadcastersList');
    const existingPlayer = document.querySelector('.player-container');
    if (existingPlayer) existingPlayer.remove();
    container.insertAdjacentHTML('beforebegin', playerHtml);

    wsConnection.onmessage = (e) => {
      if (typeof e.data === 'string') {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'broadcaster_live') {
            const statusEl = document.getElementById('nowPlayingStatus');
            if (statusEl) statusEl.textContent = 'Live';
          }
          if (msg.type === 'listener_count') {
            const el = document.getElementById('listenerCountDisplay');
            if (el) el.textContent = msg.count;
          }
        } catch (_) {}
        return;
      }

      if (!(e.data instanceof ArrayBuffer)) return;

      lastAudioTime = Date.now();

      try {
        const view = new DataView(e.data);
        const sampleRate = view.getUint32(0, true);
        const numSamples = view.getUint32(4, true);

        if (numSamples <= 0 || numSamples > 65536) return;

        const float32 = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
          const int16 = view.getInt16(8 + i * 2, true);
          float32[i] = int16 / (int16 < 0 ? 0x8000 : 0x7FFF);
        }

        const ctx = audioContext;
        if (!ctx) return;
        const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate || ctx.sampleRate);
        audioBuffer.getChannelData(0).set(float32);

        scheduleBuffer(audioBuffer);
      } catch (err) {
        console.error('Audio decode error:', err);
      }
    };

    wsConnection.onclose = () => {
      if (currentBroadcasterId === broadcasterId) {
        const statusEl = document.getElementById('nowPlayingStatus');
        if (statusEl) statusEl.textContent = 'Disconnected';
        const qualityEl = document.getElementById('audioQualityIndicator');
        if (qualityEl) {
          qualityEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Reconnecting...</span>';
        }
        scheduleReconnect(broadcasterId);
      }
    };

    wsConnection.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    visualizePlayer(broadcasterId);

    startAudioMonitor();

  } catch (error) {
    console.error('Error listening to broadcaster:', error);
    alert('Could not connect to broadcaster');
  }
}

function startAudioMonitor() {
  if (audioSilenceTimer) clearInterval(audioSilenceTimer);
  audioSilenceTimer = setInterval(() => {
    if (!isPlaying) {
      clearInterval(audioSilenceTimer);
      audioSilenceTimer = null;
      return;
    }
    const now = Date.now();
    if (now - lastAudioTime > 3000) {
      const qualityEl = document.getElementById('audioQualityIndicator');
      if (qualityEl) {
        qualityEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Buffering...</span>';
      }
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
      }
    } else {
      const qualityEl = document.getElementById('audioQualityIndicator');
      if (qualityEl && wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        qualityEl.innerHTML = '<i class="fas fa-wifi"></i><span>Connected</span>';
      }
    }
  }, 1000);
}

function scheduleReconnect(broadcasterId) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(async () => {
    if (!currentBroadcasterId) return;
    try {
      const res = await fetch('/api/live');
      const data = await res.json();
      const broadcaster = data.broadcasters.find(b => b.id == broadcasterId);
      if (broadcaster) {
        currentBroadcasterId = null;
        if (wsConnection) {
          wsConnection.onclose = null;
          wsConnection.close();
        }
        listenToBroadcaster(broadcasterId);
      }
    } catch (e) {}
  }, 2000);
}

function scheduleBuffer(audioBuffer) {
  const ctx = audioContext;
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = audioBuffer.duration;

  if (nextPlayTime > now + 0.5) {
    nextPlayTime = now + 0.05;
  }

  if (nextPlayTime < now) {
    if (now - nextPlayTime > 0.1) {
      nextPlayTime = now + 0.02;
    } else {
      nextPlayTime = now;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;

  const gainNode = ctx.createGain();
  gainNode.gain.value = 1;

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  source.start(nextPlayTime);

  nextPlayTime += duration;
}

function stopListening(broadcasterId) {
  const player = document.getElementById(`player-${broadcasterId}`);
  if (player) player.remove();

  isPlaying = false;
  currentBroadcasterId = null;
  audioQueue = [];
  nextPlayTime = 0;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (audioSilenceTimer) {
    clearInterval(audioSilenceTimer);
    audioSilenceTimer = null;
  }

  if (wsConnection) {
    wsConnection.onclose = null;
    wsConnection.close();
    wsConnection = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

function shareBroadcast(broadcasterId) {
  const url = `${window.location.origin}/listen?broadcaster=${broadcasterId}`;
  if (navigator.share) {
    navigator.share({ title: 'FM Radio Live', text: 'Tune in to this live broadcast!', url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => alert('Listen link copied!')).catch(() => {});
  } else {
    prompt('Copy this link to share:', url);
  }
}

function visualizePlayer(broadcasterId) {
  const canvas = document.getElementById(`playerCanvas-${broadcasterId}`);
  if (!canvas) return;

  canvas.width = canvas.offsetWidth * 2;
  canvas.height = canvas.offsetHeight * 2;

  const ctx = canvas.getContext('2d');
  const bars = 64;

  function draw() {
    if (!isPlaying) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    requestAnimationFrame(draw);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bars) - 2;
    const time = Date.now() / 1000;

    for (let i = 0; i < bars; i++) {
      const barHeight = (Math.sin(time * 4 + i * 0.3) * 0.3 + 0.5 + Math.random() * 0.2) * canvas.height * 0.8;

      const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
      gradient.addColorStop(0, '#ff6b35');
      gradient.addColorStop(1, '#f7931e');

      ctx.fillStyle = gradient;
      ctx.fillRect(i * (barWidth + 2), canvas.height - barHeight, barWidth, barHeight);
    }
  }

  draw();
}

init();
