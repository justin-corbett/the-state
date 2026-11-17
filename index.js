// -----------------------------------------
// Build tag
// -----------------------------------------
const BUILD = 'b1';

// -----------------------------------------
// CONSOLE BRAND
// -----------------------------------------
function addConsoleBrand() {
  console.log(
    '\n%c ✦ Site by Daymark ✦ %c\n\nhttps://www.daymark.co.nz/\n',
    'background: #000; color: #fff; padding: 5px 0;',
    ''
  );
}
addConsoleBrand();
console.log('[build]', BUILD);

// -----------------------------------------
// LENIS SMOOTH SCROLL
// -----------------------------------------
const hasLenis = typeof window.Lenis !== 'undefined';
const hasScrollTrigger = typeof window.ScrollTrigger !== 'undefined';

// The page manages its own scroll position, so the browser doesn't restore
// it on reload. ScrollTrigger writes its own remembered setting back on
// unload, so it has to be told too or the setting won't stick.
history.scrollRestoration = 'manual';
if (hasScrollTrigger) ScrollTrigger.clearScrollMemory('manual');

let lenis = null;

function initLenis() {
  if (lenis) return; // already created
  if (!hasLenis) {
    console.warn('[lenis] not found: the Lenis script did not load before index.js');
    return;
  }

  // Lenis's default setup for GSAP ScrollTrigger (from the Lenis README):
  // default options, Lenis driven by GSAP's ticker so scrolling and every
  // ScrollTrigger update on the same frame, and lag smoothing off.
  lenis = new Lenis();
  window.lenis = lenis; // handy for poking at it in the console

  console.log('[lenis] initialised', {
    version: lenis.version ?? 'unknown',
    scrollTriggerSynced: hasScrollTrigger,
    htmlClasses: document.documentElement.className,
  });
  if (!hasScrollTrigger) {
    console.warn('[lenis] ScrollTrigger not found: scroll animations will not sync');
  }

  if (hasScrollTrigger) {
    lenis.on('scroll', ScrollTrigger.update);
  }

  if (typeof window.gsap !== 'undefined') {
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000); // GSAP's ticker time is in seconds; Lenis wants ms
    });
    gsap.ticker.lagSmoothing(0);
  } else {
    // No GSAP: let Lenis run its own requestAnimationFrame loop instead.
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  // Log the first scroll so you can confirm Lenis is driving it, then a
  // throttled readout while scrolling (at most every 500ms).
  let firstScrollLogged = false;
  let lastLog = 0;
  lenis.on('scroll', (e) => {
    if (!firstScrollLogged) {
      firstScrollLogged = true;
      console.log('[lenis] scrolling: Lenis is handling scroll');
    }
    const now = performance.now();
    if (now - lastLog < 500) return;
    lastLog = now;
    console.log('[lenis] scroll', {
      y: Math.round(e.scroll),
      velocity: Number(e.velocity.toFixed(2)),
      direction: e.direction,
      progress: Number(e.progress.toFixed(3)),
    });
  });
}

// Every real page load starts at the top. Lenis keeps its own virtual scroll
// position separate from the window's, so both are reset, at each stage of
// load (a late browser restore can land after the script has run).
function resetScrollToTop() {
  window.scrollTo(0, 0);
  if (lenis && typeof lenis.scrollTo === 'function') {
    lenis.scrollTo(0, { immediate: true, force: true });
  }
}

initLenis();

// -----------------------------------------
// PAUSE SCROLL FOR THE PRELOADER AND POPUP
// -----------------------------------------
// While the preloader is up, or the Leasing Now popup is open, the page
// underneath doesn't scroll; it starts again when the preloader finishes or
// the popup closes. Both are shown and hidden by Webflow interactions, so
// this watches their styles and classes rather than hooking the
// interactions. The popup's own content can still scroll (data-lenis-prevent
// tells Lenis to leave it alone).
const SCROLL_LOCKS = ['.preloader', '.contact-modal_component'];
const LENIS_PREVENT = '.contact-modal_component, .contact-modal_content-wrapper';

function isShowing(el) {
  if (!el.isConnected) return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;
}

function initScrollLocks() {
  if (!lenis) return;
  const els = [...document.querySelectorAll(SCROLL_LOCKS.join(','))];
  if (!els.length) return;
  // Lenis's own opt-out for nested scroll areas (data-lenis-prevent, from the
  // Lenis README): Lenis ignores wheel and touch events inside these, even
  // while it's stopped, so they scroll natively. It goes on the popup and on
  // its content wrapper, which is the part that actually scrolls.
  document.querySelectorAll(LENIS_PREVENT).forEach((el) => el.setAttribute('data-lenis-prevent', ''));

  let locked = false;
  const update = () => {
    const next = els.some(isShowing);
    if (next === locked) return;
    locked = next;
    if (next) lenis.stop();
    else lenis.start();
  };
  // Interactions change inline styles (display, opacity) on the element or a
  // wrapper around it, so watch each one and its own wrappers. Not
  // .page-wrapper or above: the colour zones restyle that on every frame.
  const observer = new MutationObserver(update);
  els.forEach((el) => {
    for (let node = el; node && node !== document.body && !node.classList.contains('page-wrapper'); node = node.parentElement) {
      observer.observe(node, { attributes: true, attributeFilter: ['style', 'class'] });
    }
  });
  // A fade-out ends on opacity 0 with no further style change on some
  // setups; a transition end catches that too.
  els.forEach((el) => el.addEventListener('transitionend', update));
  update();
}

initScrollLocks();
resetScrollToTop();
document.addEventListener('DOMContentLoaded', resetScrollToTop);
window.addEventListener('pageshow', resetScrollToTop);
window.addEventListener('load', () => {
  resetScrollToTop();
  if (hasScrollTrigger) ScrollTrigger.refresh();
});

// -----------------------------------------
// CUSTOM EASES
// -----------------------------------------
// "the-state" is the site's signature ease. Returns its name, or 'none' if
// the CustomEase plugin didn't load, so animations still run.
const STATE_EASE = 'the-state';
let easesRegistered = false;

function registerEases() {
  if (typeof window.gsap === 'undefined') return 'none';
  if (typeof window.CustomEase === 'undefined') return 'none';
  if (!easesRegistered) {
    gsap.registerPlugin(CustomEase);
    CustomEase.create(STATE_EASE, 'M0,0 C0.625,0.05 0,1 1,1');
    easesRegistered = true;
  }
  return STATE_EASE;
}
registerEases();

// -----------------------------------------
// HOME HERO: IMAGE GROWS TO FULL SCREEN
// -----------------------------------------
// The hero's scroll container is sticky, so it stays pinned while the
// .scroll-track scrolls past it. Across that scroll the image grows from its
// designed size (set in Webflow) to fill the screen.
//
// It used to animate the image's width and height, which makes the browser
// re-lay-out the page and re-scale the photo on every frame: smooth on a
// desktop, laggy in iOS Safari. Now the image is laid out once, at the size
// that covers the screen with the photo's own proportions, and only a scale
// (transform) and a crop (clip-path) change as you scroll. Neither causes
// layout, and the transform runs on the GPU. The maths reproduces the old
// look exactly: at every point the visible window is the size the image box
// used to be, showing the photo cropped and scaled the way object-fit: cover
// showed it.
const HERO_GROW = { hero: '.section-hero_home', track: '.scroll-track', img: '.hero-img', frame: '.scroll-container' };

function initHeroGrow() {
  if (typeof window.gsap === 'undefined' || !hasScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  const hero = document.querySelector(HERO_GROW.hero);
  if (!hero) return;
  const track = hero.querySelector(HERO_GROW.track);
  const img = hero.querySelector(HERO_GROW.img);
  const frame = img && (img.closest(HERO_GROW.frame) || hero);
  if (!track || !img) return;

  // On phones the toolbar sliding in and out changes the viewport height;
  // without this every change re-measures the whole page mid-scroll.
  ScrollTrigger.config({ ignoreMobileResize: true });

  let size = null; // measured sizes, null until the image has loaded

  const reset = () => {
    gsap.set(img, { clearProps: 'width,height,maxWidth,maxHeight,minWidth,minHeight,flexShrink,transform,clipPath,willChange,objectFit' });
  };

  // Measure the designed box and the full-screen target, then lay the image
  // out once at the photo's own proportions, just covering the screen.
  const measure = () => {
    reset();
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) { size = null; return; }
    const box = img.getBoundingClientRect();
    const W = frame.clientWidth;
    const H = frame.clientHeight;
    const cover = Math.max(W / iw, H / ih);
    size = { w0: box.width, h0: box.height, W, H, iw, ih, cover, bw: iw * cover, bh: ih * cover };
    // flexShrink 0: the image sits in a flex container that is only as wide
    // as the screen on phones, which would otherwise squeeze it back down to
    // fit and leave the crop with nothing to show.
    gsap.set(img, {
      width: size.bw, height: size.bh, minWidth: size.bw, minHeight: size.bh,
      maxWidth: 'none', maxHeight: 'none', flexShrink: 0,
      objectFit: 'fill', willChange: 'transform', transformOrigin: '50% 50%',
    });
  };

  // p runs 0 → 1 across the scroll. The box the old animation drew at p is
  // w × h; object-fit: cover scaled the photo by k inside it. Scaling the big
  // image by k / cover gives the photo that same scale, and the crop leaves
  // exactly a w × h window showing, centred, as before.
  const render = (p) => {
    if (!size) return;
    const { w0, h0, W, H, iw, ih, cover, bw, bh } = size;
    const w = w0 + (W - w0) * p;
    const h = h0 + (H - h0) * p;
    const k = Math.max(w / iw, h / ih);
    const s = k / cover;
    const x = Math.max(0, (bw - w / s) / 2);
    const y = Math.max(0, (bh - h / s) / 2);
    img.style.transform = `scale(${s})`;
    img.style.clipPath = `inset(${y}px ${x}px)`;
  };

  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const st = ScrollTrigger.create({
      trigger: track,
      start: 'top top',
      end: 'bottom bottom',
      // Re-measure whenever ScrollTrigger re-measures the page (breakpoints
      // change the designed size).
      onRefreshInit: reset,
      onRefresh: (self) => { measure(); render(self.progress); },
      onUpdate: (self) => render(self.progress),
    });
    if (!img.complete || !img.naturalWidth) {
      img.addEventListener('load', () => { measure(); render(st.progress); }, { once: true });
    } else {
      measure();
      render(st.progress);
    }
    return () => { st.kill(); reset(); size = null; };
  });
}

