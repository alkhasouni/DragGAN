'use strict';

/* ── Constants ───────────────────────────────────────────────────── */
const MIN_SLIDES     = 4;
const MAX_SLIDES     = 7;
const TRANSLATE_URL  = 'https://api.mymemory.translated.net/get';

// Arabic watermark characters cycling per slide index
const WATERMARKS = ['ع', 'ب', 'ر', 'ي', 'ة', 'ل', 'م'];

/* ── Initial slides ──────────────────────────────────────────────── */
const slides = [
  {
    type:    'video',
    src:     'media/hyundai-robot.mp4',
    name:    'hyundai-robot.mp4',
    caption: 'Hyundai Robot — Automated Parking',
    sub:     'روبوت يحرك المركبة بدقة',
  },
  {
    type:     'text',
    arabic:   'روبوت هيونداي يحرك المركبة بدقة لتحسين السلامة في مواقف السيارات الآلية 😜',
    original: 'Hyundai Robot move vehicle with precision to improve safety in automated parking 😜',
  },
  {
    type:     'text',
    arabic:   'الصق أي نص في المحادثة وسيُترجم تلقائياً إلى العربية',
    original: 'Paste any text in the chat and it will be translated to Arabic automatically',
  },
  {
    type:     'text',
    arabic:   'يمكنك إضافة الصور ومقاطع الفيديو إلى الشرائح بسهولة',
    original: 'You can easily add images and videos to the carousel slides',
  },
];

let currentIndex = 0;
let pendingMedia  = [];
let translating   = false;

/* ── DOM refs ────────────────────────────────────────────────────── */
const track        = document.getElementById('carouselTrack');
const progressRail = document.getElementById('progressRail');
const thumbStrip   = document.getElementById('thumbStrip');
const prevBtn      = document.getElementById('prevBtn');
const nextBtn      = document.getElementById('nextBtn');
const chatFeed     = document.getElementById('chatFeed');
const chatInput    = document.getElementById('chatInput');
const sendBtn      = document.getElementById('sendBtn');
const mediaFile    = document.getElementById('mediaFile');
const mediaPrev    = document.getElementById('mediaPreviews');
const slideCount   = document.getElementById('slideCount');
const limitBadge   = document.getElementById('limitWarning');

/* ── Build one slide element ─────────────────────────────────────── */
function buildSlide(slide, i, total) {
  const el = document.createElement('div');
  el.className = 'slide';

  if (slide.type === 'text') {
    el.classList.add('text-slide', `theme-${i % 7}`);
    el.innerHTML = `
      <div class="slide-mesh"></div>
      <div class="slide-watermark">${WATERMARKS[i % WATERMARKS.length]}</div>
      <span class="slide-counter">${i + 1} / ${total}</span>
      <span class="slide-type">عربي</span>
      <p class="slide-arabic">${esc(slide.arabic)}</p>
      <div class="slide-divider"></div>
      ${slide.original ? `<p class="slide-original">${esc(slide.original)}</p>` : ''}`;

  } else {
    // video or image
    el.classList.add('media-slide');
    const isVideo = slide.type === 'video';
    const tag     = isVideo ? 'video' : 'img';
    const extra   = isVideo ? ' controls playsinline' : '';
    const cap     = slide.caption
      ? `<div class="slide-caption-bar">
           <div class="cap-title">${esc(slide.caption)}</div>
           ${slide.sub ? `<div class="cap-sub">${esc(slide.sub)}</div>` : ''}
         </div>` : '';
    const overlay = isVideo
      ? `<div class="slide-video-overlay">
           <div class="play-circle">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
           </div>
         </div>` : '';

    el.innerHTML = `
      <span class="slide-counter">${i + 1} / ${total}</span>
      <span class="slide-type">${isVideo ? '▶ VIDEO' : '🖼 IMAGE'}</span>
      <${tag} src="${slide.src}" alt="Slide ${i + 1}"${extra}></${tag}>
      ${overlay}
      ${cap}`;
  }

  return el;
}

