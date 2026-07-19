const BGApp = {
  verses: [],
  chapters: [],
  totalVerses: 0,
  audioCtx: null,
  isPlaying: false,
  oscillator: null,
  gainNode: null,

  async init() {
    await this.loadData();
    this.bindEvents();
    this.renderSuggestions();
  },

  async loadData() {
    try {
      const resp = await fetch('data/verses.json');
      const data = await resp.json();
      this.chapters = data.chapters;
      this.totalVerses = data.totalVerses;

      // Build flat verses array with chapter names
      for (const ch of this.chapters) {
        for (const v of ch.verses) {
          v.chapterName = ch.name;
          this.verses.push(v);
        }
      }

      document.getElementById('totalVerses').textContent = this.totalVerses;
      document.getElementById('pageLoading').style.display = 'none';
      document.getElementById('appContent').style.display = 'block';

    } catch (err) {
      console.error('Failed to load verse data:', err);
      document.getElementById('pageLoading').innerHTML = `
        <p style="color:#e55d2b;">தரவை ஏற்றுவதில் பிழை. மீண்டும் முயற்சிக்கவும்.</p>
        <p style="font-size:13px;color:#b8a88a;margin-top:8px;">${err.message}</p>
      `;
    }
  },

  bindEvents() {
    const askBtn = document.getElementById('askBtn');
    const questionInput = document.getElementById('questionInput');

    askBtn.addEventListener('click', () => this.handleQuestion());
    questionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleQuestion();
    });

    // Suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        questionInput.value = chip.dataset.question;
        this.handleQuestion();
      });
    });
  },

  renderSuggestions() {
    const suggestions = [
      { q: 'What is the purpose of life?', keywords: 'purpose life goal' },
      { q: 'How to control the mind?', keywords: 'control mind thoughts' },
      { q: 'What happens after death?', keywords: 'death after die soul' },
      { q: 'How to find peace?', keywords: 'peace calm mind stress' },
      { q: 'What is the soul?', keywords: 'soul atma spirit self' },
      { q: 'How to overcome fear?', keywords: 'fear afraid courage' },
    ];

    const container = document.getElementById('suggestions');
    container.innerHTML = suggestions.map(s =>
      `<button class="suggestion-chip" data-question="${s.q}">${s.q}</button>`
    ).join('');

    container.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.getElementById('questionInput').value = chip.dataset.question;
        this.handleQuestion();
      });
    });
  },

  handleQuestion() {
    const input = document.getElementById('questionInput');
    const question = input.value.trim();
    if (!question) return;

    this.showLoading(true);
    this.clearResults();

    // Simulate thinking
    setTimeout(() => {
      const results = this.searchVerses(question);
      this.showLoading(false);
      this.displayResults(results, question);
    }, 500 + Math.random() * 500);
  },

  searchVerses(question) {
    const q = question.toLowerCase();
    const words = q.split(/\s+/).filter(w => w.length > 2);
    const stopWords = ['what', 'when', 'where', 'which', 'who', 'whom', 'that', 'this',
      'these', 'those', 'have', 'has', 'had', 'does', 'doesn', 'did', 'was', 'were',
      'been', 'being', 'from', 'with', 'without', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'such', 'only', 'than', 'very',
      'just', 'because', 'also', 'how', 'why', 'can', 'will', 'not', 'the', 'and',
      'for', 'are', 'but', 'not', 'you', 'all', 'any', 'every', 'each', 'some',
      'your', 'our', 'their', 'its', 'his', 'her', 'does', 'done', 'doing',
      'get', 'got', 'make', 'made', 'know', 'like', 'find', 'give', 'take',
      'come', 'came', 'see', 'need', 'tell', 'say', 'says', 'said', 'use',
      'want', 'life', 'live', 'way'];

    const keywords = words.filter(w => !stopWords.includes(w));

    // Score each verse
    const scored = this.verses.map(verse => {
      let score = 0;
      const searchText = (verse.translation + ' ' + (verse.topics || '')).toLowerCase();

      // Exact phrase match (highest score)
      if (searchText.includes(q)) score += 50;

      // Individual keyword matches
      for (const kw of keywords) {
        if (searchText.includes(kw)) {
          score += 10;
          // Bonus for exact word boundary match
          const regex = new RegExp(`\\b${kw}\\b`, 'i');
          if (regex.test(searchText)) score += 5;
        }
      }

      // Topic match bonus
      const topicWords = (verse.topics || '').toLowerCase().split(/\s+/);
      for (const tw of topicWords) {
        if (keywords.includes(tw)) score += 20;
      }

      // Bonus for matching question intent words
      const intentWords = ['how to', 'what is', 'why do', 'can i', 'should i', 'how do'];
      for (const iw of intentWords) {
        if (q.includes(iw)) {
          const intentKw = q.replace(iw, '').trim().split(/\s+/)[0];
          if (intentKw && searchText.includes(intentKw)) {
            score += 8;
          }
        }
      }

      return { ...verse, score };
    });

    // Filter and sort
    const minScore = keywords.length === 0 ? 0 : 3;
    let results = scored.filter(v => v.score >= minScore);

    // If no results, return top verses from chapter 2 (most philosophical)
    if (results.length === 0) {
      results = this.verses
        .filter(v => v.chapter === 2)
        .slice(0, 10)
        .map(v => ({ ...v, score: 1 }));
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Return top 10
    return results.slice(0, 10);
  },

  displayResults(results, question) {
    const container = document.getElementById('results');
    const resultsContainer = document.getElementById('resultsContainer');
    const count = document.getElementById('resultCount');
    const noResults = document.getElementById('noResults');

    if (results.length === 0) {
      container.classList.remove('active');
      noResults.classList.add('active');
      return;
    }

    noResults.classList.remove('active');
    container.classList.add('active');

    count.textContent = `கேள்விக்கு பொருந்தும் ${results.length} பதில்கள் கிடைத்தன`;

    // Highlight keywords in question
    const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    resultsContainer.innerHTML = results.map((v, i) => {
      let text = v.translation;
      // Highlight matching keywords
      for (const kw of keywords) {
        if (kw.length <= 2) continue;
        const regex = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        text = text.replace(regex, '<span class="highlight">$1</span>');
      }

      return `
        <div class="verse-card" style="animation-delay: ${i * 0.05}s">
          <div class="verse-ref">
            Chapter <span class="ch-num">${v.chapter}</span> — Verse <span class="v-num">${v.verse}</span>
            ${v.score > 0 ? `<span style="color:#665538;font-size:10px;margin-left:8px;">match ${v.score}%</span>` : ''}
          </div>
          <div class="verse-chapter-name">${v.chapterName}</div>
          <div class="verse-text">${text}</div>
          <a class="verse-link" href="${v.url}" target="_blank" rel="noopener">
            📖 Read full commentary →
          </a>
        </div>
      `;
    }).join('');
  },

  showLoading(show) {
    document.getElementById('loading').classList.toggle('active', show);
    document.getElementById('askBtn').disabled = show;
  },

  clearResults() {
    document.getElementById('results').classList.remove('active');
    document.getElementById('results').innerHTML = '';
    document.getElementById('noResults').classList.remove('active');
  },

  // Hare Krishna Mantra using Web Audio API (no external files needed)
  toggleMantra() {
    const btn = document.getElementById('mantraBtn');

    if (this.isPlaying) {
      this.stopMantra();
      btn.classList.remove('playing');
      btn.innerHTML = '<span class="icon">▶</span> ஹரே கிருஷ்ணா மகா மந்திரம்';
      return;
    }

    btn.innerHTML = '<span class="icon">⟳</span> ஓதுகிறது...';
    btn.classList.add('playing');

    // Use Web Audio API to generate a simple drone + rhythm
    this.playMantraAudio();
  },

  playMantraAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }

      this.isPlaying = true;

      // Create a simple mantra melody using oscillators
      const notes = [
        { freq: 261.63, dur: 0.5 }, // C4 - Ha
        { freq: 293.66, dur: 0.5 }, // D4 - re
        { freq: 329.63, dur: 0.5 }, // E4 - Kri
        { freq: 349.23, dur: 0.5 }, // F4 - shna
        { freq: 392.00, dur: 0.5 }, // G4 - Ha
        { freq: 349.23, dur: 0.5 }, // F4 - re
        { freq: 329.63, dur: 0.5 }, // E4 - Kri
        { freq: 293.66, dur: 0.5 }, // D4 - shna
      ];

      const now = this.audioCtx.currentTime;
      let time = now;

      // Drone (background)
      const droneGain = this.audioCtx.createGain();
      droneGain.gain.value = 0.08;
      droneGain.connect(this.audioCtx.destination);

      const drone1 = this.audioCtx.createOscillator();
      drone1.type = 'sine';
      drone1.frequency.value = 130.81; // C3
      drone1.connect(droneGain);
      drone1.start(now);

      const drone2 = this.audioCtx.createOscillator();
      drone2.type = 'sine';
      drone2.frequency.value = 196.00; // G3
      drone2.connect(droneGain);
      drone2.start(now);

      // Melody loop
      const playMelody = () => {
        if (!this.isPlaying) return;

        const melGain = this.audioCtx.createGain();
        melGain.gain.value = 0.12;
        melGain.connect(this.audioCtx.destination);

        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        osc.connect(melGain);

        // Play through notes
        let t = this.audioCtx.currentTime;
        for (const note of notes) {
          osc.frequency.setValueAtTime(note.freq, t);
          t += note.dur;
        }
        // Repeat the pattern
        for (const note of notes) {
          osc.frequency.setValueAtTime(note.freq, t);
          t += note.dur;
        }

        osc.start(this.audioCtx.currentTime);
        osc.stop(t);

        this.oscillator = osc;
        this.gainNode = melGain;

        // Schedule next loop
        this.mantraTimer = setTimeout(() => {
          if (this.isPlaying) playMelody();
        }, (notes.length * 2) * 500);
      };

      playMelody();

      // Store references for cleanup
      this.drones = [drone1, drone2];
      this.droneGain = droneGain;

      // Update button
      const btn = document.getElementById('mantraBtn');
      btn.innerHTML = '<span class="icon">⏹</span> நிறுத்து';

    } catch (err) {
      console.error('Audio error:', err);
      // Fallback: show message
      const btn = document.getElementById('mantraBtn');
      btn.innerHTML = '<span class="icon">⚠</span> ஆடியோ கிடைக்கவில்லை';
      btn.classList.remove('playing');
      this.isPlaying = false;
    }
  },

  stopMantra() {
    this.isPlaying = false;

    if (this.mantraTimer) {
      clearTimeout(this.mantraTimer);
      this.mantraTimer = null;
    }

    if (this.oscillator) {
      try { this.oscillator.stop(); } catch(e) {}
      this.oscillator = null;
    }

    if (this.drones) {
      this.drones.forEach(d => {
        try { d.stop(); } catch(e) {}
      });
      this.drones = null;
    }

    const btn = document.getElementById('mantraBtn');
    btn.innerHTML = '<span class="icon">▶</span> ஹரே கிருஷ்ணா மகா மந்திரம்';
  }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => BGApp.init());
