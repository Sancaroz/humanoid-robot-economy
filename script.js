const langButtons = document.querySelectorAll('.lang-btn');

/* ── THEME TOGGLE ── */
(function(){
  const btn   = document.getElementById('theme-toggle');
  const root  = document.documentElement;
  const saved = localStorage.getItem('theme');

  function applyTheme(theme){
    if(theme === 'light'){
      root.setAttribute('data-theme','light');
      if(btn) btn.textContent = '☀️';
    } else {
      root.removeAttribute('data-theme');
      if(btn) btn.textContent = '🌙';
    }
    localStorage.setItem('theme', theme);
  }

  applyTheme(saved === 'light' ? 'light' : 'dark');

  if(btn){
    btn.addEventListener('click', function(){
      const current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      applyTheme(current === 'light' ? 'dark' : 'light');
    });
  }
})();

const trElems = document.querySelectorAll('[data-lang="tr"]:not(.lang-btn)');
const enElems = document.querySelectorAll('[data-lang="en"]:not(.lang-btn)');

const leadForm = document.getElementById('lead-form');
const leadStatus = document.getElementById('lead-status');
const leadName = document.getElementById('lead-name');
const leadEmail = document.getElementById('lead-email');
const leadFocus = document.getElementById('lead-focus');
const siteSearchInput = document.getElementById('site-search-input');
const siteSearchBtn = document.getElementById('site-search-btn');
const siteSearchClearBtn = document.getElementById('site-search-clear');
const siteSearchStatus = document.getElementById('site-search-status');
const aiQuestionInput = document.getElementById('ai-question-input');
const aiAskBtn = document.getElementById('ai-ask-btn');
const aiAnswerBox = document.getElementById('ai-answer-box');
var homeNewsSourceBadge = null;
var latestHomeNewsMode = 'loading';
const AI_PLATFORM_CONFIG = {
  endpoint: window.ROBOLOGAI_AI_ENDPOINT || '',
  timeoutMs: 20000,
};
let latestNewsItems = [];

const NEWS_IMAGE_BY_COMPANY = {
  tesla: 'images/robots/tesla-original.jpg',
  unitree: 'images/robots/unitree-original.jpg',
  'figure ai': 'images/robots/figure-original.jpg',
  figure: 'images/robots/figure-original.jpg',
  'boston dynamics': 'images/robots/boston-original.jpg',
  'agility robotics': 'images/robots/agility-original.jpg',
  openai: 'images/robots/near-touch-human-robot.png',
  apptronik: 'images/robots/apptronik-original.jpg',
  neura: 'images/robots/neura-original.jpg',
  '1x': 'images/robots/1x-original.jpg',
};
const NEWS_IMAGE_FALLBACK = 'images/robots/near-touch-human-robot.png';
const NEWS_CACHE_KEY = 'robologaiNewsCacheV1';
const NEWS_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function getNewsImageForCompany(companyName) {
  const normalized = String(companyName || '').trim().toLowerCase();
  return NEWS_IMAGE_BY_COMPANY[normalized] || NEWS_IMAGE_FALLBACK;
}

function readNewsCache() {
  try {
    const raw = localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const cachedAt = Number(parsed.cachedAt || 0);

    if (!items.length || !cachedAt) {
      return null;
    }

    const isFresh = Date.now() - cachedAt <= NEWS_CACHE_MAX_AGE_MS;
    if (!isFresh) {
      return null;
    }

    return {
      items,
      cachedAt,
    };
  } catch (error) {
    return null;
  }
}

function writeNewsCache(items) {
  try {
    if (!Array.isArray(items) || !items.length) return;

    const payload = {
      cachedAt: Date.now(),
      items: items.slice(0, 24),
    };

    localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Ignore cache write errors.
  }
}

function updateLeadPlaceholders(lang) {
  [leadName, leadEmail, leadFocus].forEach((field) => {
    if (!field) return;
    const key = lang === 'tr' ? 'phTr' : 'phEn';
    const value = field.dataset[key];
    if (value) {
      field.placeholder = value;
    }
  });

  if (siteSearchInput) {
    const searchPlaceholder =
      lang === 'tr' ? siteSearchInput.dataset.phTr : siteSearchInput.dataset.phEn;
    if (searchPlaceholder) {
      siteSearchInput.placeholder = searchPlaceholder;
    }
  }

  if (aiQuestionInput) {
    const aiPlaceholder =
      lang === 'tr' ? aiQuestionInput.dataset.phTr : aiQuestionInput.dataset.phEn;
    if (aiPlaceholder) {
      aiQuestionInput.placeholder = aiPlaceholder;
    }
  }
}

