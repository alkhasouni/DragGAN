'use strict';

/* ── Constants ───────────────────────────────────────────────────── */
const MIN_SLIDES = 4;
const MAX_SLIDES = 7;
const TRANSLATE_URL = 'https://api.mymemory.translated.net/get';

// Gradient backgrounds cycling through text slides
const GRADIENTS = [
  'linear-gradient(135deg, #1a1a4e 0%, #4a2080 100%)',
  'linear-gradient(135deg, #0f3460 0%, #e94560 100%)',
  'linear-gradient(135deg, #0d2137 0%, #1a6b5a 100%)',
  'linear-gradient(135deg, #1f0a3c 0%, #5b1060 100%)',
  'linear-gradient(135deg, #0a2744 0%, #0a6e8a 100%)',
  'linear-gradient(135deg, #2d1b00 0%, #b35900 100%)',
  'linear-gradient(135deg, #001a10 0%, #006644 100%)',
];

/* ── Slide state ─────────────────────────────────────────────────── */
const slides = [
  { type: 'text', arabic: 'مرحباً بك في العرض التقديمي التفاعلي', original: 'Welcome to the interactive carousel' },
  { type: 'text', arabic: 'الصق أي نص في المحادثة وسيُترجم تلقائياً إلى العربية', original: 'Paste any text in the chat and it will be translated to Arabic' },
  { type: 'text', arabic: 'يمكنك إضافة الصور ومقاطع الفيديو إلى الشرائح', original: 'You can add images and videos to the slides' },
  { type: 'text', arabic: 'الحد الأدنى أربع شرائح والحد الأقصى سبع شرائح', original: 'Minimum 4 slides · Maximum 7 slides' },
];

let currentIndex = 0;
let pendingMedia  = []; // { type, src, name }
let translating   = false;

/* ── DOM refs ────────────────────────────────────────────────────── */
const track       = document.getElementById('carouselTrack');
const dotsRow     = document.getElementById('dotsRow');
const prevBtn     = document.getElementById('prevBtn');
const nextBtn     = document.getElementById('nextBtn');
const chatFeed    = document.getElementById('chatFeed');
const chatInput   = document.getElementById('chatInput');
const sendBtn     = document.getElementById('sendBtn');
const mediaFile   = document.getElementById('mediaFile');
const mediaPrev   = document.getElementById('mediaPreviews');
const slideCount  = document.getElementById('slideCount');
const limitBadge  = document.getElementById('limitWarning');

/* ── Carousel render ─────────────────────────────────────────────── */
function renderCarousel() {
  track.innerHTML   = '';
  dotsRow.innerHTML = '';

  slides.forEach((slide, i) => {
    const el = document.createElement('div');
    el.className = 'slide';

    if (slide.type === 'text') {
      el.classList.add('text-slide');
      el.style.background = GRADIENTS[i % GRADIENTS.length];
      el.innerHTML = `
        <div class="slide-deco"></div>
        <span class="slide-pill">${i + 1} / ${slides.length}</span>
        <div class="slide-content-wrap">
          <p class="slide-arabic">${esc(slide.arabic)}</p>
          ${slide.original ? `<p class="slide-original">${esc(slide.original)}</p>` : ''}
        </div>`;
    } else {
      el.classList.add('media-slide');
      const tag  = slide.type === 'video' ? 'video' : 'img';
      const ctrl = slide.type === 'video' ? ' controls' : '';
      el.innerHTML = `
        <span class="slide-pill">${i + 1} / ${slides.length}</span>
        <${tag} src="${slide.src}" alt="Slide ${i + 1}"${ctrl}></${tag}>`;
    }

    track.appendChild(el);

    // Dot
    const dot = document.createElement('button');
    dot.className  = 'dot' + (i === currentIndex ? ' active' : '');
    dot.role       = 'tab';
    dot.ariaLabel  = `Slide ${i + 1}`;
    dot.addEventListener('click', () => goTo(i));
    dotsRow.appendChild(dot);
  });

  track.style.transform = `translateX(-${currentIndex * 100}%)`;
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === slides.length - 1;
  slideCount.textContent = slides.length;
  limitBadge.hidden = slides.length < MAX_SLIDES;
  refreshSendBtn();
}

function goTo(i) {
  currentIndex = Math.max(0, Math.min(i, slides.length - 1));
  renderCarousel();
}

/* ── Slide management ────────────────────────────────────────────── */
function canAddSlide() { return slides.length < MAX_SLIDES; }

function pushSlide(slide) {
  if (!canAddSlide()) return false;
  slides.push(slide);
  currentIndex = slides.length - 1;
  renderCarousel();
  return true;
}

/* ── Translation ─────────────────────────────────────────────────── */
async function translate(text) {
  const url = `${TRANSLATE_URL}?q=${encodeURIComponent(text)}&langpair=auto|ar`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.responseStatus !== 200) throw new Error(data.responseMessage || 'Translation failed');
  return data.responseData.translatedText;
}

/* ── Chat helpers ────────────────────────────────────────────────── */
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function appendMsg(cls, html) {
  const el = document.createElement('div');
  el.className = `msg ${cls}`;
  el.innerHTML = html;
  chatFeed.appendChild(el);
  chatFeed.scrollTop = chatFeed.scrollHeight;
  return el;
}

function appendInfo(text) {
  appendMsg('info', text);
}

function appendWarning(text) {
  appendMsg('warning', `⚠️ ${text}`);
}

function showTranslating() {
  const el = document.createElement('div');
  el.className = 'translating-row';
  el.innerHTML = `<div class="spinner"></div> Translating to Arabic…`;
  chatFeed.appendChild(el);
  chatFeed.scrollTop = chatFeed.scrollHeight;
  return el;
}

