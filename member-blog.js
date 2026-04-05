const MEMBER_BLOG_STORAGE_KEY = 'memberBlogPostsV1';
const MEMBER_POSTS_TABLE = 'member_posts';
const MEMBER_COMMENTS_TABLE = 'member_comments';
const MEMBER_EDGE_FUNCTION = 'member-submit';
const MEMBER_POST_RATE_LIMIT_MS = 60 * 1000;
const MEMBER_COMMENT_RATE_LIMIT_MS = 20 * 1000;
const MEMBER_POST_RATE_KEY = 'memberBlogPostLastAt';
const MEMBER_COMMENT_RATE_KEY = 'memberBlogCommentLastAt';
const MEMBER_MAX_POST_CHARS = 1200;
const MEMBER_MAX_COMMENT_CHARS = 280;

const MEMBER_BLOCKED_WORDS = [
  'casino',
  'bet',
  'free money',
  'win now',
  'telegram',
  'whatsapp group',
  'crypto signal',
  'adult',
  'porn',
];

const MEMBER_EXPERT_AUTHORS = ['robologai', 'editor', 'mod', 'admin'];

const memberPostForm = document.getElementById('member-post-form');
const memberPostStatus = document.getElementById('member-post-status');
const memberPostList = document.getElementById('member-post-list');
const memberBlogEmptyTr = document.getElementById('member-blog-empty');
const memberBlogEmptyEn = document.getElementById('member-blog-empty-en');
const memberBlogMode = document.getElementById('member-blog-mode');
const memberPostCaptchaQuestion = document.getElementById('member-post-captcha-q');
const memberPostCaptchaInput = document.getElementById('member-post-captcha');

let memberPosts = [];
let supabaseClient = null;
let useRemoteStore = false;
let memberPostCaptchaAnswer = '';

const memberConfig = {
  edgeGuard: window.MEMBER_BLOG_ENABLE_EDGE_GUARD !== false,
  requireApproved: window.MEMBER_BLOG_REQUIRE_APPROVED !== false,
  clientWordFilter: window.MEMBER_BLOG_ENABLE_CLIENT_WORD_FILTER !== false,
};

function getUiLang() {
  return localStorage.getItem('lang') || 'tr';
}

function memberText(trText, enText) {
  return getUiLang() === 'tr' ? trText : enText;
}

function safeText(value) {
  return String(value || '').trim();
}

function toLowerSafe(value) {
  return safeText(value).toLocaleLowerCase('en-US');
}

function containsBlockedWords(text) {
  if (!memberConfig.clientWordFilter) {
    return false;
  }

  const normalized = toLowerSafe(text);
  return MEMBER_BLOCKED_WORDS.some((word) => normalized.includes(word));
}

function hasTooManyLinks(text) {
  const links = safeText(text).match(/https?:\/\/|www\./gi);
  return Array.isArray(links) && links.length > 2;
}

function isExpertAuthor(name) {
  const normalized = toLowerSafe(name);
  return MEMBER_EXPERT_AUTHORS.some((token) => normalized.includes(token));
}

function createCaptcha() {
  const a = Math.floor(Math.random() * 8) + 1;
  const b = Math.floor(Math.random() * 8) + 1;
  return {
    question: a + ' + ' + b + ' = ?',
    answer: String(a + b),
  };
}

function setupPostCaptcha() {
  if (!memberPostCaptchaQuestion) return;
  const captcha = createCaptcha();
  memberPostCaptchaAnswer = captcha.answer;
  memberPostCaptchaQuestion.textContent = memberText('Guvenlik sorusu: ', 'Security check: ') + captcha.question;
  if (memberPostCaptchaInput) {
    memberPostCaptchaInput.value = '';
  }
}

function getRemainingCooldown(storageKey, limitMs) {
  const now = Date.now();
  const lastAt = Number(localStorage.getItem(storageKey) || 0);
  const remaining = lastAt + limitMs - now;
  return remaining > 0 ? remaining : 0;
}

function markActionNow(storageKey) {
  localStorage.setItem(storageKey, String(Date.now()));
}

function formatCooldown(remainingMs) {
  const seconds = Math.ceil(remainingMs / 1000);
  return memberText(seconds + ' sn bekleyin.', 'Please wait ' + seconds + 's.');
}