initHeroGrow();

// -----------------------------------------
// HEADING SPLIT TEXT REVEAL
// -----------------------------------------
// Add data-split="heading" to any heading in Webflow. Its words slide up
// into place from behind a mask on each line when it scrolls into view.
//
// autoSplit re-splits when fonts finish loading or the element's width
// changes (so lines stay correct across breakpoints). Returning the tween
// from onSplit lets SplitText kill and rebuild it on each re-split.
// A Webflow text-indent belongs to the first line of the paragraph, but
// text-indent is inherited. When SplitText wraps the text, every wrapper it
// makes (each word while it measures, then each line) inherits the indent:
// words get wider, so lines break too early, and every line would indent.
//
// Two parts fix it:
// 1. This rule stops anything inside a split element inheriting the indent.
//    The element itself keeps its own, so while SplitText measures, the
//    first line is still indented and line breaks land where Webflow puts
//    them.
// 2. After the split, keepTextIndent puts the indent back on the first line
//    as an inline style (which beats the rule). It runs on every split, so
//    the indent follows the breakpoint values set in Webflow.
(function addSplitIndentStyle() {
  if (document.getElementById('state-split-indent')) return;
  const style = document.createElement('style');
  style.id = 'state-split-indent';
  style.textContent = '[data-split] *{text-indent:0;}';
  document.head.appendChild(style);
})();

function keepTextIndent(el, lines) {
  if (!lines || !lines.length) return;
  const indent = getComputedStyle(el).textIndent;
  if (!indent || parseFloat(indent) === 0) return;
  lines[0].style.textIndent = indent;
}

const HEADING_SEQUENCE = { gap: 0.2 };

// Headings in the same section play as a queue, in page order, each at least
// HEADING_SEQUENCE.gap after the one before. Separate headings that cross
// their start line together ("endless" and "possibilities", or the vertical
// "wu-" and "stah") still stagger in instead of arriving at once, and
// reaching a later one first plays any earlier ones ahead of it.
//
// Usage: const entry = register(el); keep the paused reveal tween on
// entry.tween (rebuilt on each re-split); call reach(entry) when its scroll
// trigger fires. entry.played turns true once its reveal has started.
function createHeadingSequence() {
  const groups = new Map();

  const register = (el) => {
    const key = el.closest('section') || document.body;
    if (!groups.has(key)) groups.set(key, { entries: [], nextAt: 0 });
    const group = groups.get(key);
    const entry = { el, group, tween: null, queued: false, played: false };
    group.entries.push(entry);
    return entry;
  };

  const queue = (entry) => {
    if (entry.queued) return;
    entry.queued = true;
    const now = gsap.ticker.time;
    const at = Math.max(now, entry.group.nextAt);
    entry.group.nextAt = at + HEADING_SEQUENCE.gap;
    gsap.delayedCall(at - now, () => {
      entry.played = true;
      if (entry.tween) entry.tween.play();
    });
  };

  const reach = (entry) => {
    const index = entry.group.entries.indexOf(entry);
    entry.group.entries.slice(0, index + 1).forEach(queue);
  };

  return { register, reach };
}