/* ── Build one thumbnail ─────────────────────────────────────────── */
function buildThumb(slide, i) {
  const btn = document.createElement('button');
  btn.className = 'thumb' + (i === currentIndex ? ' active' : '');
  btn.role      = 'tab';
  btn.ariaLabel = `Go to slide ${i + 1}`;

  if (slide.type === 'text') {
    btn.innerHTML = `
      <div class="thumb-text-inner" style="background:var(--surface2)">
        <span style="font-family:'Cairo',sans-serif">${WATERMARKS[i % WATERMARKS.length]}</span>
      </div>`;
    // tint thumbnail to match slide theme
    btn.querySelector('.thumb-text-inner').style.background =
      `var(--surface2)`;

  } else if (slide.type === 'video') {
    btn.innerHTML = `
      <video src="${slide.src}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>
      <div class="thumb-icon-overlay">▶</div>`;

  } else {
    btn.innerHTML = `
      <img src="${slide.src}" alt="Slide ${i + 1}" style="width:100%;height:100%;object-fit:cover">`;
  }

  btn.addEventListener('click', () => goTo(i));
  return btn;
}

/* ── Render carousel + UI chrome ─────────────────────────────────── */
function render() {
  const total = slides.length;

  // ── Track slides ──────────────────────────────────────────────
  track.innerHTML = '';
  slides.forEach((s, i) => track.appendChild(buildSlide(s, i, total)));
  track.style.transform = `translateX(-${currentIndex * 100}%)`;

  // ── Progress rail ──────────────────────────────────────────────
  progressRail.innerHTML = '';
  slides.forEach((_, i) => {
    const seg = document.createElement('div');
    seg.className = 'prog-seg' +
      (i < currentIndex ? ' past' : i === currentIndex ? ' active' : '');
    progressRail.appendChild(seg);
  });

  // ── Thumbnail strip ────────────────────────────────────────────
  thumbStrip.innerHTML = '';
  slides.forEach((s, i) => thumbStrip.appendChild(buildThumb(s, i)));

  // scroll active thumb into view
  const activeThumb = thumbStrip.children[currentIndex];
  if (activeThumb) activeThumb.scrollIntoView({ inline: 'nearest', behavior: 'smooth' });

  // ── Nav state ──────────────────────────────────────────────────
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === total - 1;

  // ── Header meta ───────────────────────────────────────────────
  slideCount.textContent = total;
  limitBadge.hidden      = total < MAX_SLIDES;

  refreshSendBtn();
}

function goTo(i) {
  currentIndex = Math.max(0, Math.min(i, slides.length - 1));
  render();
}

/* ── Slide management ────────────────────────────────────────────── */
function canAdd() { return slides.length < MAX_SLIDES; }

function pushSlide(slide) {
  if (!canAdd()) return false;
  slides.push(slide);
  currentIndex = slides.length - 1;
  render();
  return true;
}

