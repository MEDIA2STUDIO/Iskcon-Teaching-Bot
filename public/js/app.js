const App = {
  verses: [],
  chapters: [],
  messages: [],
  isListening: false,
  recognition: null,
  isProcessing: false,

  async init() {
    await this.loadData();
    this.bindEvents();
    this.showWelcome();
  },

  async loadData() {
    try {
      const resp = await fetch('data/verses.min.json');
      const data = await resp.json();
      this.verses = data.v;
      this.chapters = [
        { chapter: 1, nameTa: "குருக்ஷேத்திரத்தில் படைகளை நோக்குதல்" },
        { chapter: 2, nameTa: "கீதையின் சுருக்கம்" },
        { chapter: 3, nameTa: "கர்ம யோகம்" },
        { chapter: 4, nameTa: "திவ்ய ஞானம்" },
        { chapter: 5, nameTa: "கர்ம யோகம் - கிருஷ்ண உணர்வில் செயல்" },
        { chapter: 6, nameTa: "தியான யோகம்" },
        { chapter: 7, nameTa: "பரம்பொருளைப் பற்றிய ஞானம்" },
        { chapter: 8, nameTa: "பரமபதத்தை அடைதல்" },
        { chapter: 9, nameTa: "அந்தரங்க ஞானம்" },
        { chapter: 10, nameTa: "பரம்பொருளின் வைபவம்" },
        { chapter: 11, nameTa: "விஸ்வரூப தரிசனம்" },
        { chapter: 12, nameTa: "பக்தி யோகம்" },
        { chapter: 13, nameTa: "பிரகிருதி, புருஷன், சைதன்யம்" },
        { chapter: 14, nameTa: "முக்குணங்கள்" },
        { chapter: 15, nameTa: "புருஷோத்தம யோகம்" },
        { chapter: 16, nameTa: "தெய்வீக மற்றும் அசுர இயல்புகள்" },
        { chapter: 17, nameTa: "ஸ்ரத்தையின் பாகுபாடுகள்" },
        { chapter: 18, nameTa: "மோக்ஷம் - தியாகத்தின் பூரணத்துவம்" }
      ];
      document.getElementById('dataLoading').style.display = 'none';
      document.getElementById('appMain').style.display = 'block';
    } catch (err) {
      document.getElementById('dataLoading').innerHTML = `
        <div style="color:#C0392B;text-align:center;padding:40px;">
          <div style="font-size:48px;margin-bottom:12px;">⚠️</div>
          <p style="font-size:14px;">தரவை ஏற்றுவதில் பிழை ஏற்பட்டது</p>
          <p style="font-size:12px;color:#8B7355;margin-top:4px;">${err.message}</p>
        </div>`;
    }
  },

  bindEvents() {
    document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
    document.getElementById('micBtn').addEventListener('click', () => this.toggleMic());
    document.getElementById('chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Suggestions
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.getElementById('chatInput').value = chip.textContent.trim();
        this.sendMessage();
      });
    });
  },

  showWelcome() {
    document.getElementById('messages').innerHTML = `
      <div class="welcome" id="welcomeScreen">
        <div class="icon">🕉️</div>
        <h2>பகவத் கீதை AI</h2>
        <p>
          பகவத் கீதையில் இருந்து உங்கள் கேள்விகளுக்கு பதில்களைப் பெறுங்கள்.<br>
          கீழே உங்கள் கேள்வியை தட்டச்சு செய்யவும் அல்லது மைக் பொத்தானை அழுத்தவும்.
        </p>
        <div class="suggestion-chips">
          <button class="chip">மனதை எப்படி கட்டுப்படுத்துவது?</button>
          <button class="chip">மரணத்திற்கு பின் என்ன?</button>
          <button class="chip">துக்கத்தை எப்படி போக்குவது?</button>
          <button class="chip">கடவுளை எப்படி அடைவது?</button>
          <button class="chip">சாந்தி எப்படி கிடைக்கும்?</button>
          <button class="chip">தர்மம் என்றால் என்ன?</button>
        </div>
      </div>`;
    
    // Re-bind suggestion chips
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.getElementById('chatInput').value = chip.textContent.trim();
        this.sendMessage();
      });
    });
  },

  async sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || this.isProcessing) return;

    this.isProcessing = true;
    document.getElementById('sendBtn').disabled = true;
    input.value = '';

    // Remove welcome
    const welcome = document.getElementById('welcomeScreen');
    if (welcome) welcome.remove();

    // Add user message
    this.addMessage('user', text);
    
    // Show typing
    this.showTyping();

    // Simulate thinking
    await new Promise(r => setTimeout(r, 600 + Math.random() * 600));

    // Search for answer
    const results = this.searchVerses(text);
    this.hideTyping();

    if (results.length === 0) {
      this.addMessage('assistant',
        'மன்னிக்கவும், உங்கள் கேள்விக்கு பொருந்தக்கூடிய வசனங்கள் எதுவும் கிடைக்கவில்லை. மீண்டும் வேறு வார்த்தைகளில் கேளுங்கள்.',
        []);
      this.isProcessing = false;
      document.getElementById('sendBtn').disabled = false;
      return;
    }

    // Add assistant response with top 3 verses
    const topResults = results.slice(0, 3);
    this.addMessage('assistant', `உங்கள் கேள்விக்கு பகவத் கீதை கூறும் பதில் இதோ:`, topResults);
    
    this.isProcessing = false;
    document.getElementById('sendBtn').disabled = false;
    this.scrollToBottom();
  },

  searchVerses(question) {
    const q = question.toLowerCase();
    const words = q.split(/\s+/).filter(w => w.length > 2);
    
    // Tamil + English stop words
    const stopWords = [
      'what', 'when', 'where', 'which', 'who', 'whom', 'that', 'this',
      'these', 'those', 'have', 'has', 'had', 'does', 'did', 'was', 'were',
      'been', 'being', 'from', 'with', 'without', 'about', 'into', 'through',
      'during', 'before', 'after', 'above', 'below', 'between', 'such', 'only',
      'than', 'very', 'just', 'because', 'also', 'how', 'why', 'can', 'will',
      'not', 'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any',
      'every', 'each', 'some', 'your', 'our', 'their', 'its', 'his', 'her',
      'get', 'got', 'make', 'made', 'know', 'like', 'find', 'give', 'take',
      'come', 'came', 'see', 'need', 'tell', 'say', 'says', 'said', 'use',
      'want', 'life', 'live', 'way', 'என்றால்', 'எப்படி', 'ஏன்', 'எது',
      'என்ன', 'யார்', 'எப்போது', 'எங்கே', 'அது', 'இது', 'அவன்', 'அவள்',
      'அவர்கள்', 'நான்', 'நீ', 'நாம்', 'நாங்கள்', 'நீங்கள்'
    ];

    const keywords = words.filter(w => !stopWords.includes(w));

    // Score each verse
    const scored = this.verses.map(v => {
      let score = 0;
      // Search in translation + keywords + purport
      const searchText = ((v.tr || '') + ' ' + (v.kw || '') + ' ' + (v.pur || '')).toLowerCase();

      // Exact phrase match
      if (searchText.includes(q)) score += 50;

      for (const kw of keywords) {
        if (searchText.includes(kw)) {
          score += 10;
          if (new RegExp(`\\b${kw}\\b`, 'i').test(searchText)) score += 5;
        }
      }

      return { ...v, score };
    });

    // Filter and sort
    const minScore = keywords.length === 0 ? 0 : 2;
    let results = scored.filter(v => v.score >= minScore);
    
    if (results.length === 0 && keywords.length > 0) {
      // Fallback: very loose matching
      results = scored.filter(v => {
        for (const kw of keywords) {
          if (v.tr && v.tr.toLowerCase().includes(kw)) return true;
          if (v.kw && v.kw.toLowerCase().includes(kw)) return true;
        }
        return false;
      }).map(v => ({ ...v, score: 1 }));
    }

    if (results.length === 0) {
      // Ultimate fallback: chapter 2 (most philosophical)
      results = this.verses.filter(v => v.c === 2).slice(0, 5).map(v => ({ ...v, score: 1 }));
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 5);
  },

  addMessage(role, text, verses) {
    const container = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message ${role}`;

    const avatar = role === 'user' ? '👤' : '🕉️';

    let bubbleContent = `<div class="bubble">${this.escapeHtml(text)}`;

    if (verses && verses.length > 0) {
      for (const v of verses) {
        const chName = v.ct || '';
        const verseRef = `அத்தியாயம் ${v.c} — வசனம் ${v.vs}`;
        
        bubbleContent += `
          <div class="verse-result">
            <div class="ref">📖 ${verseRef} <span class="ch">${chName}</span></div>`;
        
        if (v.sk) {
          bubbleContent += `<div class="sanskrit">${this.escapeHtml(v.sk)}</div>`;
        }
        
        bubbleContent += `
            <div class="translation">${this.escapeHtml(v.tr || '')}</div>`;
        
        if (v.pur) {
          const shortPurport = v.pur.length > 200 ? v.pur.substring(0, 200) + '...' : v.pur;
          bubbleContent += `
            <div class="purport-label">விளக்கம்</div>
            <div class="purport">${this.escapeHtml(shortPurport)}</div>`;
        }
        
        bubbleContent += `</div>`;
      }
    }

    bubbleContent += `</div>`;
    div.innerHTML = `<div class="avatar">${avatar}</div>${bubbleContent}`;
    container.appendChild(div);
    this.scrollToBottom();
  },

  showTyping() {
    const container = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.id = 'typingIndicator';
    div.innerHTML = `
      <div class="avatar">🕉️</div>
      <div class="bubble">
        <div class="typing">
          <span></span><span></span><span></span>
        </div>
      </div>`;
    container.appendChild(div);
    this.scrollToBottom();
  },

  hideTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
  },

  scrollToBottom() {
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 50);
  },

  escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  },

  // Voice Input
  toggleMic() {
    const btn = document.getElementById('micBtn');

    if (this.isListening) {
      this.stopListening();
      return;
    }

    // Check for speech recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('உங்கள் உலாவியில் குரல் உள்ளீடு ஆதரிக்கப்படவில்லை. Chrome அல்லது Edge பயன்படுத்தவும்.');
      return;
    }

    if (!this.recognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'ta-IN';  // Tamil
      this.recognition.continuous = false;
      this.recognition.interimResults = true;

      this.recognition.onresult = (event) => {
        const input = document.getElementById('chatInput');
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        input.value = transcript;
      };

      this.recognition.onend = () => {
        this.stopListening();
        // Auto-send after mic stops
        const input = document.getElementById('chatInput');
        if (input.value.trim()) {
          this.sendMessage();
        }
      };

      this.recognition.onerror = (event) => {
        console.error('Speech error:', event.error);
        this.stopListening();
        if (event.error === 'language-not-supported') {
          // Fallback to English
          this.recognition.lang = 'en-US';
          alert('தமிழ் குரல் உள்ளீடு ஆதரிக்கப்படவில்லை. ஆங்கிலத்தில் பேச முயற்சிக்கவும்.');
        }
      };
    }

    this.isListening = true;
    btn.classList.add('listening');
    btn.textContent = '⏺️';
    this.recognition.start();
  },

  stopListening() {
    const btn = document.getElementById('micBtn');
    this.isListening = false;
    btn.classList.remove('listening');
    btn.textContent = '🎤';
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
  }
};

// Init
document.addEventListener('DOMContentLoaded', () => App.init());