function initHeadingSplits() {
  if (typeof window.gsap === 'undefined' || !hasScrollTrigger) return;
  if (typeof window.SplitText === 'undefined') return;
  gsap.registerPlugin(SplitText, ScrollTrigger);

  const headings = document.querySelectorAll('[data-split="heading"]');
  if (!headings.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const sequence = createHeadingSequence();
  const entries = [...headings].map(sequence.register);

  entries.forEach((entry) => {
    const heading = entry.el;
    SplitText.create(heading, {
      type: 'lines, words',
      mask: 'lines',
      autoSplit: true,
      // Words stay whole, so screen readers still read the text. 'auto' would
      // put an aria-label on a plain div, which Lighthouse flags as prohibited.
      aria: 'none',
      onSplit(self) {
        keepTextIndent(heading, self.lines);
        // Once a heading has revealed, later re-splits (resize, font load)
        // just rebuild the lines without playing the reveal again.
        if (entry.played) return;
        entry.tween = gsap.from(self.words, {
          yPercent: 110,
          duration: 0.8,
          stagger: 0.06,
          ease: 'expo.out',
          paused: true,
        });
        return entry.tween;
      },
    });

    ScrollTrigger.create({
      trigger: heading,
      start: 'top 85%',
      once: true,
      onEnter: () => sequence.reach(entry),
    });
  });
}

initHeadingSplits();

// -----------------------------------------
// VERTICAL HEADING SPLIT TEXT REVEAL
// -----------------------------------------
// Add data-split="heading-vertical" to a heading set vertically (reading
// bottom to top). Same reveal as data-split="heading", with the same timing
// and ease, but each word slides in from the right, out from behind a mask.
//
// Each word gets its own mask rather than each line. SplitText finds lines
// by comparing where words sit vertically, which doesn't work for text set
// with writing-mode, and a word mask clips at the same edges anyway.
//
// The heading could be turned vertical with a rotate transform or with
// writing-mode, and those put "right" in different directions in the text's
// own coordinates. So rather than guess, the script nudges one word along x
// and along y and keeps whichever one moves it right on screen.
function screenRightOffset(word, extraPx) {
  const before = word.getBoundingClientRect().left;
  gsap.set(word, { xPercent: 100 });
  const viaX = word.getBoundingClientRect().left - before;
  gsap.set(word, { xPercent: 0, yPercent: 100 });
  const viaY = word.getBoundingClientRect().left - before;
  gsap.set(word, { xPercent: 0, yPercent: 0 });

  const useX = Math.abs(viaX) >= Math.abs(viaY);
  const sign = Math.sign(useX ? viaX : viaY) || 1;
  // Far enough to clear the word itself plus the mask's padding on that side.
  const size = useX ? word.offsetWidth : word.offsetHeight;
  return { [useX ? 'x' : 'y']: (size * 1.1 + (extraPx || 0)) * sign };
}

// The heading's line height is tighter than its letters are tall, so each
// word's mask (only one line tall) clipped the letters on one side. Each mask
// gets padding across the line, cancelled by an equal negative margin so
// nothing moves, and the letters fit inside it. In em of the heading's size.
const VERTICAL_MASK_PAD = 0.25;

function padVerticalMasks(heading, masks) {
  const pad = VERTICAL_MASK_PAD + 'em';
  masks.forEach((mask) => {
    // Logical properties: "block" is across the line, which for vertical
    // text is left/right on screen.
    mask.style.setProperty('padding-block', pad);
    mask.style.setProperty('margin-block', '-' + pad);
  });
  return parseFloat(getComputedStyle(heading).fontSize) * VERTICAL_MASK_PAD;
}

function initVerticalHeadingSplits() {
  if (typeof window.gsap === 'undefined' || !hasScrollTrigger) return;
  if (typeof window.SplitText === 'undefined') return;
  gsap.registerPlugin(SplitText, ScrollTrigger);

  const headings = document.querySelectorAll('[data-split="heading-vertical"]');
  if (!headings.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Same queue as the horizontal headings, so "wu-" and "stah", which reach
  // the screen together, still come in one after the other.
  const sequence = createHeadingSequence();
  [...headings].map(sequence.register).forEach((entry) => {
    const heading = entry.el;
    SplitText.create(heading, {
      type: 'words',
      mask: 'words',
      autoSplit: true,
      aria: 'none', // see the horizontal heading split above
      onSplit(self) {
        const padPx = padVerticalMasks(heading, self.masks || []);
        if (entry.played || !self.words.length) return;
        // Words start at the bottom, so document order already staggers
        // bottom to top.
        entry.tween = gsap.from(self.words, {
          ...screenRightOffset(self.words[0], padPx),
          duration: 0.8,
          stagger: 0.06,
          ease: 'expo.out',
          paused: true,
        });
        return entry.tween;
      },
    });

    ScrollTrigger.create({
      trigger: heading,
      start: 'top 85%',
      once: true,
      onEnter: () => sequence.reach(entry),
    });
  });
}

initVerticalHeadingSplits();

// -----------------------------------------
// UNDERLINE LINKS ([data-underline-link])
// -----------------------------------------
// Ported from Whitehall. Add data-underline-link to a link in Webflow:
//   data-underline-link        rests with no line; hover draws it in from
//                              the left, hover-out wipes it away to the right.
//   data-underline-link="alt"  rests underlined; hover wipes it away to the
//                              right, then a fresh line draws in from the left.
//                              A swipe always plays through.
//
// Each line is a real span whose visible stretch is a clip-path (left edge /
// right edge, in %), so an interrupted hover carries on from wherever the line
// has got to instead of snapping back. Hover only runs on devices with a real
// pointer. Put data-hover on a wrapper to drive the underline from that
// wrapper's hover instead of the link's own.
const UNDERLINE = { duration: 0.735, wipe: 0.5, altDelay: 0.3, height: '0.0625em', boldHeight: '0.1em' };

// Turns off any CSS pseudo-element underline once the JS one takes over.
function ensureUnderlineStyle() {
  if (document.getElementById('state-underline-js')) return;
  const style = document.createElement('style');
  style.id = 'state-underline-js';
  style.textContent =
    '[data-underline-link][data-ul-js]::before,[data-underline-link][data-ul-js]::after{content:none!important;}';
  document.head.appendChild(style);
}

function makeUnderlineBar(link) {
  const el = document.createElement('span');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('data-underline-bar', '');
  // The line thickens with the type: bold text gets a heavier underline.
  const height = parseInt(getComputedStyle(link).fontWeight, 10) >= 600 ? UNDERLINE.boldHeight : UNDERLINE.height;
  el.style.cssText =
    'position:absolute;left:0;bottom:-0.0625em;width:100%;pointer-events:none;background-color:currentColor;' +
    'height:' + height + ';';
  link.appendChild(el);
  const bar = { el, l: 0, r: 100 };
  bar.apply = () => { el.style.clipPath = 'inset(0 ' + bar.r + '% 0 ' + bar.l + '%)'; };
  bar.apply();
  return bar;
}

function underlineBarEmpty(bar) {
  return 100 - bar.l - bar.r < 0.5;
}

function underlineGrow(bar, delay) {
  // An empty bar always starts from the left edge.
  if (underlineBarEmpty(bar)) { bar.l = 0; bar.r = 100; bar.apply(); }
  gsap.to(bar, { l: 0, r: 0, duration: UNDERLINE.duration, ease: registerEases(), delay: delay || 0, overwrite: true, onUpdate: bar.apply });
}

function underlineWipe(bar, delay) {
  // Left edge runs across to the right edge, which stays where it is.
  gsap.to(bar, { l: 100 - bar.r, duration: UNDERLINE.duration, ease: registerEases(), delay: delay || 0, overwrite: true, onUpdate: bar.apply });
}

function setupUnderline(link) {
  if (link._ul) return link._ul;
  ensureUnderlineStyle();
  link.setAttribute('data-ul-js', '');
  if (getComputedStyle(link).position === 'static') link.style.position = 'relative';

  const alt = link.getAttribute('data-underline-link') === 'alt';
  const main = makeUnderlineBar(link);
  const state = { alt, main, hovered: false, waiting: false, swiping: false };
  if (alt) {
    main.l = 0; main.r = 0; main.apply(); // rests underlined
  } else {
    main.l = 100; main.r = 0; main.apply();
  }
  link._ul = state;

  // alt: wipe out to the right, then draw a new line in from the left.
  const swipe = () => {
    const ease = registerEases();
    state.swiping = true;
    gsap.killTweensOf(main);
    const tl = gsap.timeline({ onComplete: () => { state.swiping = false; } });
    tl.to(main, { l: 100 - main.r, duration: UNDERLINE.wipe, ease, onUpdate: main.apply });
    tl.call(() => { main.l = 0; main.r = 100; main.apply(); });
    tl.to(main, { r: 0, duration: UNDERLINE.duration, ease, onUpdate: main.apply });
  };

  const source = link.closest('[data-hover]') || link;
  const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  source.addEventListener('mouseenter', () => {
    if (!canHover()) return;
    state.hovered = true;
    if (state.alt) {
      if (!state.swiping) swipe();
    } else {
      underlineGrow(main, 0);
    }
  });
  source.addEventListener('mouseleave', () => {
    if (!state.hovered) return;
    state.hovered = false;
    if (!state.alt) underlineWipe(main, 0); // alt: a swipe in flight just plays out
  });
  return state;
}

function initUnderlineLinks(scope) {
  if (typeof window.gsap === 'undefined') return;
  (scope || document).querySelectorAll('[data-underline-link]').forEach(setupUnderline);
}

// Underlined links inside revealed text: the line sits outside the split
// lines, so an "alt" line (which rests visible) is held back until the reveal
// starts and then drawn in with it.
function holdUnderline(el) {
  const link = el.closest('[data-underline-link]') || el.querySelector('[data-underline-link]');
  if (!link) return null;
  const state = setupUnderline(link);
  if (!state) return null;
  state.waiting = true;
  if (state.alt) {
    gsap.killTweensOf(state.main);
    state.swiping = false;
    state.main.l = 0; state.main.r = 100; state.main.apply();
  }
  return link;
}

function releaseUnderline(link) {
  const state = link && link._ul;
  if (!state || !state.waiting) return;
  state.waiting = false;
  if (state.alt && !state.swiping) underlineGrow(state.main, UNDERLINE.altDelay);
}

// A re-split rebuilds the text's markup, which can drop an underline's bar or
// replace the link element (and the hover listeners on it). Put them back.
function restoreUnderlines(el) {
  const links = el.matches('[data-underline-link]') ? [el] : [...el.querySelectorAll('[data-underline-link]')];
  links.forEach((link) => {
    const state = link._ul;
    if (!state) { setupUnderline(link); return; }
    // SplitText rebuilds the text from a snapshot taken with the bar already
    // in it, so a re-split leaves a frozen copy of the bar behind. On an "alt"
    // link that copy shows a full, static underline in front of the live one,
    // so hover looks like it does nothing. Keep only the live bar.
    link.querySelectorAll('[data-underline-bar]').forEach((bar) => {
      if (bar !== state.main.el) bar.remove();
    });
    if (!link.contains(state.main.el)) link.appendChild(state.main.el);
  });
}

// Footer text links get the hover underline (as the Current State link has)
// without needing the attribute set on each one in Webflow.
const FOOTER_UNDERLINE_LINKS = '.footer a.text-style-link';
document.querySelectorAll(FOOTER_UNDERLINE_LINKS).forEach((link) => {
  if (!link.hasAttribute('data-underline-link')) link.setAttribute('data-underline-link', '');
});

// Runs before the text splits below, so links inside split text already have
// their bars when SplitText wraps them.
initUnderlineLinks(document);

// -----------------------------------------
// PARAGRAPH LINE REVEAL
// -----------------------------------------
// Add data-split="lines" to any paragraph or text block in Webflow. Its lines
// rise and fade in one after another as it scrolls into view, the same
// animation as Whitehall's [data-line-reveal]: unmasked, a 0.5em rise, the
// signature ease.
//
// Optional: data-split-start="top 100%" overrides when it fires (default
// "top 85%"), e.g. for text near the bottom of the page.
const LINE_REVEAL = {
  travelEm: 0.5,
  duration: 0.7,
  stagger: 0.05,
  start: 'top 85%',
};

// Pieces of text that sit side by side and so would reveal at the same
// moment come in one after another instead, left to right, this far apart:
// the Current State / Future State links.
const LINE_REVEAL_SIDE_BY_SIDE = { selector: '.large-link', gap: 0.2 };

// How far into the row this element is: its place among its matching
// siblings, so the first plays at once and each after it waits a gap more.
function sideBySideDelay(el) {
  if (!el.matches(LINE_REVEAL_SIDE_BY_SIDE.selector) || !el.parentElement) return 0;
  const row = [...el.parentElement.children].filter((c) => c.matches(LINE_REVEAL_SIDE_BY_SIDE.selector));
  return Math.max(0, row.indexOf(el)) * LINE_REVEAL_SIDE_BY_SIDE.gap;
}

// A re-split changes line heights, so ScrollTrigger re-measures once things
// settle (debounced so a resize doesn't refresh on every frame).
let splitRefreshCall = null;
function refreshScrollTriggersSoon() {
  if (splitRefreshCall) splitRefreshCall.kill();
  splitRefreshCall = gsap.delayedCall(0.1, () => ScrollTrigger.refresh());
}

// A start past the end of the page never fires: text near the footer, most of
// all on phones where the toolbar changes the viewport height. "top N%" starts
// are capped a little short of the max scroll so the reveal always plays.
function revealStart(el, start) {
  const match = /^top\s+(\d+(?:\.\d+)?)%$/.exec(start);
  if (!match) return start;
  const fraction = parseFloat(match[1]) / 100;
  return () => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    const margin = Math.max(160, window.innerHeight * 0.2);
    return Math.min(top - fraction * window.innerHeight, ScrollTrigger.maxScroll(window) - margin);
  };
}

function initLineReveals() {
  if (typeof window.gsap === 'undefined' || !hasScrollTrigger) return;
  if (typeof window.SplitText === 'undefined') return;
  gsap.registerPlugin(SplitText, ScrollTrigger);

  const targets = document.querySelectorAll('[data-split="lines"]');
  if (!targets.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ease = registerEases();
  const hidden = { opacity: 0, y: `${LINE_REVEAL.travelEm}em` };

  targets.forEach((el) => {
    let revealed = false;
    let ready = false; // the first onSplit is the initial split, not a re-split

    // aria: 'none' because a line split keeps every word whole, so the text
    // stays readable as-is. The default ('auto') would put an aria-label on a
    // <p>, which isn't allowed there, and hide the lines from screen readers.
    const split = SplitText.create(el, {
      type: 'lines',
      aria: 'none',
      autoSplit: true,
      onSplit(self) {
        keepTextIndent(el, self.lines);
        // Lines not yet revealed sit in their hidden state; after the reveal
        // has played, fresh lines from a re-split are left visible.
        if (!revealed) gsap.set(self.lines, hidden);
        if (ready) {
          restoreUnderlines(el);
          refreshScrollTriggersSoon();
        }
      },
    });
    ready = true;
    const underline = holdUnderline(el);

    const start = el.getAttribute('data-split-start') || LINE_REVEAL.start;
    ScrollTrigger.create({
      trigger: el,
      start: revealStart(el, start),
      once: true,
      onEnter: () => {
        revealed = true;
        gsap.to(split.lines, {
          opacity: 1,
          y: 0,
          duration: LINE_REVEAL.duration,
          ease,
          stagger: LINE_REVEAL.stagger,
          delay: sideBySideDelay(el),
          onStart: () => releaseUnderline(underline),
        });
      },
    });
  });
}

// Split only once the page's own DOMContentLoaded scripts have run. The
// Webflow embed in the Leasing Opportunities section rewrites a fully leased
// floor's label to "LEASED" on DOMContentLoaded; splitting before that
// captured the original CMS text ("Large"), which every re-split (font load,
// resize) then put back. Listeners added here run after the embed's, since
// its inline script registers first.
// A deferred script runs with readyState already "interactive" but before
// DOMContentLoaded fires, so readyState alone can't tell; the navigation
// timing entry says whether DOMContentLoaded has started yet.
function afterDomContentLoaded(fn) {
  const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  const fired = document.readyState === 'complete' || (nav && nav.domContentLoadedEventStart > 0);
  if (fired) fn();
  else document.addEventListener('DOMContentLoaded', fn, { once: true });
}
afterDomContentLoaded(initLineReveals);

// Icons that sit beside line-reveal text fade and rise with that text: same
// travel, duration, ease and start point as its first line, so icon and text
// arrive together. Covers the Tenancy Summary and Building Highlights icons
// and the accordions' +/- (both the + and the hidden -, so whichever is
// showing comes in). The text is found by looking up from the icon a few
// levels, since the +/- sit in their own wrapper beside the row's text.
const TEXT_ICON_SELECTOR = '.icon-1x1-small, .accordion-icon';
const TEXT_ICON_SEARCH_DEPTH = 3;

function textForIcon(icon) {
  let el = icon.parentElement;
  for (let i = 0; el && i < TEXT_ICON_SEARCH_DEPTH; i++, el = el.parentElement) {
    const text = el.querySelector('[data-split="lines"]');
    if (text) return text;
  }
  return null;
}

// The +/- SVGs sat inline on the text baseline, so they rode a couple of
// pixels low in the Leasing rows. As blocks, with their box centred in the
// row, they line up with the middle of the text. Display itself is left
// alone: the accordion scripts switch + and - with inline display styles.
function ensureAccordionIconStyle() {
  if (document.getElementById('state-accordion-icon')) return;
  const style = document.createElement('style');
  style.id = 'state-accordion-icon';
  style.textContent =
    '.accordion-icon{align-self:center;line-height:0;}' +
    '.accordion-icon svg{display:block;}' +
    // Building Highlights: the +/- wrapper was pinned to the top of the row
    // and only looked centred because the inline SVG's line box filled it.
    // Stretch it to the row and centre the icon in it; min-height keeps the
    // row the height that line box gave it.
    '.faq6_icon-wrapper{align-self:stretch;align-items:center;min-height:1lh;}' +
    // Highlight icons: the box is 1em square but each SVG was 100% wide with
    // its height set by its own proportions, so tall icons spilled out of it.
    // Filling the box both ways lets the SVG's viewBox scale the artwork to
    // fit inside it, centred, without stretching.
    '.icon-1x1-small{flex-shrink:0;}' +
    '.icon-1x1-small svg{display:block;width:100%;height:100%;}';
  document.head.appendChild(style);
}
ensureAccordionIconStyle();

function initTextIconReveals() {
  if (typeof window.gsap === 'undefined' || !hasScrollTrigger) return;
  if (typeof window.SplitText === 'undefined') return; // text isn't hidden either
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ease = registerEases();
  document.querySelectorAll(TEXT_ICON_SELECTOR).forEach((icon) => {
    const text = textForIcon(icon);
    if (!text) return;

    gsap.set(icon, { opacity: 0, y: `${LINE_REVEAL.travelEm}em` });
    const start = text.getAttribute('data-split-start') || LINE_REVEAL.start;
    ScrollTrigger.create({
      trigger: text,
      start: revealStart(text, start),
      once: true,
      onEnter: () => gsap.to(icon, {
        opacity: 1,
        y: 0,
        duration: LINE_REVEAL.duration,
        ease,
        clearProps: 'transform',
      }),
    });
  });
}

initTextIconReveals();

// -----------------------------------------
// SEPARATOR LINE REVEAL (as Whitehall's .horizontal-rule)
// -----------------------------------------
// The Building Highlights rows and the Leasing Opportunities floor rows are
// separated by CSS borders, which can't animate their length. Each border is
// swapped for an identical line (same colour and thickness, drawn by a
// pseudo-element) that draws in left to right, once, as it scrolls into view:
// Whitehall's timing, 1s on the site ease, firing at 92% down the screen.
// The original border stays in place, transparent, so nothing shifts.
const RULE_ITEMS = [
  '.faq6_accordion',                                   // Building Highlights
  '.building-section .tenancy-grid.tenancy-header',    // Leasing Opportunities
];
const RULE_REVEAL = { duration: 1, start: 'top 92%' };

function ensureRuleStyle() {
  if (document.getElementById('state-rule-reveal')) return;
  const style = document.createElement('style');
  style.id = 'state-rule-reveal';
  const line = 'content:"";position:absolute;left:0;right:0;pointer-events:none;' +
    'transform-origin:left center;';
  style.textContent =
    '.state-rule{position:relative;}' +
    '.state-rule.rule-bottom{border-bottom-color:transparent!important;}' +
    '.state-rule.rule-top{border-top-color:transparent!important;}' +
    // Each line sits exactly where its border was (pushed out by the border's
    // width), so a row's background meets the line with no gap. Rows that clip
    // their overflow would hide it there, so they keep it just inside the edge
    // (--rule-*-offset is set per row in initRuleReveals).
    '.state-rule.rule-bottom::after{' + line + 'bottom:var(--rule-bottom-offset,0);' +
      'height:var(--rule-bottom-w);z-index:1;' +
      'background:var(--rule-bottom-color);transform:scaleX(var(--rule-scale,1));}' +
    '.state-rule.rule-top::before{' + line + 'top:var(--rule-top-offset,0);' +
      'height:var(--rule-top-w);z-index:1;' +
      'background:var(--rule-top-color);transform:scaleX(var(--rule-scale,1));}';
  document.head.appendChild(style);
}

function initRuleReveals() {
  if (typeof window.gsap === 'undefined' || !hasScrollTrigger) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const items = [...document.querySelectorAll(RULE_ITEMS.join(','))];
  if (!items.length) return;
  ensureRuleStyle();
  const ease = registerEases();

  items.forEach((el) => {
    const cs = getComputedStyle(el);
    const clips = cs.overflowY !== 'visible';
    const side = (name) => {
      const width = parseFloat(cs[`border${name}Width`]);
      if (!width || cs[`border${name}Style`] === 'none') return false;
      const key = name.toLowerCase();
      el.style.setProperty(`--rule-${key}-w`, `${width}px`);
      el.style.setProperty(`--rule-${key}-offset`, clips ? '0px' : `${-width}px`);
      el.style.setProperty(`--rule-${key}-color`, cs[`border${name}Color`]);
      el.classList.add(`rule-${key}`);
      return true;
    };
    const hasTop = side('Top');
    const hasBottom = side('Bottom');
    if (!hasTop && !hasBottom) return;

    el.classList.add('state-rule');
    gsap.set(el, { '--rule-scale': 0 });
    ScrollTrigger.create({
      trigger: el,
      start: revealStart(el, RULE_REVEAL.start),
      once: true,
      onEnter: () => gsap.to(el, { '--rule-scale': 1, duration: RULE_REVEAL.duration, ease }),
    });
  });
}

initRuleReveals();

// -----------------------------------------
// LEASING ROW HOVER FILL
// -----------------------------------------
// Hovering a Leasing Opportunities floor row fills its background up from the
// bottom of the row instead of switching the colour on at once. The fill is a
// pseudo-element behind the row's content, growing from 0 to full height on
// the site ease. The page's own hover colour is turned off for these rows so
// the fill is what shows. The open row and leased rows keep their fixed
// colours from the page's embed CSS.
const ROW_FILL = {
  rows: '.floor-collection-list-item .tenancy-header:not(.static)',
  hover: '.floor-collection-list-item:not(.is-leased):not(.is-active) .tenancy-header:not(.static)',
  kept: '.floor-collection-list-item.is-hover-kept:not(.is-leased):not(.is-active) .tenancy-header:not(.static)',
  color: 'var(--base-color-brand--hover--rosebud, #facbc5)',
  duration: 0.5,
  ease: 'cubic-bezier(0.625, 0.05, 0, 1)', // the-state ease, as CSS
};

(function ensureRowFillStyle() {
  if (document.getElementById('state-row-fill')) return;
  const style = document.createElement('style');
  style.id = 'state-row-fill';
  style.textContent =
    // isolation keeps the fill (z-index -1) behind the row's text but in
    // front of whatever is behind the row.
    ROW_FILL.rows + '{position:relative;isolation:isolate;}' +
    ROW_FILL.rows + '::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;' +
      'background-color:' + ROW_FILL.color + ';transform:scaleY(0);transform-origin:center bottom;' +
      'transition:transform ' + ROW_FILL.duration + 's ' + ROW_FILL.ease + ';}' +
    '@media (hover:hover){' +
      ROW_FILL.hover + ':hover{background-color:transparent;}' +
      ROW_FILL.hover + ':hover::before{transform:scaleY(1);}' +
      // The last floor hovered keeps its fill after the pointer leaves the
      // list, matching the image left showing (see LEASING IMAGE ON HOVER).
      ROW_FILL.kept + '{background-color:transparent;}' +
      ROW_FILL.kept + '::before{transform:scaleY(1);}' +
    '}' +
    '@media (prefers-reduced-motion:reduce){' + ROW_FILL.rows + '::before{transition:none;}}' +
    // An open floor's lease rows: the list had extra padding above the first
    // row on top of the row's own, which pushed its text below the middle of
    // the lines either side. Without it each row matches the floor rows.
    '.building-section .lease-list-wrapper{padding-top:0;}';
  document.head.appendChild(style);
})();

// -----------------------------------------
// SCROLL COLOUR ZONES
// -----------------------------------------
// Ported from Whitehall's colour zones. As each zone section scrolls into
// view, .page-wrapper eases to that zone's background and text colour.
// Each change fires when the top of the section reaches the top of the
// screen (or the section scrolls back into view from below), so the colours stay
// tied to their sections however tall the page gets.
//
// Zones sit one after another, so leaving one downward always means entering
// the next. Only the first zone reverts, back to the page's own colours, when
// you scroll back up above it.
//
// Colours are read from the Webflow variables, so a palette change in
// Webflow carries through here.
const COLOR_ZONES = [
  { selector: '.section__pink', bg: '--base-color-brand--rosebud', text: '--text-color--text-primary' },
  // nav: nav links + logo. secondary: captions (.text-color-secondary), which
  // otherwise match the dark background exactly.
  { selector: '.section__dark', bg: '--base-color-brand--lake-hayes', text: '--text-color--text-light',
    nav: '--text-color--text-light', secondary: '--text-color--text-light' },
];

// Nav links, logo and captions set their own colours, so they don't follow
// .page-wrapper's text colour. They read these variables instead, which the
// zones tween alongside the background.
function ensureColorZoneStyle() {
  if (document.getElementById('state-color-zones')) return;
  const style = document.createElement('style');
  style.id = 'state-color-zones';
  style.textContent =
    '.page-wrapper .navbar_link{color:var(--zone-nav-link);}' +
    '.page-wrapper .navbar_link:hover{color:var(--link-color--link-primary-hover);}' +
    '.page-wrapper .navbar_logo-link,.page-wrapper .navbar_logo-link *{color:var(--zone-nav-logo)!important;}' +
    '.page-wrapper .text-color-secondary{color:var(--zone-secondary);}' +
    // The footer has its own yellow background, so it keeps the page's own
    // text colours instead of following the zone above it (the dark zone
    // runs to the bottom of the page and would turn its text cream).
    '.page-wrapper .footer{color:var(--text-color--text-primary);}' +
    '.page-wrapper .footer .text-color-secondary{color:var(--text-color--text-secondary);}' +
    // Same for the Leasing Now popup, which is yellow too and sits inside
    // the nav, so it would pick up the zone's colours when opened over one.
    '.page-wrapper .contact-modal_component{color:var(--text-color--text-primary);}' +
    '.page-wrapper .contact-modal_component .text-color-secondary{color:var(--text-color--text-secondary);}';
  document.head.appendChild(style);
}
const COLOR_ZONE_DURATION = 0.8;

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function initColorZones() {
  if (typeof window.gsap === 'undefined' || !hasScrollTrigger) return;

  const target = document.querySelector('.page-wrapper');
  if (!target) return;

  const ease = registerEases();

  // Captured before any zone runs, so scrolling back above the first zone
  // has a true resting state to go back to.
  // .page-wrapper has no background of its own, so its resting colour is the
  // body's. Fading from "transparent" would dip through dark tones (it's
  // transparent black), so the body's colour is used instead.
  let defaultBg = getComputedStyle(target).backgroundColor;
  if (defaultBg === 'transparent' || /rgba\(.*,\s*0\)$/.test(defaultBg)) {
    defaultBg = getComputedStyle(document.body).backgroundColor;
  }
  const defaultText = getComputedStyle(target).color;

  // Resting colours, measured before the override style goes in.
  const colorOf = (sel, fallback) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el).color : fallback;
  };
  const defaults = {
    '--zone-nav-link': colorOf('.navbar_link', defaultText),
    '--zone-nav-logo': colorOf('.navbar_logo-primary', defaultText),
    '--zone-secondary': cssVar('--text-color--text-secondary') || colorOf('.text-color-secondary', defaultText),
  };
  gsap.set(target, defaults);
  ensureColorZoneStyle();

  const tweenTo = (backgroundColor, color, extra) => {
    gsap.to(target, {
      backgroundColor, color, ...extra,
      duration: COLOR_ZONE_DURATION, ease, overwrite: 'auto',
    });
  };

  let first = true;
  COLOR_ZONES.forEach(({ selector, bg, text, nav, secondary }) => {
    const trigger = document.querySelector(selector);
    if (!trigger) return;

    const bgColor = cssVar(bg);
    const textColor = cssVar(text);
    if (!bgColor) {
      console.warn('[color zones] missing colour variable', bg);
      return;
    }

    const navColor = nav && cssVar(nav);
    const secondaryColor = secondary && cssVar(secondary);
    const extra = {
      '--zone-nav-link': navColor || defaults['--zone-nav-link'],
      '--zone-nav-logo': navColor || defaults['--zone-nav-logo'],
      '--zone-secondary': secondaryColor || defaults['--zone-secondary'],
    };
    const setZone = () => tweenTo(bgColor, textColor || defaultText, extra);
    const vars = {
      trigger,
      start: 'top top',
      end: 'bottom top',
      onEnter: setZone,
      onEnterBack: setZone,
    };
    if (first) {
      vars.onLeaveBack = () => tweenTo(defaultBg, defaultText, defaults);
      first = false;
    }
    ScrollTrigger.create(vars);
  });
}