/* ── Translation ─────────────────────────────────────────────────── */
async function translate(text) {
  const res  = await fetch(`${TRANSLATE_URL}?q=${encodeURIComponent(text)}&langpair=auto|ar`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.responseStatus !== 200) throw new Error(data.responseMessage || 'Translation error');
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

function appendInfo(text)    { appendMsg('info', text); }
function appendWarning(text) { appendMsg('warning', `⚠️ ${text}`); }

function showTranslating() {
  const el = document.createElement('div');
  el.className = 'translating-row';
  el.innerHTML = `<div class="spinner"></div> Translating to Arabic…`;
  chatFeed.appendChild(el);
  chatFeed.scrollTop = chatFeed.scrollHeight;
  return el;
}

/* ── Send / translate ────────────────────────────────────────────── */
async function handleSend() {
  const text     = chatInput.value.trim();
  const hasText  = text.length > 0;
  const hasMedia = pendingMedia.length > 0;
  if (!hasText && !hasMedia) return;
  if (translating) return;

  // Text → translate → new slide
  if (hasText) {
    chatInput.value = '';
    autoResize();

    if (!canAdd()) {
      appendWarning(`Maximum ${MAX_SLIDES} slides reached.`);
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

        if (pushSlide({ type: 'text', arabic, original: text })) {
          appendInfo(`✅ Slide ${slides.length} added`);
        }
      } catch (err) {
        indicator.remove();
        translating = false;
        appendWarning(`Translation failed — ${err.message}. Try again.`);
      }
    }

    refreshSendBtn();
  }

  // Media → new slide(s)
  if (hasMedia) {
    const toAdd = [...pendingMedia];
    pendingMedia = [];
    mediaPrev.innerHTML = '';

    for (const m of toAdd) {
      if (!canAdd()) {
        appendWarning(`Maximum ${MAX_SLIDES} slides reached.`);
        break;
      }
      const tag     = m.type === 'video' ? 'video' : 'img';
      const preview = `<div class="msg-media-preview"><${tag} src="${m.src}"></${tag}></div>`;
      appendMsg('system', `<div class="msg-label">📎 Media added</div>${preview}`);

      pushSlide({ type: m.type, src: m.src, name: m.name });
      appendInfo(`✅ Slide ${slides.length} added`);
    }

    refreshSendBtn();
  }
}

/* ── File picker ─────────────────────────────────────────────────── */
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
    appendWarning(`Only ${accepted.length} file(s) accepted — carousel limit is ${MAX_SLIDES}.`);
  }

  accepted.forEach(file => {
    const reader = new FileReader();
    const mType  = file.type.startsWith('video') ? 'video' : 'image';
    reader.onload = ev => {
      const src = ev.target.result;
      pendingMedia.push({ type: mType, src, name: file.name });

      const thumb = document.createElement('div');
      thumb.className = 'preview-thumb';
      const tag = mType === 'video' ? 'video' : 'img';
      thumb.innerHTML = `<${tag} src="${src}"></${tag}>
        <button class="preview-remove" aria-label="Remove">✕</button>`;

      thumb.querySelector('.preview-remove').addEventListener('click', () => {
        const idx = pendingMedia.findIndex(m => m.src === src);
        if (idx !== -1) pendingMedia.splice(idx, 1);
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

/* ── Helpers ─────────────────────────────────────────────────────── */
function autoResize() {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 110) + 'px';
}

function refreshSendBtn() {
  const hasContent = chatInput.value.trim().length > 0 || pendingMedia.length > 0;
  sendBtn.disabled = !hasContent || translating;
}

/* ── Events ──────────────────────────────────────────────────────── */
prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
nextBtn.addEventListener('click', () => goTo(currentIndex + 1));

sendBtn.addEventListener('click', handleSend);
mediaFile.addEventListener('change', handleFileSelect);

chatInput.addEventListener('input', () => { autoResize(); refreshSendBtn(); });

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
});

// Auto-translate on paste
chatInput.addEventListener('paste', () => {
  setTimeout(() => {
    autoResize(); refreshSendBtn();
    if (chatInput.value.trim()) handleSend();
  }, 60);
});

// Keyboard arrow nav (when textarea is not focused)
document.addEventListener('keydown', e => {
  if (document.activeElement === chatInput) return;
  if (e.key === 'ArrowLeft')  goTo(currentIndex - 1);
  if (e.key === 'ArrowRight') goTo(currentIndex + 1);
});

// Touch swipe
let swipeX = 0;
document.getElementById('carouselViewport').addEventListener('touchstart',
  e => { swipeX = e.changedTouches[0].clientX; }, { passive: true });
document.getElementById('carouselViewport').addEventListener('touchend', e => {
  const dx = swipeX - e.changedTouches[0].clientX;
  if (Math.abs(dx) > 44) goTo(currentIndex + (dx > 0 ? 1 : -1));
}, { passive: true });

/* ── Boot ────────────────────────────────────────────────────────── */
render();
appendInfo('🚗 Hyundai robot video loaded on slide 1.');
appendInfo('📋 Paste text to translate to Arabic, or attach an image / video.');