function setAiAnswer(text) {
  if (!aiAnswerBox) return;
  aiAnswerBox.textContent = text;
}

function getLocalAiFallback(question, lang) {
  const q = question.toLowerCase();

  if (q.includes('tesla') || q.includes('optimus')) {
    return lang === 'tr'
      ? 'Tesla Optimus odaginda guncel haberler icin Once Haberler bolumunde "Tesla" arat, sonra sirket kartindan urun sayfasina gec.'
      : 'For Tesla Optimus updates, search "Tesla" in Latest News first, then open the company card product page.';
  }

  if (q.includes('figure') || q.includes('unitree')) {
    return lang === 'tr'
      ? 'Figure ve Unitree karsilastirmasi icin hizli aramada her iki markayi arat. Sirket kartlari ve son haberler birlikte filtrelenir.'
      : 'For Figure vs Unitree comparison, use quick search with both names. Company cards and latest news will be filtered together.';
  }

  if (q.includes('yatirim') || q.includes('investment') || q.includes('risk')) {
    return lang === 'tr'
      ? 'Yatirim/risk bakisi icin once "Humanoid Caginda Is ve Yatirim: 2026" yazisina, sonra blogdaki haftalik analizlere bakmani oneririm.'
      : 'For investment/risk context, start with "Business and Investment in the Humanoid Era: 2026" and then continue with weekly blog analyses.';
  }

  return lang === 'tr'
    ? 'Bu soru icin en iyi yol: ustteki hizli aramaya anahtar kelimeyi yaz ve haberler + sirket kartlarindaki kaynaklari birlikte incele.'
    : 'Best path for this question: use quick search with keywords above and review sources from both news and company cards together.';
}

async function askAiAssistant() {
  if (!aiQuestionInput || !aiAnswerBox) return;

  const lang = localStorage.getItem('lang') || 'tr';
  const question = aiQuestionInput.value.trim();
  if (!question) {
    setAiAnswer(
      lang === 'tr'
        ? 'Lutfen bir soru yaz.'
        : 'Please type a question.'
    );
    return;
  }

  setAiAnswer(
    lang === 'tr' ? 'Yanit hazirlaniyor...' : 'Preparing answer...'
  );

  if (!AI_PLATFORM_CONFIG.endpoint) {
    setAiAnswer(getLocalAiFallback(question, lang));
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_PLATFORM_CONFIG.timeoutMs);

    const response = await fetch(AI_PLATFORM_CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, lang }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error('ai-endpoint-failed');
    }

    const payload = await response.json();
    const answer = (payload.answer || '').trim();

    if (!answer) {
      throw new Error('empty-answer');
    }

    setAiAnswer(answer);
  } catch (error) {
    setAiAnswer(getLocalAiFallback(question, lang));
  }
}

function applySiteSearch() {
  if (!siteSearchInput) return;

  const keyword = siteSearchInput.value.trim().toLowerCase();
  const lang = localStorage.getItem('lang') || 'tr';
  const companyCards = document.querySelectorAll('#company-links .link-card');
  const newsItems = document.querySelectorAll('#live-news-list .live-news-item');

  let visibleCompanyCount = 0;
  let visibleNewsCount = 0;

  companyCards.forEach((card) => {
    const text = (card.textContent || '').toLowerCase();
    const show = !keyword || text.includes(keyword);
    card.classList.toggle('is-search-hidden', !show);
    if (show) visibleCompanyCount += 1;
  });

  newsItems.forEach((item) => {
    const text = (item.textContent || '').toLowerCase();
    const show = !keyword || text.includes(keyword);
    item.classList.toggle('is-search-hidden', !show);
    if (show) visibleNewsCount += 1;
  });

  if (!siteSearchStatus) return;

  if (!keyword) {
    siteSearchStatus.textContent =
      lang === 'tr'
        ? 'Arama filtresi kapali. Tum icerikler goruntuleniyor.'
        : 'Search filter is off. Showing all content.';
    return;
  }

  siteSearchStatus.textContent =
    lang === 'tr'
      ? `"${siteSearchInput.value}" icin ${visibleCompanyCount} sirket karti, ${visibleNewsCount} haber bulundu.`
      : `Found ${visibleCompanyCount} company cards and ${visibleNewsCount} news items for "${siteSearchInput.value}".`;
}