initColorZones();

// -----------------------------------------
// GLOBAL PARALLAX (ported from Whitehall)
// -----------------------------------------
// Image-in-a-frame setup in Webflow (Home page, 13 photos):
//   frame div  the image's original classes (keeps size and placement)
//     .parallax-mask    data-parallax="trigger"  (overflow: hidden; 100% x 100%)
//       .parallax-target  data-parallax="target" (width 100%; height 110%)
//         .parallax-img     (block; 100% x 100%; object-fit: cover)
//
// Default travel fits the image exactly, as on Whitehall: the target is 110%
// of its frame, so it drifts from its top edge flush with the frame's top to
// its bottom edge flush with the frame's bottom, never exposing a gap. It's
// measured from layout (transform cleared), so it holds at any size.
// data-parallax-start / -end (in % of the target) still override it.
//
// Scale scrubs on the same scroll: it starts slightly zoomed and settles to 1.
// Override per image with data-parallax-scale-start / -scale-end.
const PARALLAX_SCALE_START = 1.1;
const PARALLAX_SCALE_END = 1;

function initGlobalParallax() {
  const mm = gsap.matchMedia();

  mm.add({
    isMobile: '(max-width: 479px)',
    isMobileLandscape: '(max-width: 767px)',
    isTablet: '(max-width: 991px)',
    isDesktop: '(min-width: 992px)'
  }, (context) => {
    const { isMobile, isMobileLandscape, isTablet } = context.conditions;

    const ctx = gsap.context(() => {
      document.querySelectorAll('[data-parallax="trigger"]').forEach((trigger) => {
        const disable = trigger.getAttribute('data-parallax-disable');

        if (
          (disable === 'mobile' && isMobile) ||
          (disable === 'mobileLandscape' && isMobileLandscape) ||
          (disable === 'tablet' && isTablet)
        ) return;

        const target = trigger.querySelector('[data-parallax="target"]') || trigger;
        const direction = trigger.getAttribute('data-parallax-direction') || 'vertical';
        const horizontal = direction === 'horizontal';
        const prop = horizontal ? 'x' : 'y';

        const scrubAttr = trigger.getAttribute('data-parallax-scrub');
        const startAttr = trigger.getAttribute('data-parallax-start');
        const endAttr = trigger.getAttribute('data-parallax-end');

        const scrub = scrubAttr !== null ? parseFloat(scrubAttr) : true;

        const fitTravel = () => {
          const previous = target.style.transform;
          target.style.transform = 'none';
          const t = target.getBoundingClientRect();
          const b = trigger.getBoundingClientRect();
          target.style.transform = previous;
          const size = horizontal ? t.width : t.height;
          const box = horizontal ? b.width : b.height;
          const offset = horizontal ? t.left - b.left : t.top - b.top;
          return { from: -offset, to: box - size - offset };
        };
        const targetSize = () => (horizontal ? target.offsetWidth : target.offsetHeight);
        const startVal = startAttr !== null ? () => (parseFloat(startAttr) / 100) * targetSize() : () => fitTravel().from;
        const endVal = endAttr !== null ? () => (parseFloat(endAttr) / 100) * targetSize() : () => fitTravel().to;

        const scrollStart = `clamp(${trigger.getAttribute('data-parallax-scroll-start') || 'top bottom'})`;
        const scrollEnd = `clamp(${trigger.getAttribute('data-parallax-scroll-end') || 'bottom top'})`;

        const scaleStartAttr = trigger.getAttribute('data-parallax-scale-start');
        const scaleEndAttr = trigger.getAttribute('data-parallax-scale-end');
        const scaleStart = scaleStartAttr !== null ? parseFloat(scaleStartAttr) : PARALLAX_SCALE_START;
        const scaleEnd = scaleEndAttr !== null ? parseFloat(scaleEndAttr) : PARALLAX_SCALE_END;

        gsap.fromTo(target, {
          [prop]: startVal,
          scale: scaleStart
        }, {
          [prop]: endVal,
          scale: scaleEnd,
          ease: 'none',
          scrollTrigger: {
            trigger,
            start: scrollStart,
            end: scrollEnd,
            scrub,
            invalidateOnRefresh: true
          }
        });
      });
    });

    return () => ctx.revert();
  });
}

