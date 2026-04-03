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
    const lang = localStorage.getItem('lang') || 'tr';
    const message =
      lang === 'tr'
        ? 'Abone olma ozelligi yakinda eklenecek!'
        : 'Subscription feature coming soon!';
    alert(message);
  });
});

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
