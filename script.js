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
const newsFilterButtons = document.querySelectorAll('#home-news-filters [data-news-filter]');
const dailySummaryList = document.getElementById('daily-summary-list');
const miniCompareBody = document.getElementById('mini-compare-body');
const newsletterForm = document.getElementById('newsletter-form');
const newsletterEmail = document.getElementById('newsletter-email');
const newsletterStatus = document.getElementById('newsletter-status');
const followCompanyChips = document.querySelectorAll('#follow-company-chips input[type="checkbox"]');
const drawerDock = document.getElementById('drawer-dock');
const leftDrawer = document.getElementById('left-drawer-nav');
const leftDrawerToggle = document.getElementById('left-drawer-toggle');
const adMarquee = document.querySelector('.ad-marquee');
var homeNewsSourceBadge = null;
var latestHomeNewsMode = 'loading';
const AI_PLATFORM_CONFIG = {
  endpoint: window.ROBOLOGAI_AI_ENDPOINT || '',
  timeoutMs: 20000,
};
let latestNewsItems = [];
let activeNewsFilter = localStorage.getItem('homeNewsFilter') || 'all';
const FOLLOWED_COMPANIES_KEY = 'robologaiFollowCompaniesV1';
const COMPARE_TREND_CACHE_KEY = 'robologaiCompareTrendV1';

const NEWS_IMAGE_BY_COMPANY = {
  tesla: 'images/robots/tesla-original.jpg',
  unitree: 'images/robots/unitree-original.jpg',
  'figure ai': 'images/robots/figure-original.jpg',
  figure: 'images/robots/figure-original.jpg',
  'boston dynamics': 'images/robots/boston-original.jpg',
  'agility robotics': 'images/robots/agility-original.jpg',
  'reflex robotics': 'images/robots/reflex robotix.jpg',
  reflex: 'images/robots/reflex robotix.jpg',
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

  if (newsletterEmail) {
    const newsletterPlaceholder =
      lang === 'tr' ? newsletterEmail.dataset.phTr : newsletterEmail.dataset.phEn;
    if (newsletterPlaceholder) {
      newsletterEmail.placeholder = newsletterPlaceholder;
    }
  }
}

function normalizeCompanyName(company) {
  return String(company || '').trim().toLowerCase();
}

function getSelectedFollowCompanies() {
  if (!followCompanyChips.length) {
    return [];
  }

  return Array.from(followCompanyChips)
    .filter((chip) => chip.checked)
    .map((chip) => normalizeCompanyName(chip.value));
}

function getNewsCategory(item) {
  const text = (item.company + ' ' + item.title).toLowerCase();

  if (/invest|fund|series|financ|yatirim|yatırım|degerleme|valuation/.test(text)) {
    return 'investment';
  }

  if (/partner|isbir|işbir|joint|agreement|alliance|cooperate|ortak/.test(text)) {
    return 'partnership';
  }

  if (/demo|showcase|pilot|test|trial|tanitim|tanıtım|saha/.test(text)) {
    return 'demo';
  }

  if (/factory|manufact|production|line|deploy|rollout|uretim|üretim|seri/.test(text)) {
    return 'production';
  }

  return 'all';
}

function getImportanceNote(item, lang) {
  const category = getNewsCategory(item);

  if (lang === 'tr') {
    if (category === 'production') return 'Neden önemli: Ölçekleme ve gerçek operasyon sinyali veriyor.';
    if (category === 'partnership') return 'Neden önemli: Ekosistem entegrasyonu ve dağıtım gücünü artırıyor.';
    if (category === 'investment') return 'Neden önemli: Şirketin büyüme hızı için finansal güven oyu gösterir.';
    if (category === 'demo') return 'Neden önemli: Teknolojinin saha olgunluğunu doğrular.';
    return 'Neden önemli: Pazar yönünü okumak için erken bir sinyal sunuyor.';
  }

  if (category === 'production') return 'Why it matters: Signals scaling and real-world operations.';
  if (category === 'partnership') return 'Why it matters: Strengthens ecosystem integration and distribution.';
  if (category === 'investment') return 'Why it matters: Shows financial confidence in growth speed.';
  if (category === 'demo') return 'Why it matters: Confirms field maturity of the technology.';
  return 'Why it matters: Offers an early signal about market direction.';
}

function getFilteredNewsItems(items) {
  const selectedCompanies = getSelectedFollowCompanies();

  return items.filter((item) => {
    const companyMatch =
      !selectedCompanies.length ||
      selectedCompanies.includes(normalizeCompanyName(item.company));

    const categoryMatch =
      activeNewsFilter === 'all' || getNewsCategory(item) === activeNewsFilter;

    return companyMatch && categoryMatch;
  });
}