// Initialize Global Parallax Setup
if (typeof window.gsap !== 'undefined' && hasScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  document.addEventListener("DOMContentLoaded", () => {
    initGlobalParallax();
  });
}

// -----------------------------------------
// KEEP SCROLL TRIGGERS IN STEP WITH THE LAYOUT
// -----------------------------------------
// ScrollTrigger measures where everything sits once, at load. Images here
// lazy-load as you scroll, and each one that arrives can make the page taller,
// pushing everything below it further down. Without a re-measure the triggers
// below stay where they were, so the parallax (and every other scroll
// animation) starts and finishes early, stopping around mid-screen. Watch the
// page height and refresh ScrollTrigger (debounced) whenever it changes.
function watchLayoutHeight() {
  if (!hasScrollTrigger || typeof ResizeObserver === 'undefined') return;
  let lastHeight = document.documentElement.scrollHeight;
  new ResizeObserver(() => {
    const height = document.documentElement.scrollHeight;
    if (height === lastHeight) return;
    lastHeight = height;
    refreshScrollTriggersSoon();
  }).observe(document.body);
}

watchLayoutHeight();

// -----------------------------------------
// BEFORE / AFTER TOGGLE ([data-before-after])
// -----------------------------------------
// Webflow markup (Home page):
//   section             data-before-after
//     link "Future State"   data-ba-link="after"   data-underline-link="alt"  (+ is-active)
//     link "Current State"  data-ba-link="before"  data-underline-link
//     image                 data-ba-image="before"
//     image                 data-ba-image="after"
//
// It starts on Future State with the after image showing. Clicking a link
// fades its image in on top of the one that's showing; the old image is only
// hidden once the new one is fully opaque, so there's always an image there.
// The active link gets the is-active combo (its colour) and keeps its
// underline, behaving like an "alt" underline link; the other only underlines
// on hover. Both links reveal on scroll through data-split="lines", and the
// active link's underline draws in with that reveal, as on Whitehall.
const BEFORE_AFTER = { fade: 0.8, activeClass: 'is-active' };

