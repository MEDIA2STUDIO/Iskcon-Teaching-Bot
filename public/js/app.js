const App = {
  verses: [],
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
      document.getElementById('dataLoading').style.display = 'none';
      document.getElementById('appMain').style.display = 'block';
    } catch (err) {
      document.getElementById('dataLoading').innerHTML = `
        <div style="color:#C0392B;text-align:center;padding:40px;">
          <div style="font-size:48px;margin-bottom:12px;">⚠️</div>
          <p style="font-size:14px;">தரவை ஏற்றுவதில் பிழை</p>
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
  },

  showWelcome() {
    document.getElementById('messages').innerHTML = `
      <div class="welcome" id="welcomeScreen">
        <div class="icon">🕉️</div>
        <h2>பகவத் கீதை AI</h2>
        <p>
          பகவத் கீதையில் இருந்து உங்கள் கேள்விகளுக்கு பதில் பெறுங்கள்.<br>
          கீழே கேள்வியை எழுதி அனுப்பவும் அல்லது 🎤 பொத்தானை அழுத்திப் பேசவும்.
        </p>
        <div class="suggestion-chips">
          <button class="chip">மனதை எப்படி கட்டுப்படுத்துவது?</button>
          <button class="chip">மரணத்திற்கு பின் என்ன ஆகும்?</button>
          <button class="chip">துக்கத்தை எப்படி போக்குவது?</button>
          <button class="chip">கடவுளை அடையும் வழி என்ன?</button>
          <button class="chip">உண்மையான சாந்தி எப்படி கிடைக்கும்?</button>
          <button class="chip">தர்மம் என்றால் என்ன?</button>
          <button class="chip">செயலின் பலனை எதிர்பார்க்கலாமா?</button>
          <button class="chip">ஆன்மா என்றால் என்ன?</button>
        </div>
      </div>`;

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

    const welcome = document.getElementById('welcomeScreen');
    if (welcome) welcome.remove();

    this.addMessage('user', text);
    this.showTyping();

    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));

    const results = this.searchVerses(text);
    this.hideTyping();

    if (results.length === 0) {
      this.addMessage('assistant',
        'மன்னிக்கவும், உங்கள் கேள்விக்கு பொருந்தும் வசனம் எதுவும் கிடைக்கவில்லை. வேறு வார்த்தைகளில் முயற்சிக்கவும்.',
        []);
      this.isProcessing = false;
      document.getElementById('sendBtn').disabled = false;
      return;
    }

    const topResults = results.slice(0, 3);
    const intro = this.getTamilIntro(text, topResults[0]);
    this.addMessage('assistant', intro, topResults);

    this.isProcessing = false;
    document.getElementById('sendBtn').disabled = false;
    this.scrollToBottom();
  },

  getTamilIntro(question, verse) {
    const q = question.toLowerCase();
    const chapterName = verse.ct || '';

    if (q.includes('நன்றி') || q.includes('தாங்க்ஸ்') || q.includes('thanks'))
      return 'ஹரே கிருஷ்ணா! பகவத் கீதை உங்களுக்கு வழிகாட்டட்டும்.';

    if (q.includes('ஹரே கிருஷ்ணா') || q.includes('hare krsna'))
      return 'ஹரே கிருஷ்ணா! பகவத் கீதை கூறும் பதில் இதோ:';

    return `பகவத் கீதை கூறும் பதில் இதோ. ${chapterName} அத்தியாயத்தில் இருந்து:`;
  },

  searchVerses(question) {
    const q = question.toLowerCase();
    const words = q.split(/\s+/).filter(w => w.length > 2);

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
      'அவர்கள்', 'நான்', 'நீ', 'நாம்', 'நாங்கள்', 'நீங்கள்', 'ஒரு',
      'இந்த', 'அந்த', 'உன்', 'உங்கள்', 'என்', 'என்னுடைய'
    ];

    const keywords = words.filter(w => !stopWords.includes(w));

    const scored = this.verses.map(v => {
      let score = 0;
      const searchText = ((v.tr || '') + ' ' + (v.kw || '') + ' ' + (v.pur || '')).toLowerCase();

      if (searchText.includes(q)) score += 50;

      for (const kw of keywords) {
        if (searchText.includes(kw)) {
          score += 10;
          if (new RegExp(`\\b${kw}\\b`, 'i').test(searchText)) score += 5;
        }
      }

      return { ...v, score };
    });

    const minScore = keywords.length === 0 ? 0 : 2;
    let results = scored.filter(v => v.score >= minScore);

    if (results.length === 0 && keywords.length > 0) {
      results = scored.filter(v => {
        for (const kw of keywords) {
          if (v.tr && v.tr.toLowerCase().includes(kw)) return true;
          if (v.kw && v.kw.toLowerCase().includes(kw)) return true;
        }
        return false;
      }).map(v => ({ ...v, score: 1 }));
    }

    if (results.length === 0) {
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
        const ref = `அத்தியாயம் ${v.c} | வசனம் ${v.vs}`;
        bubbleContent += `<div class="verse-result">`;

        // Sanskrit sloka
        if (v.sk) {
          bubbleContent += `<div class="sanskrit">${this.escapeHtml(v.sk)}</div>`;
        }

        // Reference
        bubbleContent += `<div class="ref">📖 ${ref}</div>`;

        // Tamil explanation (using English translation as the verse meaning)
        bubbleContent += `
          <div class="translation-label">விளக்கம்:</div>
          <div class="translation">${this.escapeHtml(v.tr || '')}</div>`;

        // Purport in Tamil context
        if (v.pur) {
          const short = v.pur.length > 250 ? v.pur.substring(0, 250) + '...' : v.pur;
          bubbleContent += `
            <div class="purport-label">விரிவான விளக்கம்:</div>
            <div class="purport">${this.escapeHtml(short)}</div>`;
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
        <div class="typing"><span></span><span></span><span></span></div>
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

  toggleMic() {
    const btn = document.getElementById('micBtn');
    if (this.isListening) { this.stopListening(); return; }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('குரல் உள்ளீடு இந்த உலாவியில் ஆதரிக்கப்படவில்லை. Chrome பயன்படுத்தவும்.');
      return;
    }

    if (!this.recognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'ta-IN';
      this.recognition.continuous = false;
      this.recognition.interimResults = true;

      this.recognition.onresult = (event) => {
        const input = document.getElementById('chatInput');
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++)
          transcript += event.results[i][0].transcript;
        input.value = transcript;
      };

      this.recognition.onend = () => {
        this.stopListening();
        const input = document.getElementById('chatInput');
        if (input.value.trim()) this.sendMessage();
      };

      this.recognition.onerror = (event) => {
        this.stopListening();
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
    if (this.recognition) { try { this.recognition.stop(); } catch (e) {} }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