function setLanguage(lang) {
  localStorage.setItem('lang', lang);
  langButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  if (lang === 'tr') {
    trElems.forEach((el) => el.classList.remove('hidden'));
    enElems.forEach((el) => el.classList.add('hidden'));
    document.documentElement.lang = 'tr';
  } else {
    trElems.forEach((el) => el.classList.add('hidden'));
    enElems.forEach((el) => el.classList.remove('hidden'));
    document.documentElement.lang = 'en';
  }

  updateLeadPlaceholders(lang);

  if (latestNewsItems.length) {
    renderNewsItems(latestNewsItems);
  }

  setHomeNewsSourceBadge(latestHomeNewsMode);

  applySiteSearch();
}

langButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    setLanguage(btn.dataset.lang);
  });
});

const subscribeButtons = document.querySelectorAll('[data-subscribe="true"]');
subscribeButtons.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();

    const leadHub = document.getElementById('lead-hub');
    if (leadHub) {
      leadHub.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (leadEmail) {
        setTimeout(() => leadEmail.focus(), 300);
      }
      return;
    }

    window.location.href = 'index.html#lead-hub';
  });
});

if (leadForm && leadName && leadEmail && leadFocus && leadStatus) {
  leadForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const lang = localStorage.getItem('lang') || 'tr';
    if (!leadForm.checkValidity()) {
      leadForm.reportValidity();
      return;
    }

    const subject =
      lang === 'tr'
        ? 'RoboLogAI Okur Mesaji'
        : 'RoboLogAI Reader Message';

    const body =
      (lang === 'tr'
        ? 'Ad Soyad: '
        : 'Full Name: ') +
      leadName.value +
      '\n' +
      (lang === 'tr' ? 'E-posta: ' : 'Email: ') +
      leadEmail.value +
      '\n\n' +
      (lang === 'tr' ? 'Mesaj: ' : 'Message: ') +
      leadFocus.value;

    window.location.href =
      'mailto:robologai@gmail.com?subject=' +
      encodeURIComponent(subject) +
      '&body=' +
      encodeURIComponent(body);

    leadStatus.textContent =
      lang === 'tr'
        ? 'E-posta taslagi acildi. Gonder dediginde mesajin iletilecek.'
        : 'Email draft opened. Send it to deliver your message.';
  });
}

const mediaVideo = document.querySelector('.media-video video');
const mediaWarnings = document.querySelectorAll('.media-note.warning');
const mediaFallback = document.querySelector('.media-fallback');

if (mediaVideo && mediaWarnings.length) {
  const hideWarnings = () => {
    mediaWarnings.forEach((note) => {
      note.style.display = 'none';
    });
    if (mediaFallback) {
      mediaFallback.style.display = 'none';
    }
  };

  const showWarnings = () => {
    mediaWarnings.forEach((note) => {
      note.style.display = 'block';
    });
    if (mediaFallback) {
      mediaFallback.style.display = 'block';
    }
  };

  hideWarnings();
  mediaVideo.addEventListener('loadeddata', hideWarnings);
  mediaVideo.addEventListener('canplay', hideWarnings);
  mediaVideo.addEventListener('error', showWarnings);
}

const savedLang = localStorage.getItem('lang') || 'tr';
setLanguage(savedLang);

if (siteSearchInput) {
  const searchParam = new URLSearchParams(window.location.search).get('q');
  if (searchParam) {
    siteSearchInput.value = searchParam;
  }
}

const postFilters = document.querySelectorAll('.post-filter');
const filterablePosts = document.querySelectorAll('.filterable-post');

if (postFilters.length && filterablePosts.length) {
  const BLOG_FILTER_KEY = 'blogFilter';

  const applyPostFilter = (filter) => {
    postFilters.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    filterablePosts.forEach((post) => {
      const category = post.dataset.category;
      const isVisible = filter === 'all' || category === filter;
      post.classList.toggle('is-filtered-out', !isVisible);
    });
  };

  postFilters.forEach((btn) => {
    btn.addEventListener('click', () => {
      const selectedFilter = btn.dataset.filter || 'all';
      localStorage.setItem(BLOG_FILTER_KEY, selectedFilter);
      applyPostFilter(selectedFilter);
    });
  });

  const savedFilter = localStorage.getItem(BLOG_FILTER_KEY) || 'all';
  const filterExists = Array.from(postFilters).some(
    (btn) => btn.dataset.filter === savedFilter
  );
  applyPostFilter(filterExists ? savedFilter : 'all');
}