// The links also carry classic Webflow click interactions ("Future State
// [clicked]" / "Current State [clicked]") that switch the images with
// display:none/block and set inline text colours. The display switch hid the
// old image the instant you clicked, before the new one had faded in (the
// flash), and the inline colours kept a link yellow after it stopped being
// active. These rules override both, and turn off the images' CSS transition
// so it doesn't fight GSAP's fade. Deleting those two interactions in the
// Designer would be tidier.
function ensureBeforeAfterStyle() {
  if (document.getElementById('state-before-after')) return;
  const style = document.createElement('style');
  style.id = 'state-before-after';
  style.textContent =
    '[data-before-after] [data-ba-image]{display:block!important;transition:none!important;}' +
    '[data-ba-link]{color:var(--link-color--link-primary)!important;}' +
    '[data-ba-link]:hover{color:var(--link-color--link-primary-hover)!important;}' +
    '[data-ba-link].is-active{color:var(--link-color--link-alternate)!important;}' +
    // Parallax frame (see wrapBeforeAfterParallax): fills the section behind
    // its content and clips the taller moving layer.
    '[data-before-after] .ba-parallax-mask{position:absolute;inset:0;z-index:-1;overflow:hidden;pointer-events:none;}' +
    '[data-before-after] .ba-parallax-target{position:relative;width:100%;height:110%;}' +
    '[data-before-after] .ba-parallax-target [data-ba-image]{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}';
  document.head.appendChild(style);
}

// Both images go into one parallax frame, the same mask > target structure as
// the other photos, so they drift and scale together and the fade between
// them is unaffected. Runs before DOMContentLoaded, so the global parallax
// picks the frame up like any other.
function wrapBeforeAfterParallax(section, imgs) {
  if (!imgs.length || section.querySelector('.ba-parallax-mask')) return;
  const mask = document.createElement('div');
  mask.className = 'ba-parallax-mask';
  mask.setAttribute('data-parallax', 'trigger');
  const target = document.createElement('div');
  target.className = 'ba-parallax-target';
  target.setAttribute('data-parallax', 'target');
  imgs[0].before(mask);
  mask.appendChild(target);
  imgs.forEach((img) => target.appendChild(img));
}

function initBeforeAfter() {
  if (typeof window.gsap === 'undefined') return;
  if (document.querySelector('[data-before-after]')) ensureBeforeAfterStyle();
  document.querySelectorAll('[data-before-after]').forEach((section) => {
    const links = [...section.querySelectorAll('[data-ba-link]')];
    const images = {
      before: section.querySelector('[data-ba-image="before"]'),
      after: section.querySelector('[data-ba-image="after"]'),
    };
    wrapBeforeAfterParallax(section, [images.before, images.after].filter(Boolean));
    if (!links.length || !images.before || !images.after) return;

    // Load both before the section is reached, so the hidden one is ready
    // before it's first clicked rather than lazy-loading (and showing nothing)
    // mid-fade. Not straight away, though: these are big images, and fetching
    // them during the first paint holds up the hero. Start when the section is
    // a couple of screens away, or once the page is loaded and idle.
    let warmed = false;
    const warm = () => {
      if (warmed) return;
      warmed = true;
      Object.values(images).forEach((img) => {
        img.loading = 'eager';
        if (img.decode) img.decode().catch(() => {});
      });
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        warm();
      }, { rootMargin: '200% 0px' });
      io.observe(section);
    }
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
    const afterLoad = () => setTimeout(() => idle(warm, { timeout: 2000 }), 1500);
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, { once: true });

    let current = 'after';

    const setActiveLink = (link, active, animate) => {
      link.classList.toggle(BEFORE_AFTER.activeClass, active);
      link.setAttribute('aria-pressed', active ? 'true' : 'false');
      link.setAttribute('data-underline-link', active ? 'alt' : '');
      const state = setupUnderline(link);
      if (!state || state.alt === active) return;
      state.alt = active;
      // A link still waiting for its scroll reveal draws its line when the
      // reveal starts (releaseUnderline), so leave its bar alone here.
      if (!animate || state.waiting) return;
      gsap.killTweensOf(state.main);
      state.swiping = false;
      if (active) underlineGrow(state.main, 0);
      else underlineWipe(state.main, 0);
    };

    const show = (which, animate) => {
      if (!images[which]) return;
      const incoming = images[which];
      const outgoing = images[which === 'before' ? 'after' : 'before'];
      const changed = which !== current;
      current = which;
      links.forEach((link) => setActiveLink(link, link.getAttribute('data-ba-link') === which, animate));

      if (!animate) {
        gsap.set(incoming, { zIndex: -1, autoAlpha: 1 });
        gsap.set(outgoing, { zIndex: -2, autoAlpha: 0 });
        return;
      }
      if (!changed) return;

      // Both images stay negative, so they keep sitting behind the section's
      // content; the incoming one just goes one layer above the outgoing one.
      gsap.killTweensOf([incoming, outgoing]);
      gsap.set(outgoing, { zIndex: -2, autoAlpha: 1 });
      gsap.set(incoming, { zIndex: -1 });
      gsap.fromTo(incoming, { autoAlpha: 0 }, {
        autoAlpha: 1,
        duration: BEFORE_AFTER.fade,
        ease: registerEases(),
        onComplete: () => gsap.set(outgoing, { autoAlpha: 0 }),
      });
    };

    links.forEach((link) => {
      // The links are divs in Webflow, so make them behave like buttons.
      link.setAttribute('role', 'button');
      link.setAttribute('tabindex', '0');
      link.addEventListener('click', () => {
        show(link.getAttribute('data-ba-link'), true);
        link.blur();
      });
      link.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        show(link.getAttribute('data-ba-link'), true);
      });
    });

    show('after', false);
  });
}

initBeforeAfter();

// -----------------------------------------
// NAV ON SCROLL
// -----------------------------------------
// Scrolling down past NAV_SCROLL.threshold:
//   - the nav links stay where they are and fade out in a stagger (desktop;
//     below 992px they live in the hamburger menu, so they're left alone)
//   - the full State logo fades out as the small crest fades in, in the same
//     spot
//   - the logo and the Leasing Now button don't move
// Scrolling back up plays it in reverse.
//
// The navbar also has a classic Webflow scroll interaction that slides the
// menu up and swaps the logos with display:none/block (that swap is what made
// the logo flash, and the taller crest made the navbar grow, nudging the
// button down). The CSS below overrides both, so this can run alongside it.
// Deleting that interaction in the Designer would be tidier.
const NAV_SCROLL = { threshold: 80, duration: 0.5, stagger: 0.08 };
// The nav's CTA button is light blue at the top of the page and turns yellow
// once you scroll down, with the links and logo. Hover stays the site's pink.
const NAV_CTA = {
  // The first nav button outside the popup. The popup (inside the nav) has
  // its own buttons, Close and Submit, which keep their own colours.
  selector: '.nav_fixed .button:not(.contact-modal_component .button)',
  cls: 'state-nav-cta',
  top: '--base-color-brand--neutral-1',
  scrolled: '--base-color-brand--golden-fizz',
};
// Shared with the footer fade below: while the footer is on screen the links
// stay out whatever the scroll does.
let navOverFooter = false;
let navLinksTo = null;