function formatMomentumScore(value, lang) {
  if (value >= 4) return lang === 'tr' ? 'Yuksek' : 'High';
  if (value >= 2) return lang === 'tr' ? 'Orta' : 'Medium';
  return lang === 'tr' ? 'Dusuk' : 'Low';
}

function getTrendDirection(current, previous) {
  if (typeof previous !== 'number') return 'flat';
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
}

function getTrendLabel(direction, lang) {
  if (direction === 'up') return lang === 'tr' ? 'Yukari' : 'Up';
  if (direction === 'down') return lang === 'tr' ? 'Asagi' : 'Down';
  return lang === 'tr' ? 'Sabit' : 'Flat';
}

function buildMomentumMeter(value, lang, trendDirection, deltaValue) {
  const score = Math.max(0, Math.min(5, Number(value) || 0));
  const percent = Math.round((score / 5) * 100);
  const delta = Number(deltaValue) || 0;

  const wrap = document.createElement('div');
  wrap.className = 'momentum-meter';

  const label = document.createElement('span');
  label.className = 'momentum-label';
  label.textContent = formatMomentumScore(score, lang);

  const trend = document.createElement('span');
  trend.className = 'momentum-trend momentum-trend-' + (trendDirection || 'flat');
  const deltaText = delta > 0 ? '+' + delta : String(delta);
  trend.textContent =
    (trendDirection === 'up' ? '▲ ' : trendDirection === 'down' ? '▼ ' : '● ') +
    deltaText + ' ' + getTrendLabel(trendDirection || 'flat', lang);

  const bar = document.createElement('div');
  bar.className = 'momentum-bar';

  const fill = document.createElement('div');
  fill.className = 'momentum-fill';
  fill.style.width = percent + '%';
  bar.appendChild(fill);

  const spark = document.createElement('div');
  spark.className = 'momentum-spark';

  for (let i = 1; i <= 5; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'momentum-dot';
    if (i <= score) {
      dot.classList.add('active');
    }
    spark.appendChild(dot);
  }

  wrap.appendChild(label);
  wrap.appendChild(trend);
  wrap.appendChild(bar);
  wrap.appendChild(spark);

  return wrap;
}

function updateDailySummary(items) {
  if (!dailySummaryList) return;

  const lang = localStorage.getItem('lang') || 'tr';
  dailySummaryList.innerHTML = '';

  const topItems = items.slice(0, 3);
  if (!topItems.length) {
    const li = document.createElement('li');
    li.textContent =
      lang === 'tr'
        ? 'Filtreye uygun haber yok. Takip modunu veya filtreyi degistir.'
        : 'No news matches this filter. Adjust follow mode or filters.';
    dailySummaryList.appendChild(li);
    return;
  }

  topItems.forEach((item) => {
    const li = document.createElement('li');
    li.textContent =
      sanitizeHtml(item.company) + ': ' + sanitizeHtml(item.title) + ' - ' + getImportanceNote(item, lang);
    dailySummaryList.appendChild(li);
  });
}