function validateCaptcha(userInput, expectedAnswer) {
  return safeText(userInput) === safeText(expectedAnswer);
}

function setModeBadge(isLive) {
  if (!memberBlogMode) return;

  memberBlogMode.classList.remove('live', 'local', 'guarded');
  if (isLive) {
    memberBlogMode.classList.add('live');
    if (memberConfig.edgeGuard) {
      memberBlogMode.classList.add('guarded');
      memberBlogMode.textContent = memberText(
        'Canli topluluk modu + spam korumasi acik',
        'Live community mode + anti-spam guard enabled'
      );
    } else {
      memberBlogMode.textContent = memberText('Canli topluluk modu acik', 'Live community mode enabled');
    }
  } else {
    memberBlogMode.classList.add('local');
    memberBlogMode.textContent = memberText('Yerel mod: Bu cihazda saklaniyor', 'Local mode: Stored on this device');
  }
}

function formatMemberDate(isoValue) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return memberText('Tarih yok', 'Date unavailable');
  }

  return new Intl.DateTimeFormat(getUiLang() === 'tr' ? 'tr-TR' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function readLocalPosts() {
  try {
    const raw = localStorage.getItem(MEMBER_BLOG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    memberPosts = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    memberPosts = [];
  }
}

function saveLocalPosts() {
  localStorage.setItem(MEMBER_BLOG_STORAGE_KEY, JSON.stringify(memberPosts));
}

function normalizeRemoteRows(postRows, commentRows) {
  const commentsByPost = new Map();

  commentRows.forEach((row) => {
    const list = commentsByPost.get(String(row.post_id)) || [];
    list.push({
      id: row.id,
      name: safeText(row.name),
      message: safeText(row.message),
      createdAt: row.created_at,
    });
    commentsByPost.set(String(row.post_id), list);
  });

  memberPosts = postRows.map((row) => ({
    id: String(row.id),
    name: safeText(row.name),
    title: safeText(row.title),
    content: safeText(row.content),
    createdAt: row.created_at,
    comments: commentsByPost.get(String(row.id)) || [],
  }));
}

async function initRemoteStore() {
  const url = safeText(window.MEMBER_BLOG_SUPABASE_URL);
  const anonKey = safeText(window.MEMBER_BLOG_SUPABASE_ANON_KEY);

  if (!url || !anonKey || !window.supabase || !window.supabase.createClient) {
    useRemoteStore = false;
    setModeBadge(false);
    return;
  }

  try {
    supabaseClient = window.supabase.createClient(url, anonKey);

    const ping = await supabaseClient
      .from(MEMBER_POSTS_TABLE)
      .select('id', { count: 'exact', head: true });

    if (ping.error) {
      throw ping.error;
    }

    useRemoteStore = true;
    setModeBadge(true);
  } catch (error) {
    useRemoteStore = false;
    supabaseClient = null;
    setModeBadge(false);
  }
}

async function loadPosts() {
  if (!useRemoteStore || !supabaseClient) {
    readLocalPosts();
    return;
  }

  let postsResult;
  let commentsResult;

  if (memberConfig.requireApproved) {
    [postsResult, commentsResult] = await Promise.all([
      supabaseClient
        .from(MEMBER_POSTS_TABLE)
        .select('id,name,title,content,created_at,approved')
        .eq('approved', true)
        .order('created_at', { ascending: false }),
      supabaseClient
        .from(MEMBER_COMMENTS_TABLE)
        .select('id,post_id,name,message,created_at,approved')
        .eq('approved', true)
        .order('created_at', { ascending: true }),
    ]);

    if (postsResult.error || commentsResult.error) {
      // Backward compatibility when approved column does not exist yet.
      [postsResult, commentsResult] = await Promise.all([
        supabaseClient
          .from(MEMBER_POSTS_TABLE)
          .select('id,name,title,content,created_at')
          .order('created_at', { ascending: false }),
        supabaseClient
          .from(MEMBER_COMMENTS_TABLE)
          .select('id,post_id,name,message,created_at')
          .order('created_at', { ascending: true }),
      ]);
    }
  } else {
    [postsResult, commentsResult] = await Promise.all([
      supabaseClient
        .from(MEMBER_POSTS_TABLE)
        .select('id,name,title,content,created_at')
        .order('created_at', { ascending: false }),
      supabaseClient
        .from(MEMBER_COMMENTS_TABLE)
        .select('id,post_id,name,message,created_at')
        .order('created_at', { ascending: true }),
    ]);
  }

  if (postsResult.error || commentsResult.error) {
    throw postsResult.error || commentsResult.error;
  }

  normalizeRemoteRows(postsResult.data || [], commentsResult.data || []);
}

async function persistPost(post) {
  if (!useRemoteStore || !supabaseClient) {
    memberPosts.push(post);
    saveLocalPosts();
    return { moderated: false, via: 'local' };
  }

  if (memberConfig.edgeGuard) {
    const edgeResult = await supabaseClient.functions.invoke(MEMBER_EDGE_FUNCTION, {
      body: {
        action: 'create_post',
        payload: {
          name: post.name,
          title: post.title,
          content: post.content,
        },
      },
    });

    if (edgeResult.error) {
      throw edgeResult.error;
    }

    return {
      moderated: Boolean(edgeResult.data && edgeResult.data.moderated),
      via: 'edge',
    };
  }

  const result = await supabaseClient
    .from(MEMBER_POSTS_TABLE)
    .insert({
      name: post.name,
      title: post.title,
      content: post.content,
      approved: true,
    })
    .select('id')
    .single();

  if (result.error) {
    throw result.error;
  }

  return { moderated: false, via: 'direct' };
}

async function persistComment(postId, comment) {
  if (!useRemoteStore || !supabaseClient) {
    const post = memberPosts.find((item) => item.id === postId);
    if (!post) return;
    if (!Array.isArray(post.comments)) {
      post.comments = [];
    }
    post.comments.push(comment);
    saveLocalPosts();
    return { moderated: false, via: 'local' };
  }

  if (memberConfig.edgeGuard) {
    const edgeResult = await supabaseClient.functions.invoke(MEMBER_EDGE_FUNCTION, {
      body: {
        action: 'create_comment',
        payload: {
          postId,
          name: comment.name,
          message: comment.message,
        },
      },
    });

    if (edgeResult.error) {
      throw edgeResult.error;
    }

    return {
      moderated: Boolean(edgeResult.data && edgeResult.data.moderated),
      via: 'edge',
    };
  }

  const result = await supabaseClient
    .from(MEMBER_COMMENTS_TABLE)
    .insert({
      post_id: postId,
      name: comment.name,
      message: comment.message,
      approved: true,
    });

  if (result.error) {
    throw result.error;
  }

  return { moderated: false, via: 'direct' };
}

function createCommentItem(comment) {
  const item = document.createElement('li');
  item.className = 'member-comment-item';

  const meta = document.createElement('div');
  meta.className = 'member-comment-meta';
  meta.textContent = safeText(comment.name) + ' • ' + formatMemberDate(comment.createdAt);

  const body = document.createElement('p');
  body.className = 'member-comment-body';
  body.textContent = safeText(comment.message);

  item.appendChild(meta);
  item.appendChild(body);
  return item;
}

function createCommentForm(postId) {
  const form = document.createElement('form');
  form.className = 'member-comment-form';
  form.dataset.postId = postId;

  const captcha = createCaptcha();
  form.dataset.captchaAnswer = captcha.answer;

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.name = 'commentName';
  nameInput.required = true;
  nameInput.placeholder = memberText('Adin', 'Your name');

  const messageInput = document.createElement('input');
  messageInput.type = 'text';
  messageInput.name = 'commentMessage';
  messageInput.required = true;
  messageInput.placeholder = memberText('Yorumunu yaz', 'Write your comment');

  const captchaQuestion = document.createElement('span');
  captchaQuestion.className = 'member-comment-captcha-q';
  captchaQuestion.textContent = captcha.question;

  const captchaInput = document.createElement('input');
  captchaInput.type = 'text';
  captchaInput.name = 'commentCaptcha';
  captchaInput.required = true;
  captchaInput.placeholder = memberText('Sonuc', 'Result');

  const honeypot = document.createElement('input');
  honeypot.type = 'text';
  honeypot.name = 'commentWebsite';
  honeypot.className = 'member-honeypot';
  honeypot.tabIndex = -1;
  honeypot.autocomplete = 'off';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'btn btn-alt';
  submit.textContent = memberText('Yorum Yap', 'Comment');

  const status = document.createElement('p');
  status.className = 'member-comment-status';
  status.setAttribute('aria-live', 'polite');

  form.appendChild(nameInput);
  form.appendChild(messageInput);
  form.appendChild(captchaQuestion);
  form.appendChild(captchaInput);
  form.appendChild(honeypot);
  form.appendChild(submit);
  form.appendChild(status);

  return form;
}

function createPostCard(post) {
  const article = document.createElement('article');
  article.className = 'member-post-card';

  const head = document.createElement('div');
  head.className = 'member-post-head';

  const author = document.createElement('strong');
  author.textContent = safeText(post.name);

  if (isExpertAuthor(post.name)) {
    const badge = document.createElement('span');
    badge.className = 'member-author-badge';
    badge.textContent = memberText('Uzman Yorum', 'Expert Insight');
    author.appendChild(badge);
  }

  const time = document.createElement('span');
  time.className = 'member-post-time';
  time.textContent = formatMemberDate(post.createdAt);

  head.appendChild(author);
  head.appendChild(time);

  const title = document.createElement('h3');
  title.className = 'member-post-title';
  title.textContent = safeText(post.title);

  const content = document.createElement('p');
  content.className = 'member-post-body';
  content.textContent = safeText(post.content);

  const commentsTitle = document.createElement('h4');
  commentsTitle.className = 'member-comments-title';
  commentsTitle.textContent = memberText('Yorumlar', 'Comments');

  const commentsList = document.createElement('ul');
  commentsList.className = 'member-comment-list';
  (post.comments || []).forEach((comment) => {
    commentsList.appendChild(createCommentItem(comment));
  });

  const commentForm = createCommentForm(post.id);

  article.appendChild(head);
  article.appendChild(title);
  article.appendChild(content);
  article.appendChild(commentsTitle);
  article.appendChild(commentsList);
  article.appendChild(commentForm);

  return article;
}

function renderMemberPosts() {
  if (!memberPostList) return;

  memberPostList.innerHTML = '';
  const sorted = memberPosts.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!sorted.length) {
    if (memberBlogEmptyTr) memberBlogEmptyTr.style.display = getUiLang() === 'tr' ? 'block' : 'none';
    if (memberBlogEmptyEn) memberBlogEmptyEn.style.display = getUiLang() === 'en' ? 'block' : 'none';
    return;
  }

  if (memberBlogEmptyTr) memberBlogEmptyTr.style.display = 'none';
  if (memberBlogEmptyEn) memberBlogEmptyEn.style.display = 'none';

  sorted.forEach((post) => {
    memberPostList.appendChild(createPostCard(post));
  });
}

async function refreshPostsWithFallback() {
  try {
    await loadPosts();
  } catch (error) {
    useRemoteStore = false;
    setModeBadge(false);
    readLocalPosts();
  }
  renderMemberPosts();
}

async function addPost(event) {
  event.preventDefault();

  const formData = new FormData(memberPostForm);
  const name = safeText(formData.get('name'));
  const title = safeText(formData.get('title'));
  const content = safeText(formData.get('content'));
  const captchaValue = safeText(formData.get('captcha'));
  const website = safeText(formData.get('website'));

  if (!name || !title || !content) {
    if (memberPostStatus) {
      memberPostStatus.textContent = memberText('Lutfen tum alanlari doldurun.', 'Please fill in all fields.');
    }
    return;
  }

  if (content.length > MEMBER_MAX_POST_CHARS) {
    if (memberPostStatus) {
      memberPostStatus.textContent = memberText(
        'Gonderi metni cok uzun (max 1200 karakter).',
        'Post is too long (max 1200 chars).'
      );
    }
    return;
  }

  if (containsBlockedWords(title + ' ' + content) || hasTooManyLinks(content)) {
    if (memberPostStatus) {
      memberPostStatus.textContent = memberText(
        'Mesaj spam filtresine takildi. Icerigi duzenleyip tekrar deneyin.',
        'Message was blocked by spam filter. Edit content and retry.'
      );
    }
    return;
  }

  if (website) {
    return;
  }

  if (!validateCaptcha(captchaValue, memberPostCaptchaAnswer)) {
    if (memberPostStatus) {
      memberPostStatus.textContent = memberText('Guvenlik sorusu hatali.', 'Security answer is incorrect.');
    }
    setupPostCaptcha();
    return;
  }

  const postCooldown = getRemainingCooldown(MEMBER_POST_RATE_KEY, MEMBER_POST_RATE_LIMIT_MS);
  if (postCooldown > 0) {
    if (memberPostStatus) {
      memberPostStatus.textContent = memberText('Cok hizli gonderiyorsun. ', 'You are posting too fast. ') + formatCooldown(postCooldown);
    }
    return;
  }

  const post = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    title,
    content,
    createdAt: new Date().toISOString(),
    comments: [],
  };

  try {
    const postResult = await persistPost(post);
    markActionNow(MEMBER_POST_RATE_KEY);
    memberPostForm.reset();
    setupPostCaptcha();
    if (memberPostStatus) {
      memberPostStatus.textContent = postResult.moderated
        ? memberText('Gonderin moderasyon sirasina alindi.', 'Your post was sent to moderation queue.')
        : memberText('Gonderin paylasildi.', 'Post published.');
    }
    await refreshPostsWithFallback();
  } catch (error) {
    if (memberPostStatus) {
      memberPostStatus.textContent = memberText('Gonderi paylasilamadi.', 'Could not publish post.');
    }
  }
}