const newsList = document.getElementById('live-news-list');
const newsStatusTr = document.getElementById('news-status');
const newsStatusEn = document.getElementById('news-status-en');
const refreshNewsBtn = document.getElementById('refresh-news');
const homeFeaturedNews = document.getElementById('home-featured-news');
const homeNewsStream = document.getElementById('home-news-stream');
homeNewsSourceBadge = document.getElementById('home-news-source-badge');

const NEWS_SOURCES = [
  {
    company: 'Tesla',
    url: 'https://news.google.com/rss/search?q=Tesla+Optimus+robot&hl=en-US&gl=US&ceid=US:en',
  },
  {
    company: 'OpenAI',
    url: 'https://news.google.com/rss/search?q=OpenAI+robotics+news&hl=en-US&gl=US&ceid=US:en',
  },
  {
    company: 'Figure AI',
    url: 'https://news.google.com/rss/search?q=Figure+AI+humanoid+robot&hl=en-US&gl=US&ceid=US:en',
  },
  {
    company: 'Unitree',
    url: 'https://news.google.com/rss/search?q=Unitree+humanoid+robot&hl=en-US&gl=US&ceid=US:en',
  },
  {
    company: 'Boston Dynamics',
    url: 'https://news.google.com/rss/search?q=Boston+Dynamics+Atlas+news&hl=en-US&gl=US&ceid=US:en',
  },
  {
    company: 'Agility Robotics',
    url: 'https://news.google.com/rss/search?q=Agility+Robotics+Digit+news&hl=en-US&gl=US&ceid=US:en',
  },
];

const EMERGENCY_NEWS_FALLBACK = [
  {
    company: 'Tesla',
    title: 'Tesla Optimus programinda son test ve uretim odakli gelismeler',
    link: 'news.html',
    pubDate: new Date().toUTCString(),
  },
  {
    company: 'Figure AI',
    title: 'Figure AI humanoid platformunda saha demosu ve ortaklik sinyalleri',
    link: 'news.html',
    pubDate: new Date().toUTCString(),
  },
  {
    company: 'Unitree',
    title: 'Unitree humanoid serisinde yeni kullanim senaryolari one cikiyor',
    link: 'news.html',
    pubDate: new Date().toUTCString(),
  },
  {
    company: 'Boston Dynamics',
    title: 'Boston Dynamics tarafinda fiziksel AI odakli uygulama genisliyor',
    link: 'news.html',
    pubDate: new Date().toUTCString(),
  },
  {
    company: 'OpenAI',
    title: 'OpenAI robotik ekosistemi ile ilgili arastirma haberleri hizlaniyor',
    link: 'news.html',
    pubDate: new Date().toUTCString(),
  },
  {
    company: 'Agility Robotics',
    title: 'Agility Robotics operasyonel kullanimlarda yeni pilotlara ilerliyor',
    link: 'news.html',
    pubDate: new Date().toUTCString(),
  },
];

function setNewsStatus(trText, enText) {
  if (newsStatusTr) newsStatusTr.textContent = trText;
  if (newsStatusEn) newsStatusEn.textContent = enText;
}

function setHomeNewsSourceBadge(mode) {
  if (!homeNewsSourceBadge) return;

  latestHomeNewsMode = mode;
  homeNewsSourceBadge.classList.remove('loading', 'static', 'live', 'cached', 'local');
  homeNewsSourceBadge.classList.add(mode);

  const lang = localStorage.getItem('lang') || 'tr';
  const labels = {
    loading: { tr: 'Durum: Yukleniyor...', en: 'Status: Loading...' },
    static: { tr: 'Durum: Kaynak data/news.json', en: 'Status: Source data/news.json' },
    live: { tr: 'Durum: Canli RSS yedek akis', en: 'Status: Live RSS fallback feed' },
    cached: { tr: 'Durum: Onbellekten gosterim', en: 'Status: Served from cache' },
    local: { tr: 'Durum: Yerel yedek gosterim', en: 'Status: Local backup feed' },
  };

  const selected = labels[mode] || labels.loading;
  homeNewsSourceBadge.textContent = lang === 'tr' ? selected.tr : selected.en;
}

