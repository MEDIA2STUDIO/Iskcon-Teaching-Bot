const App = {
  verses: [],
  isListening: false,
  recognition: null,
  isProcessing: false,
  messageCount: 0,

  currentLang: localStorage.getItem('gita-lang') || 'ta',

  async init() {
    await this.loadData();
    this.bindEvents();
    this.showWelcome();
    this.initTranslate();
  },

  async loadData() {
    try {
      const resp = await fetch('data/verses.min.json');
      const data = await resp.json();
      this.verses = data.v;
      document.getElementById('dataLoading').style.display = 'none';
      document.getElementById('appMain').style.display = 'flex';
    } catch (err) {
      document.getElementById('dataLoading').innerHTML = `
        <div style="color:#C0392B;text-align:center;padding:40px;">
          <div style="font-size:48px;margin-bottom:12px;">⚠️</div>
          <p>தரவை ஏற்றுவதில் பிழை</p>
          <p style="font-size:12px;color:#8B7355;margin-top:4px;">${err.message}</p>
        </div>`;
    }
  },

  bindEvents() {
    document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
    document.getElementById('micBtn').addEventListener('click', () => this.toggleMic());
    document.getElementById('translateBtn').addEventListener('click', () => this.toggleTranslate());
    document.getElementById('chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  },

  showWelcome() {
    const el = document.getElementById('messages');
    if (!el) return;
    el.innerHTML = `
      <div class="welcome" id="welcomeScreen">
        <div class="welcome-icon">🕉️</div>
        <h2>ராதே ராதே! கீதை AI-க்கு வரவேற்கிறோம்</h2>
        <p>
          வாழ்க்கை, தர்மம், கர்மா, ஆன்மீகம் பற்றி உங்கள் கேள்விகளை கேளுங்கள்.<br>
          பகவத் கீதை வசனங்கள் மூலம் பதில் பெறுங்கள்.
        </p>
        <div class="suggestion-chips">
          <button class="chip">மனதை எப்படி கட்டுப்படுத்துவது?</button>
          <button class="chip">மரணத்திற்கு பின் என்ன?</button>
          <button class="chip">உண்மையான சாந்தி எப்படி கிடைக்கும்?</button>
          <button class="chip">கடவுளை அடையும் வழி என்ன?</button>
          <button class="chip">கர்மா என்றால் என்ன?</button>
          <button class="chip">துக்கத்திலிருந்து விடுபட என்ன வழி?</button>
        </div>
      </div>`;
    this.bindChips();
  },

  bindChips() {
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

    await new Promise(r => setTimeout(r, 400 + Math.random() * 400));

    const results = this.searchVerses(text);
    this.hideTyping();
    this.messageCount++;

    if (results.length === 0) {
      this.addMessage('assistant',
        'மன்னிக்கவும், உங்கள் கேள்விக்கு பொருந்தக்கூடிய வசனம் எதுவும் கிடைக்கவில்லை. வேறு வார்த்தைகளில் முயற்சிக்கவும்.',
        []);
      this.isProcessing = false;
      document.getElementById('sendBtn').disabled = false;
      return;
    }

    const topResults = results.slice(0, 3);
    const intro = this.getIntro(text, topResults[0]);
    this.addMessage('assistant', intro, topResults);

    this.isProcessing = false;
    document.getElementById('sendBtn').disabled = false;
    this.scrollToBottom();
  },

  getIntro(question, verse) {
    const q = question.toLowerCase();
    const cn = verse.ct || '';

    if (q.includes('நன்றி') || q.includes('thanks') || q.includes('thank'))
      return 'ஹரே கிருஷ்ணா! பகவத் கீதை உங்களுக்கு வழிகாட்டட்டும் 🙏';

    if (q.includes('ஹரே கிருஷ்ணா') || q.includes('hare'))
      return 'ஹரே கிருஷ்ணா! 🙏 உங்கள் கேள்விக்கு பகவத் கீதை கூறும் வழிகாட்டுதல் இதோ:';

    // Match question patterns
    if (q.includes('எப்படி') || q.includes('வழி') || q.includes('முறை'))
      return `பகவத் கீதை இதற்கான வழிகாட்டுதலை கூறுகிறது. ${cn} அத்தியாயத்தில் இருந்து:`;

    if (q.includes('என்ன') || q.includes('எது') || q.includes('யார்'))
      return `பகவத் கீதை ${cn} அத்தியாயத்தில் இவ்வாறு கூறுகிறது:`;

    if (q.includes('ஏன்'))
      return `இதற்கான விளக்கத்தை பகவத் கீதை ${cn} அத்தியாயத்தில் தருகிறது:`;

    return `பகவத் கீதை ${cn} அத்தியாயத்தில் இருந்து பொருத்தமான வசனங்கள்:`;
  },

  searchVerses(question) {
    const q = question.toLowerCase();
    const words = q.split(/\s+/).filter(w => w.length > 2);

    const stopWords = [
      'what','when','where','which','who','whom','that','this','these','those',
      'have','has','had','does','did','was','were','been','being','from','with',
      'without','about','into','through','during','before','after','above','below',
      'between','such','only','than','very','just','because','also','how','why',
      'can','will','not','the','and','for','are','but','not','you','all','any',
      'every','each','some','your','our','their','its','his','her','get','got',
      'make','made','know','like','find','give','take','come','came','see','need',
      'tell','say','says','said','use','want','life','live','way','new','one',
      'என்றால்','எப்படி','ஏன்','எது','என்ன','யார்','எப்போது','எங்கே','அது',
      'இது','அவன்','அவள்','அவர்கள்','நான்','நீ','நாம்','நாங்கள்','நீங்கள்',
      'ஒரு','இந்த','அந்த','உன்','உங்கள்','என்','என்னுடைய','தான்','ஆகும்',
      'ஆக','உள்ள','உள்ளது','என்று','போன்ற','போல','இல்லை','அல்லது','மிகவும்'
    ];

    const keywords = words.filter(w => !stopWords.includes(w) && w.length > 1);

    const scored = this.verses.map(v => {
      let score = 0;
      const searchText = ((v.tr || '') + ' ' + (v.kw || '') + ' ' + (v.pur || '')).toLowerCase();

      if (searchText.includes(q)) score += 50;

      for (const kw of keywords) {
        if (searchText.includes(kw)) {
          score += kw.length > 4 ? 15 : 10;
          if (new RegExp(`\\b${kw}\\b`, 'i').test(searchText)) score += 5;
        }
      }

      return { ...v, score };
    });

    let results = scored.filter(v => v.score >= (keywords.length === 0 ? 0 : 2));

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

    let bubble = `<div class="bubble">${this.esc(text)}`;

    if (verses && verses.length > 0) {
      for (const v of verses) {
        const ref = `📖 அத்தியாயம் ${v.c} | வசனம் ${v.vs}`;

        bubble += `<div class="verse-result">`;

        if (v.sk) {
          bubble += `<div class="sanskrit">${this.esc(v.sk)}</div>`;
        }

        bubble += `<div class="ref">${ref}</div>`;

        bubble += `
          <div class="translation-label">விளக்கம்:</div>
          <div class="translation">${this.esc(v.tr || '')}</div>`;

        if (v.pur) {
          const short = v.pur.length > 300 ? v.pur.substring(0, 300) + '...' : v.pur;
          bubble += `
            <div class="purport-label">விரிவான விளக்கம்:</div>
            <div class="purport">${this.esc(short)}</div>`;
        }

        bubble += `</div>`;
      }
    }

    bubble += `</div>`;
    div.innerHTML = `<div class="avatar">${avatar}</div>${bubble}`;
    container.appendChild(div);
    this.scrollToBottom();
  },

  showTyping() {
    const c = document.getElementById('messages');
    const d = document.createElement('div');
    d.className = 'message assistant';
    d.id = 'typingIndicator';
    d.innerHTML = `<div class="avatar">🕉️</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
    c.appendChild(d);
    this.scrollToBottom();
  },

  hideTyping() { const e = document.getElementById('typingIndicator'); if (e) e.remove(); },

  scrollToBottom() {
    const el = document.querySelector('.messages-area');
    if (el) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
  },

  esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; },

  toggleMic() {
    const btn = document.getElementById('micBtn');
    if (this.isListening) { this.stopListening(); return; }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('குரல் உள்ளீடு இந்த உலாவியில் ஆதரிக்கப்படவில்லை. Chrome பயன்படுத்தவும்.'); return; }

    if (!this.recognition) {
      this.recognition = new SR();
      this.recognition.lang = 'ta-IN';
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.onresult = (e) => {
        let t = '';
        for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
        document.getElementById('chatInput').value = t;
      };
      this.recognition.onend = () => {
        this.stopListening();
        const inp = document.getElementById('chatInput');
        if (inp.value.trim()) this.sendMessage();
      };
      this.recognition.onerror = () => this.stopListening();
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
  },

  translateLoaded: false,

  initTranslate() {
    window.googleTranslateElementInit = () => {
      this.translateLoaded = true;
    };
    const s = document.createElement('script');
    s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.body.appendChild(s);
  },

  toggleTranslate() {
    const panel = document.getElementById('langPanel');
    const btn = document.getElementById('translateBtn');
    const shown = panel.style.display === 'block';
    panel.style.display = shown ? 'none' : 'block';
    btn.classList.toggle('active', !shown);
    document.getElementById('translateLabel').textContent = shown ? 'மொழிபெயர்ப்பு' : 'மொழி தேர்வு';
    if (!shown) {
      const sel = document.getElementById('langSelect');
      sel.addEventListener('change', () => this.translateTo(sel.value));
    }
  },

  translateTo(lang) {
    if (!lang) return;
    this.currentLang = lang;
    localStorage.setItem('gita-lang', lang);
    document.documentElement.lang = lang;
    document.getElementById('langPanel').style.display = 'none';
    document.getElementById('translateBtn').classList.remove('active');
    document.getElementById('translateLabel').textContent = 'மொழிபெயர்ப்பு';

    if (lang === 'ta') {
      location.reload();
      return;
    }

    const currentUrl = window.location.href;
    const baseUrl = currentUrl.split('?')[0].split('#')[0];
    const translateUrl = `https://translate.google.com/translate?hl=${lang}&sl=ta&tl=${lang}&u=${encodeURIComponent(baseUrl)}&sandbox=1`;
    window.open(translateUrl, '_blank');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
