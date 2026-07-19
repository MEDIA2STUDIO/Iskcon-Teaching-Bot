const https = require('https');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const CHAPTER_NAMES = [
  "Observing the Armies on the Battlefield of Kuruksetra",
  "Contents of the Gita Summarized",
  "Karma-yoga",
  "Transcendental Knowledge",
  "Karma-yoga--Action in Krsna Consciousness",
  "Sankhya-yoga",
  "Knowledge of the Absolute",
  "Attaining the Supreme",
  "The Most Confidential Knowledge",
  "The Opulence of the Absolute",
  "The Universal Form",
  "Devotional Service",
  "Nature, the Enjoyer, and Consciousness",
  "The Three Modes Of Material Nature",
  "The Yoga of the Supreme Person",
  "The Divine And Demoniac Natures",
  "The Divisions of Faith",
  "Conclusion--The Perfection of Renunciation"
];

const CHAPTER_TOPICS = {
  1: "battlefield war kuruksetra armies arjuna grief dhrtarastra sanjaya",
  2: "soul atma immortality reincarnation death duty yoga karma samkhya self-realization consciousness senses desire peace",
  3: "karma-yoga action duty prescribed duties sacrifice yajna lust desire self-control work without attachment",
  4: "transcendental knowledge avatara divine incarnation spiritual knowledge sacrifice knowledge faith",
  5: "karma-yoga renunciation action in consciousness peace equality tolerance",
  6: "sankhya-yoga meditation dhyana mind control yoga self-realization solitude",
  7: "knowledge of the absolute god divine energy material nature spiritual nature bhakti",
  8: "attaining the supreme brahman rebirth liberation cosmic creation imperishable",
  9: "confidential knowledge supreme god devotion bhakti all-pervading faith",
  10: "opulence of the absolute divine manifestations glories of god arjuna praise",
  11: "universal form visvarupa cosmic vision arjuna sees krishna universal form",
  12: "devotional service bhakti-yoga devotion worship qualities of devotee",
  13: "nature purusha prakriti consciousness field of activities knower of the field knowledge",
  14: "three modes of nature sattva rajas tamas gunas transcendence",
  15: "supreme person purushottama eternal tree ultimate reality",
  16: "divine and demoniac natures daivi sampad asuri sampad good evil qualities",
  17: "divisions of faith three kinds of faith food sacrifice austerity charity",
  18: "conclusion perfection renunciation summary dharma surrender liberation"
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractVerses(html, chapterNum) {
  const $ = cheerio.load(html);
  const verses = [];
  
  // Each verse is in: h4 > a (with text "Chapter X, Verse Y") followed by p (translation)
  const versePattern = new RegExp(`Chapter\\s+${chapterNum},\\s*Verse\\s+(\\d+)`, 'i');
  
  $('h4').each((i, el) => {
    const h4 = $(el);
    const link = h4.find('a');
    const href = link.attr('href') || '';
    const text = link.text().trim();
    
    const match = text.match(versePattern);
    if (match) {
      const verseNum = parseInt(match[1]);
      const p = h4.next('p');
      const translation = p.text().trim();
      
      if (verseNum && translation) {
        const verseUrl = href.startsWith('http') ? href : `https://asitis.com${href}`;
        const id = `${chapterNum}.${verseNum}`;
        verses.push({
          id: id,
          chapter: chapterNum,
          verse: verseNum,
          translation: translation.replace(/\s+/g, ' '),
          url: verseUrl,
          topics: CHAPTER_TOPICS[chapterNum] || ""
        });
      }
    }
  });
  
  return verses;
}

async function main() {
  console.log('Starting scrape of Bhagavad Gita As It Is...\n');
  const allVerses = [];
  
  for (let ch = 1; ch <= 18; ch++) {
    process.stdout.write(`Chapter ${ch} (${CHAPTER_NAMES[ch-1]})... `);
    try {
      const html = await fetchUrl(`https://asitis.com/${ch}/`);
      const verses = extractVerses(html, ch);
      console.log(`${verses.length} verses`);
      allVerses.push(...verses);
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
  }
  
  // Build output
  const chapters = [];
  for (let ch = 1; ch <= 18; ch++) {
    const chVerses = allVerses.filter(v => v.chapter === ch);
    chapters.push({
      chapter: ch,
      name: CHAPTER_NAMES[ch - 1],
      topics: CHAPTER_TOPICS[ch] || "",
      verseCount: chVerses.length,
      verses: chVerses
    });
  }
  
  const output = {
    source: "https://asitis.com/",
    title: "Bhagavad Gita As It Is",
    author: "A.C. Bhaktivedanta Swami Prabhupada",
    totalVerses: allVerses.length,
    chapters: chapters,
    scrapedAt: new Date().toISOString()
  };
  
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  
  fs.writeFileSync(path.join(dataDir, 'verses.json'), JSON.stringify(output, null, 2));
  console.log(`\nDone! Total: ${allVerses.length} verses saved to data/verses.json`);
}

main().catch(console.error);