/* ── Send handler ────────────────────────────────────────────────── */
async function handleSend() {
  const text       = chatInput.value.trim();
  const hasText    = text.length > 0;
  const hasMedia   = pendingMedia.length > 0;
  if (!hasText && !hasMedia) return;
  if (translating) return;

  // ── Text → translate → slide ──────────────────────────────────
  if (hasText) {
    chatInput.value = '';
    autoResize();
    refreshSendBtn();

    if (!canAddSlide()) {
      appendWarning(`Maximum ${MAX_SLIDES} slides reached. Cannot add more text slides.`);
    } else {
      appendMsg('user', `<div class="msg-label">You</div>${esc(text)}`);

      translating = true;
      refreshSendBtn();
      const indicator = showTranslating();

      try {
        const arabic = await translate(text);
        indicator.remove();
        translating = false;

        appendMsg('system', `
          <div class="msg-label">Arabic translation</div>
          <div class="msg-arabic">${esc(arabic)}</div>`);

        const added = pushSlide({ type: 'text', arabic, original: text });
        if (added) appendInfo(`✅ Slide ${slides.length} added`);
      } catch (err) {
        indicator.remove();
        translating = false;
        appendWarning(`Translation failed: ${err.message}. Please try again.`);
      }

      refreshSendBtn();
    }
  }

  // ── Media → slide ─────────────────────────────────────────────
  if (hasMedia) {
    const toAdd = [...pendingMedia];
    pendingMedia = [];
    mediaPrev.innerHTML = '';

    for (const m of toAdd) {
      if (!canAddSlide()) {
        appendWarning(`Maximum ${MAX_SLIDES} slides reached. ${toAdd.length - toAdd.indexOf(m)} file(s) not added.`);
        break;
      }

      const tag     = m.type === 'video' ? 'video' : 'img';
      const preview = `<div class="msg-media-preview"><${tag} src="${m.src}"></${tag}></div>`;
      appendMsg('system', `<div class="msg-label">📎 Media added to carousel</div>${preview}`);

      pushSlide({ type: m.type, src: m.src, name: m.name });
      appendInfo(`✅ Slide ${slides.length} added`);
    }
  }

  refreshSendBtn();
}

/* ── Media file picker ───────────────────────────────────────────── */
function handleFileSelect(e) {
  const files     = Array.from(e.target.files);
  const remaining = MAX_SLIDES - slides.length - pendingMedia.length;

  if (remaining <= 0) {
    appendWarning(`Maximum ${MAX_SLIDES} slides reached.`);
    e.target.value = '';
    return;
  }

  const accepted = files.slice(0, remaining);
  if (files.length > accepted.length) {
    appendWarning(`Only ${accepted.length} file(s) queued; carousel limit is ${MAX_SLIDES} slides.`);
  }

  accepted.forEach(file => {
    const reader  = new FileReader();
    const mType   = file.type.startsWith('video') ? 'video' : 'image';
    reader.onload = ev => {
      const src = ev.target.result;
      const idx = pendingMedia.length;
      pendingMedia.push({ type: mType, src, name: file.name });

      const thumb = document.createElement('div');
      thumb.className = 'preview-thumb';

      const tag = mType === 'video' ? 'video' : 'img';
      thumb.innerHTML = `<${tag} src="${src}"></${tag}>
        <button class="preview-remove" aria-label="Remove">✕</button>`;

      thumb.querySelector('.preview-remove').addEventListener('click', () => {
        pendingMedia.splice(pendingMedia.indexOf(pendingMedia[idx]), 1);
        thumb.remove();
        refreshSendBtn();
      });

      mediaPrev.appendChild(thumb);
      refreshSendBtn();
    };
    reader.readAsDataURL(file);
  });

  e.target.value = '';
}

/* ── Auto-resize textarea ────────────────────────────────────────── */
function autoResize() {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
}

/* ── Send button state ───────────────────────────────────────────── */
function refreshSendBtn() {
  const hasContent = chatInput.value.trim().length > 0 || pendingMedia.length > 0;
  sendBtn.disabled = !hasContent || translating;
}

/* ── Event wiring ────────────────────────────────────────────────── */
prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
nextBtn.addEventListener('click', () => goTo(currentIndex + 1));

sendBtn.addEventListener('click', handleSend);
mediaFile.addEventListener('change', handleFileSelect);

chatInput.addEventListener('input', () => { autoResize(); refreshSendBtn(); });

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
});

// Auto-translate when user pastes into the textarea
chatInput.addEventListener('paste', () => {
  setTimeout(() => {
    autoResize();
    refreshSendBtn();
    if (chatInput.value.trim().length > 0) handleSend();
  }, 60);
});

// Keyboard arrow navigation when textarea is not focused
document.addEventListener('keydown', e => {
  if (document.activeElement === chatInput) return;
  if (e.key === 'ArrowLeft')  goTo(currentIndex - 1);
  if (e.key === 'ArrowRight') goTo(currentIndex + 1);
});

// Touch / swipe on carousel
let touchX0 = 0;
document.getElementById('carouselViewport').addEventListener('touchstart', e => {
  touchX0 = e.changedTouches[0].clientX;
}, { passive: true });

document.getElementById('carouselViewport').addEventListener('touchend', e => {
  const dx = touchX0 - e.changedTouches[0].clientX;
  if (Math.abs(dx) > 45) goTo(currentIndex + (dx > 0 ? 1 : -1));
}, { passive: true });

/* ── Boot ────────────────────────────────────────────────────────── */
renderCarousel();
appendInfo('👋 Welcome! Paste text to translate it to Arabic, or attach an image / video.');