function updateMiniCompareTable(items) {
  if (!miniCompareBody) return;

  const lang = localStorage.getItem('lang') || 'tr';
  let previousCounts = {};
  try {
    const raw = localStorage.getItem(COMPARE_TREND_CACHE_KEY);
    previousCounts = raw ? JSON.parse(raw) : {};
  } catch (error) {
    previousCounts = {};
  }

  const nextCounts = {};

  const targets = [
    { name: 'Tesla', focusTr: 'Humanoid + uretim', focusEn: 'Humanoid + production' },
    { name: 'Figure AI', focusTr: 'Saha demo + ortaklik', focusEn: 'Field demo + partnerships' },
    { name: 'Unitree', focusTr: 'Maliyet/performans robotik', focusEn: 'Cost/performance robotics' },
  ];

  miniCompareBody.innerHTML = '';
  targets.forEach((target) => {
    const related = items.filter(
      (item) => normalizeCompanyName(item.company) === normalizeCompanyName(target.name)
    );
    const normalizedTarget = normalizeCompanyName(target.name);
    const previous = Number(previousCounts[normalizedTarget]);
    const hasPrevious = Number.isFinite(previous);
    const delta = hasPrevious ? related.length - previous : 0;
    const trendDirection = getTrendDirection(related.length, previous);
    nextCounts[normalizedTarget] = related.length;

    const latest = related[0];
    const tr = document.createElement('tr');

    const c1 = document.createElement('td');
    c1.textContent = target.name;

    const c2 = document.createElement('td');
    c2.textContent = lang === 'tr' ? target.focusTr : target.focusEn;

    const c3 = document.createElement('td');
    c3.textContent = latest
      ? formatRelativeDate(latest.pubDate, lang)
      : lang === 'tr'
        ? 'Bekleniyor'
        : 'Pending';

    const c4 = document.createElement('td');
    c4.appendChild(buildMomentumMeter(related.length, lang, trendDirection, delta));

    tr.appendChild(c1);
    tr.appendChild(c2);
    tr.appendChild(c3);
    tr.appendChild(c4);
    miniCompareBody.appendChild(tr);
  });

  localStorage.setItem(COMPARE_TREND_CACHE_KEY, JSON.stringify(nextCounts));
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
    renderHomeNewsPreview(latestNewsItems);
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

if (drawerDock && leftDrawer && leftDrawerToggle) {
  const narrowScreenQuery = window.matchMedia('(max-width: 980px)');

  const setDrawerState = (isOpen) => {
    drawerDock.classList.toggle('left-drawer-open', isOpen);
    leftDrawerToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  setDrawerState(!narrowScreenQuery.matches);

  leftDrawerToggle.addEventListener('click', () => {
    const currentlyOpen = drawerDock.classList.contains('left-drawer-open');
    setDrawerState(!currentlyOpen);
  });

  leftDrawer.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (narrowScreenQuery.matches) {
        setDrawerState(false);
      }
    });
  });

  const handleScreenChange = () => {
    setDrawerState(!narrowScreenQuery.matches);
  };

  if (typeof narrowScreenQuery.addEventListener === 'function') {
    narrowScreenQuery.addEventListener('change', handleScreenChange);
  } else if (typeof narrowScreenQuery.addListener === 'function') {
    narrowScreenQuery.addListener(handleScreenChange);
  }
}

if (adMarquee) {
  let isDragging = false;
  let startX = 0;
  let startScrollLeft = 0;
  let draggedDistance = 0;

  const stopDrag = () => {
    isDragging = false;
    adMarquee.classList.remove('is-dragging');
  };

  adMarquee.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;

    isDragging = true;
    startX = event.clientX;
    startScrollLeft = adMarquee.scrollLeft;
    draggedDistance = 0;
    adMarquee.classList.add('is-dragging');

    if (typeof adMarquee.setPointerCapture === 'function') {
      adMarquee.setPointerCapture(event.pointerId);
    }
  });

  adMarquee.addEventListener('pointermove', (event) => {
    if (!isDragging) return;

    const deltaX = event.clientX - startX;
    draggedDistance = Math.max(draggedDistance, Math.abs(deltaX));
    adMarquee.scrollLeft = startScrollLeft - deltaX;
  });

  adMarquee.addEventListener('pointerup', stopDrag);
  adMarquee.addEventListener('pointercancel', stopDrag);
  adMarquee.addEventListener('dragstart', (event) => event.preventDefault());

  adMarquee.addEventListener(
    'click',
    (event) => {
      if (draggedDistance > 5) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );
}

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
const drawerMiniNewsList = document.getElementById('drawer-mini-news-list');
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
  const filteredItems = getFilteredNewsItems(items);
  renderDrawerMiniNews(filteredItems);
  updateDailySummary(filteredItems);
  updateMiniCompareTable(filteredItems);

  if (!newsList) {
    applySiteSearch();
    return;
  }

  const lang = localStorage.getItem('lang') || 'tr';
  newsList.innerHTML = '';

  const finalItems = filteredItems.slice(0, 9);

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

    const importance = document.createElement('p');
    importance.className = 'news-importance';
    importance.textContent = getImportanceNote(item, lang);

    li.appendChild(newsImage);
    li.appendChild(meta);
    li.appendChild(titleLink);
    li.appendChild(importance);

    newsList.appendChild(li);
  });

  applySiteSearch();
}