async function addComment(event) {
  event.preventDefault();

  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.classList.contains('member-comment-form')) {
    return;
  }

  const postId = safeText(form.dataset.postId);
  const formData = new FormData(form);
  const name = safeText(formData.get('commentName'));
  const message = safeText(formData.get('commentMessage'));
  const captchaValue = safeText(formData.get('commentCaptcha'));
  const expectedCaptcha = safeText(form.dataset.captchaAnswer);
  const honeypot = safeText(formData.get('commentWebsite'));
  const status = form.querySelector('.member-comment-status');

  if (!postId || !name || !message) {
    if (status) {
      status.textContent = memberText('Tum alanlari doldurun.', 'Fill in all fields.');
    }
    return;
  }

  if (message.length > MEMBER_MAX_COMMENT_CHARS) {
    if (status) {
      status.textContent = memberText('Yorum cok uzun (max 280 karakter).', 'Comment is too long (max 280 chars).');
    }
    return;
  }

  if (containsBlockedWords(message) || hasTooManyLinks(message)) {
    if (status) {
      status.textContent = memberText(
        'Yorum spam filtresine takildi.',
        'Comment was blocked by spam filter.'
      );
    }
    return;
  }

  if (honeypot) {
    return;
  }

  if (!validateCaptcha(captchaValue, expectedCaptcha)) {
    if (status) {
      status.textContent = memberText('Guvenlik sorusu hatali.', 'Security answer is incorrect.');
    }
    return;
  }

  const commentCooldown = getRemainingCooldown(MEMBER_COMMENT_RATE_KEY, MEMBER_COMMENT_RATE_LIMIT_MS);
  if (commentCooldown > 0) {
    if (status) {
      status.textContent = memberText('Yorumlar cok hizli. ', 'Comments are too frequent. ') + formatCooldown(commentCooldown);
    }
    return;
  }

  try {
    const commentResult = await persistComment(postId, {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name,
      message,
      createdAt: new Date().toISOString(),
    });
    markActionNow(MEMBER_COMMENT_RATE_KEY);
    if (status) {
      status.textContent = commentResult.moderated
        ? memberText('Yorum moderasyon sirasina alindi.', 'Comment was sent to moderation queue.')
        : memberText('Yorum paylasildi.', 'Comment posted.');
    }
    await refreshPostsWithFallback();
  } catch (error) {
    if (status) {
      status.textContent = memberText('Yorum gonderilemedi.', 'Comment could not be sent.');
    }
  }
}

async function bootMemberBlog() {
  setupPostCaptcha();
  await initRemoteStore();
  await refreshPostsWithFallback();
}

if (memberPostForm) {
  memberPostForm.addEventListener('submit', addPost);
}

if (memberPostList) {
  memberPostList.addEventListener('submit', addComment);
}

const memberLangButtons = document.querySelectorAll('.lang-btn');
if (memberLangButtons.length) {
  memberLangButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setTimeout(renderMemberPosts, 30);
    });
  });
}

bootMemberBlog();