function formatRelativeDate(dateValue, lang) {
  if (!dateValue) {
    return lang === 'tr' ? 'Tarih belirtilmedi' : 'Date unavailable';
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return lang === 'tr' ? 'Tarih belirtilmedi' : 'Date unavailable';
  }

  return new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function sanitizeHtml(text) {
  const holder = document.createElement('div');
  holder.innerHTML = text;
  return holder.textContent || holder.innerText || '';
}

async function fetchRssItems(source) {
  const proxyUrl =
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(source.url);

  const response = await fetch(proxyUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Feed request failed: ' + source.company);
  }

  const xmlText = await response.text();
  const parsed = new DOMParser().parseFromString(xmlText, 'text/xml');
  const items = Array.from(parsed.querySelectorAll('item')).slice(0, 3);

  return items
    .map((item) => {
      const title = sanitizeHtml(item.querySelector('title')?.textContent || '').trim();
      const link = (item.querySelector('link')?.textContent || '').trim();
      const pubDate = (item.querySelector('pubDate')?.textContent || '').trim();

      if (!title || !link) {
        return null;
      }

      return {
        company: source.company,
        title,
        link,
        pubDate,
      };
    })
    .filter(Boolean);
}

function renderNewsItems(items) {
  latestNewsItems = items.slice();
  if (!newsList) return;

  const lang = localStorage.getItem('lang') || 'tr';
  newsList.innerHTML = '';

  const finalItems = items.slice(0, 9);

  finalItems.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'live-news-item';

    const safeTitle = sanitizeHtml(item.title);
    const safeCompany = sanitizeHtml(item.company);
    const safeDate = formatRelativeDate(item.pubDate, lang);

    const newsImage = document.createElement('img');
    newsImage.className = 'news-cover';
    newsImage.loading = 'lazy';
    newsImage.alt = safeCompany + ' news visual';
    newsImage.src = item.image || getNewsImageForCompany(item.company);

    const meta = document.createElement('div');
    meta.className = 'news-meta';

    const source = document.createElement('span');
    source.className = 'news-source';
    source.textContent = safeCompany;

    const time = document.createElement('span');
    time.className = 'news-time';
    time.textContent = safeDate;

    meta.appendChild(source);
    meta.appendChild(time);

    const titleLink = document.createElement('a');
    titleLink.className = 'news-title';
    titleLink.href = item.link;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';
    titleLink.textContent = safeTitle;

    li.appendChild(newsImage);
    li.appendChild(meta);
    li.appendChild(titleLink);

    newsList.appendChild(li);
  });

  applySiteSearch();
}

function renderHomeNewsPreview(items) {
  if (!homeFeaturedNews && !homeNewsStream) return;

  const lang = localStorage.getItem('lang') || 'tr';
  const finalItems = items.slice(0, 6);
  const featured = finalItems[0];

  if (homeFeaturedNews) {
    homeFeaturedNews.innerHTML = '';

    if (featured) {
      const safeTitle = sanitizeHtml(featured.title);
      const safeCompany = sanitizeHtml(featured.company);
      const safeDate = formatRelativeDate(featured.pubDate, lang);

      homeFeaturedNews.innerHTML =
        '<img class="home-featured-cover" src="' +
        (featured.image || getNewsImageForCompany(featured.company)) +
        '" alt="' +
        safeCompany +
        ' featured news visual">' +
        '<div class="home-featured-body">' +
        '<div class="news-meta">' +
        '<span class="news-source">' + safeCompany + '</span>' +
        '<span class="news-time">' + safeDate + '</span>' +
        '</div>' +
        '<a class="home-featured-title" href="' + featured.link + '" target="_blank" rel="noopener noreferrer">' + safeTitle + '</a>' +
        '</div>';
    }
  }

  if (homeNewsStream) {
    homeNewsStream.innerHTML = '';

    finalItems.slice(1).forEach((item) => {
      const safeTitle = sanitizeHtml(item.title);
      const safeCompany = sanitizeHtml(item.company);
      const safeDate = formatRelativeDate(item.pubDate, lang);
      const li = document.createElement('li');
      li.className = 'home-news-item';
      li.innerHTML =
        '<img class="home-news-thumb" src="' +
        (item.image || getNewsImageForCompany(item.company)) +
        '" alt="' + safeCompany + ' news visual">' +
        '<div class="home-news-copy">' +
        '<div class="news-meta">' +
        '<span class="news-source">' + safeCompany + '</span>' +
        '<span class="news-time">' + safeDate + '</span>' +
        '</div>' +
        '<a class="home-news-link" href="' + item.link + '" target="_blank" rel="noopener noreferrer">' + safeTitle + '</a>' +
        '</div>';
      homeNewsStream.appendChild(li);
    });
  }
}