function initNavScroll() {
  if (typeof window.gsap === 'undefined' || !hasScrollTrigger) return;
  const primary = document.querySelector('.navbar_logo-primary');
  const crest = document.querySelector('.navbar_logo-crestogram');
  const links = [...document.querySelectorAll('.navbar_menu .navbar_link')];
  if (!primary || !crest) return;

  if (!document.getElementById('state-nav-scroll')) {
    const style = document.createElement('style');
    style.id = 'state-nav-scroll';
    style.textContent =
      // Both logos always rendered, so they can crossfade. The crest sits on
      // top of the full logo, centred on it, and out of the layout, so the
      // navbar keeps its height and the button stays put.
      '.navbar_logo-link{position:relative;}' +
      '.navbar_logo-primary{display:block!important;}' +
      '.navbar_logo-crestogram{display:block!important;position:absolute;left:0;top:50%;transform:translateY(-50%);}' +
      // Keep the desktop links in place instead of sliding them away.
      '@media (min-width:992px){.navbar_menu{transform:none!important;}}' +
      // The fixed bar is mostly empty space; let clicks pass through it to
      // the page, and only the links, logo and CTA catch them. Children of
      // a link inherit "auto", so its icons and text stay clickable. Faded
      // links are visibility:hidden, so they pass clicks through too.
      '.nav_fixed{pointer-events:none;}' +
      '.nav_fixed a,.nav_fixed button,.nav_fixed input,.nav_fixed select,.nav_fixed [role="button"],.nav_fixed .w-nav-button{pointer-events:auto;}' +
      // The Leasing Now popup lives inside the nav; it needs the pointer
      // across all of it, or wheel and taps on it pass through to the page.
      '.nav_fixed .contact-modal_component{pointer-events:auto;}' +
      // The popup's Close button has the same dark outline as the Leasing
      // Now button, and turns pink on hover (the other buttons' hover pink)
      // with dark text, since its yellow doesn't read on pink.
      '.contact-modal_component .contact-modal5_close-button.button{border:1px solid var(--border-color--border-primary);' +
        'transition:background-color 0.2s ease,color 0.2s ease;}' +
      '.contact-modal_component .contact-modal5_close-button.button:hover{background-color:var(--base-color-brand--hover--rosebud);color:var(--text-color--text-primary);}' +
      // Over the footer the links and logo are out and can't be clicked, from
      // the moment they start fading (visibility only switches off at the end).
      '.nav-over-footer .navbar_logo-link,.nav-over-footer .navbar_logo-link *{pointer-events:none!important;}' +
      '@media (min-width:992px){.nav-over-footer .navbar_menu .navbar_link{pointer-events:none!important;}}';
    document.head.appendChild(style);
  }

  const ease = registerEases();
  let scrolled = false;
  // Below 992px (the mobile nav) the logo is always the small crest; above
  // it, the full logo shows at the top of the page and the crest once
  // scrolled.
  const desktop = window.matchMedia('(min-width: 992px)');
  const logoTo = (showCrest, instant) => {
    const vars = { duration: instant ? 0 : NAV_SCROLL.duration, ease, overwrite: 'auto' };
    gsap.to(primary, { autoAlpha: showCrest ? 0 : 1, ...vars });
    gsap.to(crest, { autoAlpha: showCrest ? 1 : 0, ...vars });
  };
  logoTo(!desktop.matches, true);

  // CTA colours, read from the Webflow variables so a palette change carries
  // through.
  const cta = document.querySelector(NAV_CTA.selector);
  const ctaColors = (name) => ({ '--nav-cta-bg': cssVar(name) });
  if (cta && !document.getElementById('state-nav-cta')) {
    const style = document.createElement('style');
    style.id = 'state-nav-cta';
    style.textContent =
      // Doubled-up selector so this outranks Webflow's .button.is-secondary
      // colour. Hover is left to the site's own pink (set !important there).
      '.nav_fixed .button.' + NAV_CTA.cls + '{background-color:var(--nav-cta-bg);}';
    document.head.appendChild(style);
  }
  if (cta) {
    cta.classList.add(NAV_CTA.cls);
    gsap.set(cta, ctaColors(NAV_CTA.top));
  }

  const toLinks = (hide) => {
    if (!window.matchMedia('(min-width: 992px)').matches) {
      gsap.set(links, { clearProps: 'opacity,visibility' });
      return;
    }
    gsap.to(links, {
      autoAlpha: hide ? 0 : 1,
      duration: NAV_SCROLL.duration,
      ease,
      // Out left to right; back in right to left, so it reads as a reverse.
      stagger: { each: NAV_SCROLL.stagger, from: hide ? 'start' : 'end' },
      overwrite: 'auto',
    });
  };

  const setScrolled = (next) => {
    if (next === scrolled) return;
    scrolled = next;
    // Over the footer the links are already out and stay out.
    if (!navOverFooter) toLinks(next);
    if (cta) {
      gsap.to(cta, {
        ...ctaColors(next ? NAV_CTA.scrolled : NAV_CTA.top),
        duration: NAV_SCROLL.duration, ease, overwrite: 'auto',
      });
    }
    logoTo(next || !desktop.matches);
  };

  // Only the start line matters. With an end at 'max', reaching the very
  // bottom of the page counted as leaving, which brought the links back.
  ScrollTrigger.create({
    start: NAV_SCROLL.threshold,
    onEnter: () => setScrolled(true),
    onLeaveBack: () => setScrolled(false),
  });

  navLinksTo = (hide) => toLinks(hide || scrolled);

  // Crossing the 992px breakpoint: show the links again below it, and match
  // the scroll state above it.
  desktop.addEventListener('change', () => {
    toLinks(scrolled || navOverFooter);
    logoTo(scrolled || !desktop.matches, true);
  });
}

initNavScroll();

// -----------------------------------------
// NAV LOGO: SCROLL TO TOP (as on Whitehall)
// -----------------------------------------
// On the homepage the logo scrolls smoothly back to the top instead of
// reloading the page. On any other page it stays a normal link home.
// Timing matches Whitehall: 2s on the site ease (same curve as Whitehall's).
const LOGO_SCROLL_TOP = { duration: 2 };

