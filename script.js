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
const topSearchToggle = document.querySelector('.top-search-link');
const topSearchPopover = document.getElementById('top-search-popover');
const topSearchMiniInput = document.getElementById('top-search-mini-input');
const topSearchMiniGo = document.getElementById('top-search-mini-go');
const TOP_SEARCH_RECENT_KEY = 'topSearchRecent';
let latestNewsItems = [];

function getRecentTopSearches() {
  try {
    const saved = localStorage.getItem(TOP_SEARCH_RECENT_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function renderRecentTopSearches() {
  if (!topSearchPopover) return;

  let container = topSearchPopover.querySelector('.top-search-recent');
  if (!container) {
    container = document.createElement('div');
    container.className = 'top-search-recent';
    topSearchPopover.appendChild(container);
  }

  const lang = localStorage.getItem('lang') || 'tr';
  const recent = getRecentTopSearches();

  if (!recent.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML =
    '<span class="recent-label">' +
    (lang === 'tr' ? 'Son aramalar:' : 'Recent searches:') +
    '</span>';

  recent.forEach((term) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'recent-chip';
    btn.textContent = term;
    btn.addEventListener('click', () => {
      if (!topSearchMiniInput) return;
      topSearchMiniInput.value = term;
      submitTopSearch();
    });
    container.appendChild(btn);
  });

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'recent-clear-btn';
  clearBtn.textContent = lang === 'tr' ? 'Temizle' : 'Clear';
  clearBtn.addEventListener('click', () => {
    localStorage.removeItem(TOP_SEARCH_RECENT_KEY);
    renderRecentTopSearches();
  });
  container.appendChild(clearBtn);
}

function saveRecentTopSearch(term) {
  const normalized = term.trim();
  if (!normalized) return;

  const recent = getRecentTopSearches().filter(
    (item) => item.toLowerCase() !== normalized.toLowerCase()
  );
  recent.unshift(normalized);
  const limited = recent.slice(0, 6);
  localStorage.setItem(TOP_SEARCH_RECENT_KEY, JSON.stringify(limited));
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

  if (topSearchMiniInput) {
    const miniPlaceholder =
      lang === 'tr' ? topSearchMiniInput.dataset.phTr : topSearchMiniInput.dataset.phEn;
    if (miniPlaceholder) {
      topSearchMiniInput.placeholder = miniPlaceholder;
    }
  }
}

function submitTopSearch() {
  const keyword = (topSearchMiniInput?.value || '').trim();
  if (keyword) {
    saveRecentTopSearch(keyword);
    renderRecentTopSearches();
  }

  const onIndexPage =
    window.location.pathname.endsWith('/index.html') ||
    window.location.pathname === '/' ||
    window.location.pathname.endsWith('/humanoid-robot-economy/');

  if (onIndexPage && siteSearchInput) {
    siteSearchInput.value = keyword;
    applySiteSearch();
    const target = document.getElementById('site-search');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (topSearchPopover) topSearchPopover.classList.add('hidden');
    return;
  }

  const query = keyword ? '?q=' + encodeURIComponent(keyword) : '';
  window.location.href = 'index.html' + query + '#site-search';
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

function setNewsStatus(trText, enText) {
  if (newsStatusTr) newsStatusTr.textContent = trText;
  if (newsStatusEn) newsStatusEn.textContent = enText;
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
  if (!newsList) return;

  latestNewsItems = items.slice();
  const lang = localStorage.getItem('lang') || 'tr';
  newsList.innerHTML = '';

  const finalItems = items.slice(0, 9);

  finalItems.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'live-news-item';

    const safeTitle = sanitizeHtml(item.title);
    const safeCompany = sanitizeHtml(item.company);
    const safeDate = formatRelativeDate(item.pubDate, lang);

    li.innerHTML =
      '<div class="news-meta">' +
      '<span class="news-source">' +
      safeCompany +
      '</span>' +
      '<span class="news-time">' +
      safeDate +
      '</span>' +
      '</div>' +
      '<a class="news-title" href="' +
      item.link +
      '" target="_blank" rel="noopener noreferrer">' +
      safeTitle +
      '</a>';

    newsList.appendChild(li);
  });

  applySiteSearch();
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
  if (!newsList || !newsStatusTr || !newsStatusEn) return;

  setNewsStatus('Haberler yukleniyor...', 'Loading latest news...');
  if (refreshNewsBtn) refreshNewsBtn.disabled = true;

  try {
    const staticNews = await fetchNewsFromStaticFile();
    renderNewsItems(staticNews.items);

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
      setNewsStatus(
        'Canli yedek akistan gosteriliyor. GitHub veri dosyasi bekleniyor.',
        'Showing live fallback feed. Waiting for GitHub data file.'
      );
    } catch (fallbackError) {
      setNewsStatus(
        'Su an haber akisi alinamadi. Biraz sonra tekrar deneyin.',
        'Could not load news feed right now. Please try again shortly.'
      );
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

if (topSearchToggle && topSearchPopover) {
  topSearchToggle.addEventListener('click', () => {
    topSearchPopover.classList.toggle('hidden');
    if (!topSearchPopover.classList.contains('hidden') && topSearchMiniInput) {
      renderRecentTopSearches();
      topSearchMiniInput.focus();
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      !topSearchPopover.contains(target) &&
      !topSearchToggle.contains(target) &&
      !topSearchPopover.classList.contains('hidden')
    ) {
      topSearchPopover.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !topSearchPopover.classList.contains('hidden')) {
      topSearchPopover.classList.add('hidden');
      if (topSearchMiniInput) {
        topSearchMiniInput.blur();
      }
    }
  });
}

if (topSearchMiniGo) {
  topSearchMiniGo.addEventListener('click', submitTopSearch);
}

if (topSearchMiniInput) {
  topSearchMiniInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitTopSearch();
    }
  });
}

loadLiveNews();