async function fetchNewsFromStaticFile() {
  const response = await fetch('data/news.json?ts=' + Date.now(), {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Static news file unavailable');
  }

  const payload = await response.json();
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!items.length) {
    throw new Error('Static news file is empty');
  }

  return {
    items,
    generatedAt: payload.generatedAt || '',
  };
}

async function loadLiveNews() {
  if (!newsList && !homeFeaturedNews && !homeNewsStream) return;

  setHomeNewsSourceBadge('loading');
  setNewsStatus('Haberler yukleniyor...', 'Loading latest news...');
  if (refreshNewsBtn) refreshNewsBtn.disabled = true;

  try {
    const staticNews = await fetchNewsFromStaticFile();
    renderNewsItems(staticNews.items);
    renderHomeNewsPreview(staticNews.items);
    writeNewsCache(staticNews.items);
    setHomeNewsSourceBadge('static');

    const generatedDate = new Date(staticNews.generatedAt || Date.now());
    const trDate = new Intl.DateTimeFormat('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    }).format(generatedDate);

    const enDate = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    }).format(generatedDate);

    setNewsStatus(
      'Son guncelleme: ' + trDate + ' (GitHub Actions)',
      'Last update: ' + enDate + ' (GitHub Actions)'
    );
  } catch (error) {
    try {
      const responses = await Promise.allSettled(
        NEWS_SOURCES.map((source) => fetchRssItems(source))
      );

      const collected = responses
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => result.value)
        .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

      if (!collected.length) {
        throw new Error('No fallback items');
      }

      renderNewsItems(collected);
      renderHomeNewsPreview(collected);
      writeNewsCache(collected);
      setHomeNewsSourceBadge('live');
      setNewsStatus(
        'Canli yedek akistan gosteriliyor. GitHub veri dosyasi bekleniyor.',
        'Showing live fallback feed. Waiting for GitHub data file.'
      );
    } catch (fallbackError) {
      const cached = readNewsCache();

      if (cached && cached.items.length) {
        renderNewsItems(cached.items);
        renderHomeNewsPreview(cached.items);
        setHomeNewsSourceBadge('cached');
        setNewsStatus(
          'Canli kaynaklara erisilemedi. Onbellekteki son haberler gosteriliyor.',
          'Live sources are unavailable. Showing the latest cached news.'
        );
      } else {
        renderNewsItems(EMERGENCY_NEWS_FALLBACK);
        renderHomeNewsPreview(EMERGENCY_NEWS_FALLBACK);
        setHomeNewsSourceBadge('local');
        setNewsStatus(
          'Canli kaynaklara erisilemedi. Gosterim icin yerel yedek haberler kullaniliyor.',
          'Live sources are unavailable. Local backup news is being shown.'
        );
      }
    }
  } finally {
    if (refreshNewsBtn) refreshNewsBtn.disabled = false;
  }
}

if (refreshNewsBtn) {
  refreshNewsBtn.addEventListener('click', loadLiveNews);
}

if (siteSearchBtn) {
  siteSearchBtn.addEventListener('click', applySiteSearch);
}

if (siteSearchInput) {
  siteSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applySiteSearch();
    }
  });
}

if (siteSearchClearBtn && siteSearchInput) {
  siteSearchClearBtn.addEventListener('click', () => {
    siteSearchInput.value = '';
    applySiteSearch();
    siteSearchInput.focus();
  });
}

if (aiAskBtn) {
  aiAskBtn.addEventListener('click', askAiAssistant);
}

if (aiQuestionInput) {
  aiQuestionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      askAiAssistant();
    }
  });
}

loadLiveNews();