function renderDrawerMiniNews(items) {
  if (!drawerMiniNewsList) return;

  const lang = localStorage.getItem('lang') || 'tr';
  drawerMiniNewsList.innerHTML = '';

  const miniItems = items.slice(0, 3);
  if (!miniItems.length) {
    const emptyState = document.createElement('li');
    emptyState.className = 'drawer-mini-item';
    emptyState.textContent =
      lang === 'tr' ? 'Henüz haber bulunamadı.' : 'No news available yet.';
    drawerMiniNewsList.appendChild(emptyState);
    return;
  }

  miniItems.forEach((item) => {
    const safeTitle = sanitizeHtml(item.title);
    const safeCompany = sanitizeHtml(item.company);
    const safeDate = formatRelativeDate(item.pubDate, lang);
    const safeImage = item.image || getNewsImageForCompany(item.company);

    const li = document.createElement('li');
    li.className = 'drawer-mini-item';

    const thumb = document.createElement('img');
    thumb.className = 'drawer-mini-thumb';
    thumb.loading = 'lazy';
    thumb.alt = safeCompany + ' mini news visual';
    thumb.src = safeImage;

    const body = document.createElement('div');
    body.className = 'drawer-mini-body';

    const head = document.createElement('div');
    head.className = 'drawer-mini-head';

    const source = document.createElement('span');
    source.className = 'drawer-mini-source';
    source.textContent = safeCompany;

    const time = document.createElement('span');
    time.className = 'drawer-mini-time';
    time.textContent = safeDate;

    const link = document.createElement('a');
    link.className = 'drawer-mini-link';
    link.href = item.link;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = safeTitle;

    head.appendChild(source);
    head.appendChild(time);

    body.appendChild(head);
    body.appendChild(link);

    li.appendChild(thumb);
    li.appendChild(body);
    drawerMiniNewsList.appendChild(li);
  });
}

function renderHomeNewsPreview(items) {
  if (!homeFeaturedNews && !homeNewsStream) return;

  const lang = localStorage.getItem('lang') || 'tr';
  const finalItems = getFilteredNewsItems(items).slice(0, 6);
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
        '<p class="news-importance">' + getImportanceNote(featured, lang) + '</p>' +
        '</div>';
    } else {
      homeFeaturedNews.innerHTML =
        '<div class="home-featured-body"><p class="news-importance">' +
        (lang === 'tr'
          ? 'Filtreye uygun haber bulunamadi. Filtreleri degistirebilirsin.'
          : 'No news matched this filter. You can adjust filters.') +
        '</p></div>';
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
        '<p class="news-importance">' + getImportanceNote(item, lang) + '</p>' +
        '<a class="home-news-link" href="' + item.link + '" target="_blank" rel="noopener noreferrer">' + safeTitle + '</a>' +
        '</div>';
      homeNewsStream.appendChild(li);
    });
  }
}

function syncNewsFilterButtons() {
  if (!newsFilterButtons.length) return;

  newsFilterButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.newsFilter === activeNewsFilter);
  });
}

function setupFollowMode() {
  if (!followCompanyChips.length) return;

  let selected = [];
  try {
    const saved = localStorage.getItem(FOLLOWED_COMPANIES_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    selected = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    selected = [];
  }

  followCompanyChips.forEach((chip) => {
    chip.checked = selected.includes(chip.value);
    chip.addEventListener('change', () => {
      const values = getSelectedFollowCompanies();
      const originalCase = values.map((value) => {
        const match = Array.from(followCompanyChips).find(
          (chipItem) => normalizeCompanyName(chipItem.value) === value
        );
        return match ? match.value : value;
      });
      localStorage.setItem(FOLLOWED_COMPANIES_KEY, JSON.stringify(originalCase));
      if (latestNewsItems.length) {
        renderNewsItems(latestNewsItems);
        renderHomeNewsPreview(latestNewsItems);
      }
    });
  });
}

if (newsletterForm && newsletterEmail && newsletterStatus) {
  newsletterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const lang = localStorage.getItem('lang') || 'tr';
    if (!newsletterForm.checkValidity()) {
      newsletterForm.reportValidity();
      return;
    }

    const email = newsletterEmail.value.trim();
    const subject =
      lang === 'tr'
        ? 'RoboLogAI Haftalik Bulten Kaydi'
        : 'RoboLogAI Weekly Digest Signup';
    const body =
      lang === 'tr'
        ? 'Merhaba, haftalik bultene bu e-posta ile katilmak istiyorum: ' + email
        : 'Hello, I want to join the weekly digest with this email: ' + email;

    window.location.href =
      'mailto:robologai@gmail.com?subject=' +
      encodeURIComponent(subject) +
      '&body=' +
      encodeURIComponent(body);

    newsletterStatus.textContent =
      lang === 'tr'
        ? 'E-posta taslagi acildi. Gonderince bultene kayit talebin iletilecek.'
        : 'Email draft opened. Send it to request digest signup.';
  });
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

if (newsFilterButtons.length) {
  syncNewsFilterButtons();
  newsFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeNewsFilter = button.dataset.newsFilter || 'all';
      localStorage.setItem('homeNewsFilter', activeNewsFilter);
      syncNewsFilterButtons();
      if (latestNewsItems.length) {
        renderNewsItems(latestNewsItems);
        renderHomeNewsPreview(latestNewsItems);
      }
    });
  });
}

setupFollowMode();

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