function initLogoScrollTop() {
  const ease = registerEases();
  const scrollToTop = () => {
    if (lenis && typeof lenis.scrollTo === 'function') {
      lenis.scrollTo(0, {
        duration: LOGO_SCROLL_TOP.duration,
        easing: ease !== 'none' ? gsap.parseEase(ease) : undefined,
        force: true,
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const samePage = link =>
    link.pathname.replace(/\/$/, '') === window.location.pathname.replace(/\/$/, '');

  // Capture phase, so Webflow's own nav handlers never see a same-page click.
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('.navbar_logo-link[href]');
    if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    if (!samePage(link)) return; // other pages: a normal link home
    e.preventDefault();
    e.stopImmediatePropagation();
    scrollToTop();
  }, true);
}

initLogoScrollTop();

// -----------------------------------------
// NAV LOGO: FADE OUT OVER THE FOOTER
// -----------------------------------------
// Once the top of the footer is halfway up the screen, the nav logo and links
// fade out and can't be clicked, and they come back when you scroll up past
// that point. Nothing else brings them back while the footer is on screen.
// The whole logo link fades, so the full-logo/crest crossfade above is
// untouched.
const NAV_LOGO_FOOTER = { start: 'top 50%', duration: 0.5 };

function initNavLogoFooterFade() {
  if (typeof window.gsap === 'undefined' || !hasScrollTrigger) return;
  const logo = document.querySelector('.navbar_logo-link');
  const footer = document.querySelector('.footer');
  if (!logo || !footer) return;

  const ease = registerEases();
  const setOverFooter = (over) => {
    navOverFooter = over;
    document.documentElement.classList.toggle('nav-over-footer', over);
    gsap.to(logo, {
      autoAlpha: over ? 0 : 1, duration: NAV_LOGO_FOOTER.duration, ease, overwrite: 'auto',
    });
    // Scrolling back up from the footer leaves the links as the scroll state
    // has them (out, since that's always past the top of the page).
    if (navLinksTo) navLinksTo(over);
  };
  // Only the start line matters: past it they stay out, all the way to the
  // bottom of the page (an end line would bring them back at max scroll).
  ScrollTrigger.create({
    trigger: footer,
    start: NAV_LOGO_FOOTER.start,
    onEnter: () => setOverFooter(true),
    onLeaveBack: () => setOverFooter(false),
  });
}

initNavLogoFooterFade();

// -----------------------------------------
// FOOTER REVEAL
// -----------------------------------------
// The footer plays as one sequence, as Whitehall's does, once its top is 85%
// down the screen. Everything in it comes in one after another, ordered from
// top left to bottom right: a wave across the footer's diagonal, the footer
// being measured on both axes so its width doesn't outweigh its height.
//  - text: split into lines, each line rising and fading in like the
//    paragraph line reveal
//  - form fields: their bottom borders draw in left to right like the
//    separator lines, with the placeholder text fading in alongside
//  - logos: fade in
//  - the submit button: rises and fades in as one piece
// An item that comes up in the order before it has scrolled into view (the
// footer is taller than the screen on phones) waits until it does.
const FOOTER_REVEAL = {
  root: '.footer',
  start: 'top 85%',
  itemStart: 'top 100%',
  stagger: 0.035,
  logos: '.footer img, .footer .leasing-logo, .footer .footer-logo',
  fields: '.footer .form_input',
  units: '.footer input[type="submit"], .footer .w-button',
  // Hidden by Webflow until the form is sent; never part of the reveal.
  skip: '.w-form-done, .w-form-fail',
  logoFade: 1,
};

function ensureFooterRevealStyle() {
  if (document.getElementById('state-footer-reveal')) return;
  const style = document.createElement('style');
  style.id = 'state-footer-reveal';
  // An <input> can't have ::before/::after, so its line is a background
  // gradient instead: sized to --rule-scale of the width, sitting where the
  // (now transparent) bottom border was.
  style.textContent =
    '.state-field-rule{border-bottom-color:transparent!important;' +
      'background-image:linear-gradient(var(--rule-color),var(--rule-color));' +
      'background-repeat:no-repeat;background-origin:border-box;background-position:left bottom;' +
      'background-size:calc(var(--rule-scale,1) * 100%) var(--rule-w);}' +
    '.state-field-rule::placeholder{opacity:var(--placeholder-opacity,1);}';
  document.head.appendChild(style);
}

// Blocks of text in the footer: anything with its own text, or the nearest
// block around it when it's an inline piece of a larger run.
function footerTextBlocks(root) {
  const blocks = new Set();
  root.querySelectorAll('*').forEach((el) => {
    if (el.closest(FOOTER_REVEAL.skip) || el.closest('form')) return;
    if (/^(SCRIPT|STYLE|SVG|svg)$/.test(el.tagName) || el.closest('svg')) return;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!ownText) return;
    let block = el;
    while (block !== root && getComputedStyle(block).display === 'inline') block = block.parentElement;
    if (block !== root) blocks.add(block);
  });
  // Keep the outermost of any nested blocks, so nothing is split twice.
  return [...blocks].filter((el) => ![...blocks].some((other) => other !== el && other.contains(el)));
}

function initFooterReveal() {
  if (typeof window.gsap === 'undefined' || !hasScrollTrigger) return;
  if (typeof window.SplitText === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.querySelector(FOOTER_REVEAL.root);
  if (!root) return;

  gsap.registerPlugin(SplitText, ScrollTrigger);
  ensureFooterRevealStyle();
  const ease = registerEases();
  const hiddenLine = { opacity: 0, y: `${LINE_REVEAL.travelEm}em` };
  let started = false;

  // Each source gives back the pieces it animates; `trigger` is the element
  // whose arrival on screen lets those pieces play.
  const sources = [];

  footerTextBlocks(root).forEach((el) => {
    const source = { trigger: el, split: null };
    source.split = SplitText.create(el, {
      type: 'lines',
      aria: 'none',
      autoSplit: true,
      onSplit(self) {
        keepTextIndent(el, self.lines);
        // A re-split once the sequence is under way shows the new lines as
        // they are, rather than leaving any of them hidden.
        gsap.set(self.lines, started ? { opacity: 1, y: 0 } : hiddenLine);
        if (source.split) {
          restoreUnderlines(el);
          refreshScrollTriggersSoon();
        }
      },
    });
    source.pieces = () => source.split.lines.map((line) => ({
      el: line,
      play: (delay) => gsap.to(line, {
        opacity: 1, y: 0, duration: LINE_REVEAL.duration, ease, delay,
      }),
    }));
    sources.push(source);
  });

  root.querySelectorAll(FOOTER_REVEAL.logos).forEach((el) => {
    if (el.closest(FOOTER_REVEAL.skip)) return;
    gsap.set(el, { opacity: 0 });
    sources.push({
      trigger: el,
      pieces: () => [{
        el,
        play: (delay) => gsap.to(el, { opacity: 1, duration: FOOTER_REVEAL.logoFade, ease, delay }),
      }],
    });
  });

  document.querySelectorAll(FOOTER_REVEAL.fields).forEach((el) => {
    const cs = getComputedStyle(el);
    const width = parseFloat(cs.borderBottomWidth);
    if (!width || cs.borderBottomStyle === 'none') return;
    el.style.setProperty('--rule-w', `${width}px`);
    el.style.setProperty('--rule-color', cs.borderBottomColor);
    el.classList.add('state-field-rule');
    gsap.set(el, { '--rule-scale': 0, '--placeholder-opacity': 0 });
    sources.push({
      trigger: el,
      pieces: () => [{
        el,
        play: (delay) => {
          // Once drawn, the real border goes back on: Chrome's autofill style
          // forces background-image off, which would erase the drawn line.
          gsap.to(el, {
            '--rule-scale': 1, duration: RULE_REVEAL.duration, ease, delay,
            onComplete: () => el.classList.remove('state-field-rule'),
          });
          gsap.to(el, { '--placeholder-opacity': 1, duration: LINE_REVEAL.duration, ease, delay });
        },
      }],
    });
  });

  document.querySelectorAll(FOOTER_REVEAL.units).forEach((el) => {
    if (!root.contains(el) || el.classList.contains('state-field-rule')) return;
    gsap.set(el, hiddenLine);
    sources.push({
      trigger: el,
      pieces: () => [{
        el,
        play: (delay) => gsap.to(el, {
          opacity: 1, y: 0, duration: LINE_REVEAL.duration, ease, delay, clearProps: 'transform',
        }),
      }],
    });
  });

  if (!sources.length) return;

  // Each trigger element records when it has come on screen, and plays any
  // of its pieces whose turn in the order has already come.
  sources.forEach((source) => {
    source.reached = false;
    source.waiting = [];
    ScrollTrigger.create({
      trigger: source.trigger,
      start: revealStart(source.trigger, FOOTER_REVEAL.itemStart),
      once: true,
      onEnter: () => {
        source.reached = true;
        source.waiting.forEach((piece) => piece.play(0));
        source.waiting = [];
      },
    });
  });

  ScrollTrigger.create({
    trigger: root,
    start: revealStart(root, FOOTER_REVEAL.start),
    once: true,
    onEnter: () => {
      started = true;
      const box = root.getBoundingClientRect();
      const w = box.width || 1;
      const h = box.height || 1;
      const pieces = sources.flatMap((source) => source.pieces().map((piece) => {
        const r = piece.el.getBoundingClientRect();
        return { ...piece, source, order: (r.left - box.left) / w + (r.top - box.top) / h };
      }));
      // Pieces not on show at this screen size (zero-sized) are set visible
      // straight away, so they don't take up a turn in the order.
      const shown = pieces.filter((piece) => {
        const r = piece.el.getBoundingClientRect();
        if (r.width || r.height) return true;
        piece.play(0);
        return false;
      });
      shown.sort((a, b) => a.order - b.order);
      shown.forEach((piece, i) => {
        gsap.delayedCall(i * FOOTER_REVEAL.stagger, () => {
          if (piece.source.reached) piece.play(0);
          else piece.source.waiting.push(piece);
        });
      });
    },
  });
}

afterDomContentLoaded(initFooterReveal);

// -----------------------------------------
// LEASING IMAGE ON HOVER
// -----------------------------------------
// The Leasing Opportunities embed switches the 3D building image when a floor
// row is clicked. This shows each floor's image as soon as its row is
// hovered. When the pointer leaves the list, the last floor hovered stays
// showing, image and row highlight both, until another row is hovered or
// clicked. Clicking still opens the row as before. Only on devices with a real pointer; touch keeps
// tap to switch.
const FLOOR_HOVER = {
  list: '.floor-collection-list',
  item: '.floor-collection-list-item',
  image: '.tenancy-3d-item',
  fallback: '.tenancy-3d-default-state',
  visible: 'is-visible',
  kept: 'is-hover-kept',
};

function initFloorImageHover() {
  const list = document.querySelector(FLOOR_HOVER.list);
  const images = [...document.querySelectorAll(FLOOR_HOVER.image)];
  if (!list || !images.length) return;
  const fallback = document.querySelector(FLOOR_HOVER.fallback);
  const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // null shows the default view, as the embed does with nothing selected.
  const show = (level) => {
    images.forEach((img) => img.classList.toggle(FLOOR_HOVER.visible, img.getAttribute('data-level') === level));
    if (fallback) fallback.classList.toggle(FLOOR_HOVER.visible, level === null);
  };

  const items = [...list.querySelectorAll(FLOOR_HOVER.item)];
  const keep = (item) => items.forEach((other) => other.classList.toggle(FLOOR_HOVER.kept, other === item));

  let hovered = null;
  items.forEach((item) => {
    const level = item.getAttribute('data-level');
    item.addEventListener('mouseenter', () => {
      if (!canHover()) return;
      hovered = level;
      keep(item);
      show(level);
    });
    // Clicking the open floor closes it, and the embed then shows the
    // default view; the pointer is still on this floor, so keep its image.
    // This runs after the embed's own click handler, which is added first.
    item.addEventListener('click', () => {
      if (canHover() && hovered === level) show(level);
    });
  });
  // Leaving the list keeps the last floor hovered showing; nothing to undo.
  list.addEventListener('mouseleave', () => { hovered = null; });
}

afterDomContentLoaded(initFloorImageHover);

// -----------------------------------------
// LEASED ROW FILL ON SCROLL
// -----------------------------------------
// A fully leased floor's row has a fixed blue-grey background. Instead of it
// just being there, it fills up from the bottom of the row, the same way the
// hover fill does, once, as the row scrolls into view (with its separator
// line, on the same timing). It uses the hover fill's pseudo-element, given
// the leased colour; the embed adds .is-leased on load.
const LEASED_FILL = {
  rows: '.building-section .floor-collection-list-item.is-leased .tenancy-header:not(.static)',
  color: 'var(--base-color-brand--neutral-1, #c3d1d1)',
};

// A leased floor can't be opened, so its text doesn't change colour on hover
// the way the other floors' does; it keeps whatever colour it inherits.
(function ensureLeasedNoHoverStyle() {
  if (document.getElementById('state-leased-no-hover')) return;
  const style = document.createElement('style');
  style.id = 'state-leased-no-hover';
  style.textContent = '.floor-collection-list-item.is-leased .tenancy-grid.tenancy-header:hover{color:inherit;}';
  document.head.appendChild(style);
})();

function initLeasedRowFill() {
  if (typeof window.gsap === 'undefined' || !hasScrollTrigger) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rows = [...document.querySelectorAll(LEASED_FILL.rows)];
  if (!rows.length) return;

  if (!document.getElementById('state-leased-fill')) {
    const style = document.createElement('style');
    style.id = 'state-leased-fill';
    // No CSS transition here: GSAP drives the fill frame by frame.
    style.textContent =
      LEASED_FILL.rows + '{background-color:transparent!important;}' +
      LEASED_FILL.rows + '::before{background-color:' + LEASED_FILL.color + ';' +
        'transform:scaleY(var(--leased-fill,1))!important;transition:none;}';
    document.head.appendChild(style);
  }

  const ease = registerEases();
  rows.forEach((row) => {
    gsap.set(row, { '--leased-fill': 0 });
    ScrollTrigger.create({
      trigger: row,
      start: revealStart(row, RULE_REVEAL.start),
      once: true,
      onEnter: () => gsap.to(row, { '--leased-fill': 1, duration: RULE_REVEAL.duration, ease }),
    });
  });
}

afterDomContentLoaded(initLeasedRowFill);

// -----------------------------------------
// FORM AUTOFILL COLOURS
// -----------------------------------------
// Chrome paints autofilled fields light blue with its own text colour. The
// fields here have no background of their own (they show the yellow behind
// them), so an inset shadow in that yellow is painted over Chrome's blue,
// inside the border so the bottom line still shows. The long transition is
// the usual belt-and-braces that stops the blue fading in at all. Covers the
// footer form and the Leasing Now popup's.
(function ensureAutofillStyle() {
  if (document.getElementById('state-autofill')) return;
  const style = document.createElement('style');
  style.id = 'state-autofill';
  const states = ['', ':hover', ':focus', ':active'];
  const selector = [
    ...states.map((s) => `.form_input:-webkit-autofill${s}`),
    ...states.map((s) => `.form_input:autofill${s}`),
  ];
  const rule = '{' +
    '-webkit-text-fill-color:var(--text-color--text-primary)!important;' +
    'caret-color:var(--text-color--text-primary);' +
    '-webkit-box-shadow:0 0 0 1000px var(--background-color--background-alternate) inset!important;' +
    'box-shadow:0 0 0 1000px var(--background-color--background-alternate) inset!important;' +
    'transition:background-color 600000s 0s,color 600000s 0s;' +
    '}';
  // Separate rules: a browser that doesn't know one of the pseudo-classes
  // throws out the whole rule it's in.
  let css = selector.map((sel) => sel + rule).join('');

  // Webflow's default focus colour turns a field's line blue; keep it the
  // field's own colour.
  css += '.form_input:focus{border-color:var(--border-color--border-primary);}';

  style.textContent = css;
  document.head.appendChild(style);
})();
