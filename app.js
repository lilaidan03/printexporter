/**
 * Print Exporter — app.js
 * --------------------------------
 * All image processing runs in the browser via Canvas.
 * ZIP creation is handled by JSZip (loaded from CDN).
 *
 * How to run locally:
 *   1. Open index.html directly in a browser, OR
 *   2. Serve with any static server (e.g. `npx serve .` or Python `http.server`).
 *
 * How to deploy to GitHub Pages:
 *   1. Push index.html, styles.css, and app.js to a GitHub repo.
 *   2. Go to Settings → Pages → set source to the branch / folder containing the files.
 *   3. Your site will be live at https://<user>.github.io/<repo>/
 */

// =============================================================================
// CONFIG — target poster ratios (grouped by ratio, with portrait + landscape)
// =============================================================================

/**
 * Each group defines a base ratio (e.g. 2:3) with both orientations.
 * The UI shows only one orientation at a time based on the active tab.
 *
 *   id         – unique group identifier
 *   groupLabel – displayed above the card (e.g. "2 : 3")
 *   portrait   – target dimensions when width < height
 *   landscape  – target dimensions when width > height
 */
const RATIO_GROUPS = [
  {
    id: '2x3',
    groupLabel: '2 : 3',
    portrait:  { label: '2:3 Portrait',  filelabel: '24x36_portrait',  name: '24\u2033 \u00d7 36\u2033',       desc: '7200 \u00d7 10800 px', width: 7200,  height: 10800 },
    landscape: { label: '2:3 Landscape', filelabel: '36x24_landscape', name: '36\u2033 \u00d7 24\u2033',       desc: '10800 \u00d7 7200 px', width: 10800, height: 7200  },
  },
  {
    id: 'ISO_A1',
    groupLabel: 'ISO A1',
    portrait:  { label: 'A1 Portrait',  filelabel: 'A1_portrait',  name: 'A1 (594 \u00d7 841 mm)', desc: '7016 \u00d7 9933 px', width: 7016,  height: 9933 },
    landscape: { label: 'A1 Landscape', filelabel: 'A1_landscape', name: 'A1 (841 \u00d7 594 mm)', desc: '9933 \u00d7 7016 px', width: 9933,  height: 7016 },
  },
  {
    id: '4x5',
    groupLabel: '4 : 5',
    portrait:  { label: '4:5 Portrait',  filelabel: '24x30_portrait',  name: '24\u2033 \u00d7 30\u2033', desc: '7200 \u00d7 9000 px', width: 7200, height: 9000 },
    landscape: { label: '4:5 Landscape', filelabel: '30x24_landscape', name: '30\u2033 \u00d7 24\u2033', desc: '9000 \u00d7 7200 px', width: 9000, height: 7200 },
  },
  {
    id: '3x4',
    groupLabel: '3 : 4',
    portrait:  { label: '3:4 Portrait',  filelabel: '24x32_portrait',  name: '24\u2033 \u00d7 32\u2033', desc: '7200 \u00d7 9600 px', width: 7200, height: 9600 },
    landscape: { label: '3:4 Landscape', filelabel: '32x24_landscape', name: '32\u2033 \u00d7 24\u2033', desc: '9600 \u00d7 7200 px', width: 9600, height: 7200 },
  },
  {
    id: '11x14',
    groupLabel: '11 : 14',
    portrait:  { label: '11:14 Portrait',  filelabel: '22x28_portrait',  name: '22\u2033 \u00d7 28\u2033', desc: '6600 \u00d7 8400 px', width: 6600, height: 8400 },
    landscape: { label: '11:14 Landscape', filelabel: '28x22_landscape', name: '28\u2033 \u00d7 22\u2033', desc: '8400 \u00d7 6600 px', width: 8400, height: 6600 },
  },
];

// =============================================================================
// DOM REFERENCES
// =============================================================================

const dropZone            = document.getElementById('dropZone');
const fileInput           = document.getElementById('fileInput');
const imageInfoSection    = document.getElementById('imageInfo');
const previewCanvas       = document.getElementById('previewCanvas');
const fileNameEl          = document.getElementById('fileName');
const exportNameInput     = document.getElementById('exportName');
const exportNamePreview   = document.getElementById('exportNamePreview');
const infoDimensions      = document.getElementById('infoDimensions');
const infoRatio           = document.getElementById('infoRatio');
const infoSize            = document.getElementById('infoSize');
const clearBtn            = document.getElementById('clearBtn');
const ratioSection        = document.getElementById('ratioSection');
const uploadSection       = document.getElementById('uploadSection');
const ratioGrid           = document.getElementById('ratioGrid');
const tabPortrait         = document.getElementById('tabPortrait');
const tabLandscape        = document.getElementById('tabLandscape');
const orientationWarning  = document.getElementById('orientationWarning');
const orientationWarnText = document.getElementById('orientationWarningText');
const selectAllBtn        = document.getElementById('selectAllBtn');
const deselectAllBtn      = document.getElementById('deselectAllBtn');
const exportSection       = document.getElementById('exportSection');
const exportBtn           = document.getElementById('exportBtn');
const progressOverlay     = document.getElementById('progressOverlay');
const progressStatus      = document.getElementById('progressStatus');
const progressBar         = document.getElementById('progressBar');
const progressPercent     = document.getElementById('progressPercent');

// Format picker checkboxes
const formatPngCheckbox   = document.getElementById('formatPng');
const formatJpegCheckbox  = document.getElementById('formatJpeg');

// Lightbox elements
const previewLightbox     = document.getElementById('previewLightbox');
const lightboxBackdrop    = document.getElementById('lightboxBackdrop');
const lightboxCanvas      = document.getElementById('lightboxCanvas');
const lightboxTitle       = document.getElementById('lightboxTitle');
const lightboxDesc        = document.getElementById('lightboxDesc');
const lightboxClose       = document.getElementById('lightboxClose');
const lightboxMatControls  = document.getElementById('lightboxMatControls');
const lightboxMatRange     = document.getElementById('lightboxMatRange');
const lightboxMatValue     = document.getElementById('lightboxMatValue');
const lightboxColorControl = document.getElementById('lightboxColorControl');
const lightboxColorInput   = document.getElementById('lightboxColorInput');

// =============================================================================
// STATE
// =============================================================================

/** @type {HTMLImageElement|null} */
let loadedImage = null;

/** @type {string} original file name (without extension) */
let originalName = '';

/** @type {'portrait'|'landscape'} currently selected orientation tab */
let currentOrientation = 'portrait';

/** @type {'portrait'|'landscape'|null} detected orientation of the source image */
let detectedOrientation = null;

/** @type {string|null} current object URL for cleanup (revoked after image loads) */
let currentObjectUrl = null;

/** @type {HTMLElement|null} the ratio card that opened the lightbox */
let lightboxSourceCard = null;

/** Lightbox context — stores info needed to re-render the large preview */
let lightboxContext = null;

// =============================================================================
// DRAG & DROP + FILE INPUT
// =============================================================================

// Prevent default browser file-open behaviour
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
  dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
});

// Visual feedback on drag
dropZone.addEventListener('dragenter', () => dropZone.classList.add('drag-over'));
dropZone.addEventListener('dragover',  () => dropZone.classList.add('drag-over'));
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// Click anywhere on the drop zone to open file picker
dropZone.addEventListener('click', () => fileInput.click());

// File input change
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file) handleFile(file);
});

// Clipboard paste support
document.addEventListener('paste', (e) => {
  // Don't intercept paste when the user is typing in an input field
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.kind === 'file' && item.type.match(/^image\/(jpeg|png)$/)) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) handleFile(file);
      return;
    }
    // Show feedback if user pastes an unsupported image or file type
    if (item.kind === 'file') {
      e.preventDefault();
      showToast('Unsupported file type. Please use a JPG or PNG image.');
      return;
    }
  }
});

// =============================================================================
// FILE HANDLING
// =============================================================================

/**
 * Validates the file, loads it as an Image, and updates the UI.
 * @param {File} file
 */
function handleFile(file) {
  // Validate type
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    showToast('Unsupported file type. Please use a JPG or PNG image.');
    return;
  }

  // Clean up previous image state if re-uploading
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  displaySkippedWarnings([]);

  const img = new Image();
  const url = URL.createObjectURL(file);
  currentObjectUrl = url;

  img.onload = () => {
    loadedImage = img;
    originalName = file.name.replace(/\.[^/.]+$/, ''); // strip extension

    // Revoke the object URL — the image bitmap is now decoded in memory
    URL.revokeObjectURL(url);
    currentObjectUrl = null;

    // Auto-detect orientation from image dimensions
    detectedOrientation = img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait';

    // Show info section
    showImageInfo(file, img);

    // Auto-select the matching orientation tab
    setOrientation(detectedOrientation);

    // Show export section
    exportSection.classList.remove('hidden');

    // Hide entire upload section (drop zone + button + hints)
    uploadSection.classList.add('hidden');
  };

  img.onerror = () => {
    alert('Unable to load the image. Please try another file.');
    URL.revokeObjectURL(url);
    currentObjectUrl = null;
  };

  img.src = url;
}

// =============================================================================
// IMAGE INFO / PREVIEW
// =============================================================================

/**
 * Renders a thumbnail preview and displays metadata.
 * @param {File} file
 * @param {HTMLImageElement} img
 */
function showImageInfo(file, img) {
  imageInfoSection.classList.remove('hidden');

  // Draw preview thumbnail
  const maxDim = 380; // CSS constrains visible size; draw at 2× for retina
  const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
  const pw = Math.round(img.width * scale);
  const ph = Math.round(img.height * scale);
  previewCanvas.width = pw;
  previewCanvas.height = ph;
  const ctx = previewCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0, pw, ph);

  // Metadata
  fileNameEl.textContent = `Source: ${file.name}`;
  infoDimensions.textContent = `${img.width} × ${img.height} px`;
  infoRatio.textContent = simplifyRatio(img.width, img.height);
  infoSize.textContent = formatBytes(file.size);

  // Auto-fill the export name input with the original filename (no extension)
  exportNameInput.value = originalName;
  updateExportNamePreview();
}

/**
 * Simplifies a width/height pair to the smallest integer ratio.
 * @param {number} w
 * @param {number} h
 * @returns {string}
 */
function simplifyRatio(w, h) {
  const g = gcd(w, h);
  const rw = w / g;
  const rh = h / g;
  // If the simplified numbers are huge, also show a decimal approximation
  if (rw > 50 || rh > 50) {
    return `≈ ${(w / h).toFixed(2)} : 1`;
  }
  return `${rw} : ${rh}`;
}

/** Greatest common divisor (Euclidean algorithm) */
function gcd(a, b) {
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

/** Format byte count to human-readable string */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// =============================================================================
// EXPORT NAME — LIVE PREVIEW
// =============================================================================

/**
 * Returns the sanitized export name from the input field.
 * Falls back to "poster" if the field is empty.
 */
function getExportName() {
  const raw = exportNameInput.value.trim();
  return raw.length > 0 ? sanitize(raw) : 'poster';
}

/** Updates the live filename preview below the input using the first ratio of the current orientation. */
function updateExportNamePreview() {
  const name = getExportName();
  const firstSize = RATIO_GROUPS[0][currentOrientation];

  // Show extension based on selected formats
  const wantPng = formatPngCheckbox && formatPngCheckbox.checked;
  const wantJpeg = formatJpegCheckbox && formatJpegCheckbox.checked;
  let ext = '.png';
  if (wantJpeg && !wantPng) ext = '.jpg';
  else if (wantJpeg && wantPng) ext = '.png / .jpg';

  exportNamePreview.textContent = `${name}_${firstSize.filelabel}${ext}`;
}

// Update preview as the user types
exportNameInput.addEventListener('input', updateExportNamePreview);

// Update preview when format checkboxes change
if (formatPngCheckbox) formatPngCheckbox.addEventListener('change', updateExportNamePreview);
if (formatJpegCheckbox) formatJpegCheckbox.addEventListener('change', updateExportNamePreview);

// =============================================================================
// CLEAR / REMOVE IMAGE
// =============================================================================

clearBtn.addEventListener('click', () => {
  // Revoke any lingering object URL
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  loadedImage = null;
  originalName = '';
  detectedOrientation = null;
  fileInput.value = '';
  exportNameInput.value = '';
  updateExportNamePreview();

  imageInfoSection.classList.add('hidden');
  exportSection.classList.add('hidden');
  uploadSection.classList.remove('hidden');
  orientationWarning.classList.add('hidden');

  // Clear any previous skipped-size warnings
  displaySkippedWarnings([]);

  // Hide crop preview thumbnails
  updateCropPreviews();
});

// =============================================================================
// ORIENTATION TABS — PORTRAIT / LANDSCAPE
// =============================================================================

/**
 * Switches the active orientation, re-renders the ratio cards,
 * and shows a warning if the user picks the opposite of what
 * the source image naturally supports.
 *
 * @param {'portrait'|'landscape'} orientation
 */
function setOrientation(orientation) {
  currentOrientation = orientation;

  // Update tab visuals
  tabPortrait.classList.toggle('orientation-tab--active', orientation === 'portrait');
  tabLandscape.classList.toggle('orientation-tab--active', orientation === 'landscape');

  // Re-render ratio cards for this orientation
  renderRatioCards(orientation);

  // Show/hide orientation mismatch warning
  if (detectedOrientation && orientation !== detectedOrientation) {
    orientationWarnText.textContent =
      `Your image is ${detectedOrientation}-oriented. ` +
      `${capitalize(orientation)} sizes may require upscaling, which can reduce print quality.`;
    orientationWarning.classList.remove('hidden');
  } else {
    orientationWarning.classList.add('hidden');
  }

  // Clear any previous skipped warnings when switching tabs
  displaySkippedWarnings([]);

  // Update the export name preview to reflect the new orientation
  updateExportNamePreview();
}

/** Capitalize first letter */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Tab click handlers
tabPortrait.addEventListener('click', () => setOrientation('portrait'));
tabLandscape.addEventListener('click', () => setOrientation('landscape'));

// =============================================================================
// DYNAMIC RATIO CARD RENDERING
// =============================================================================

/**
 * Renders the ratio cards into the grid for the given orientation.
 * Each RATIO_GROUP produces one card showing the portrait OR landscape size.
 * All cards start checked.
 *
 * @param {'portrait'|'landscape'} orientation
 */
function renderRatioCards(orientation) {
  ratioGrid.innerHTML = '';

  const checkSvg = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>';

  for (const group of RATIO_GROUPS) {
    const size = group[orientation]; // portrait or landscape object
    const tag = orientation === 'portrait' ? 'Portrait' : 'Landscape';
    const tagClass = orientation === 'portrait' ? 'ratio-card__tag--portrait' : 'ratio-card__tag--landscape';

    const card = document.createElement('label');
    card.className = 'ratio-card';
    card.dataset.fitMode = 'crop'; // default mode
    card.dataset.matPercent = '5'; // default mat border percentage
    card.dataset.bgColor = '#000000'; // default background color for fit/mat
    card.innerHTML =
      `<input type="checkbox" name="ratio" value="${group.id}" checked>` +
      `<div class="ratio-card__body">` +
        `<div class="ratio-card__check">${checkSvg}</div>` +
        `<div class="ratio-card__preview hidden"><canvas data-group-id="${group.id}"></canvas></div>` +
        `<div class="ratio-card__info">` +
          `<span class="ratio-card__group-label">${group.groupLabel}</span>` +
          `<span class="ratio-card__name">${size.name}</span>` +
          `<span class="ratio-card__desc">${size.desc}</span>` +
        `</div>` +
        `<div class="ratio-card__mode">` +
          `<button type="button" class="mode-btn mode-btn--active" data-mode="crop">Crop</button>` +
          `<button type="button" class="mode-btn" data-mode="fit">Fit</button>` +
          `<button type="button" class="mode-btn" data-mode="mat">Mat</button>` +
        `</div>` +
        `<div class="ratio-card__fit-options hidden" data-fit-options>` +
          `<div class="ratio-card__mat-slider hidden" data-mat-control>` +
            `<label class="mat-slider-label">Mat: <span class="mat-value">5</span>%</label>` +
            `<input type="range" min="1" max="20" value="5" class="mat-range">` +
          `</div>` +
          `<div class="ratio-card__color-pick">` +
            `<label class="color-pick-label">BG:</label>` +
            `<input type="color" value="#000000" class="color-swatch">` +
          `</div>` +
        `</div>` +
        `<span class="ratio-card__tag ${tagClass}">${tag}</span>` +
      `</div>`;

    // Attach mode toggle listeners (must stop propagation to avoid toggling checkbox)
    card.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const mode = btn.dataset.mode;
        card.dataset.fitMode = mode;

        // Toggle active class between the two buttons
        card.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('mode-btn--active'));
        btn.classList.add('mode-btn--active');

        // Show/hide fit-options (color picker + mat slider) based on mode
        const fitOptions = card.querySelector('.ratio-card__fit-options');
        const matSlider = card.querySelector('.ratio-card__mat-slider');
        if (fitOptions) {
          fitOptions.classList.toggle('hidden', mode === 'crop');
        }
        if (matSlider) {
          matSlider.classList.toggle('hidden', mode !== 'mat');
        }

        // Update this card's crop preview
        if (loadedImage) {
          const canvas = card.querySelector('.ratio-card__preview canvas');
          const grp = RATIO_GROUPS.find(g => g.id === group.id);
          if (grp) {
            const sz = grp[currentOrientation];
            renderCropPreview(canvas, loadedImage, sz.width, sz.height, mode, card);
          }
        }
      });
    });

    // Attach mat slider input listener
    const matRange = card.querySelector('.mat-range');
    const matValueLabel = card.querySelector('.mat-value');
    if (matRange) {
      matRange.addEventListener('input', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const val = matRange.value;
        card.dataset.matPercent = val;
        if (matValueLabel) matValueLabel.textContent = val;

        // Re-render this card's crop preview with the new mat size
        if (loadedImage) {
          const canvas = card.querySelector('.ratio-card__preview canvas');
          const grp = RATIO_GROUPS.find(g => g.id === group.id);
          if (grp) {
            const sz = grp[currentOrientation];
            renderCropPreview(canvas, loadedImage, sz.width, sz.height, 'mat', card);
          }
        }
      });
      // Prevent checkbox toggle when interacting with the slider
      matRange.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Attach color swatch input listener
    const colorSwatch = card.querySelector('.color-swatch');
    if (colorSwatch) {
      colorSwatch.addEventListener('input', (e) => {
        e.stopPropagation();
        card.dataset.bgColor = colorSwatch.value;

        // Re-render this card's crop preview with the new color
        if (loadedImage) {
          const canvas = card.querySelector('.ratio-card__preview canvas');
          const grp = RATIO_GROUPS.find(g => g.id === group.id);
          if (grp) {
            const sz = grp[currentOrientation];
            renderCropPreview(canvas, loadedImage, sz.width, sz.height, card.dataset.fitMode, card);
          }
        }

        // If lightbox is open for this card, re-render the lightbox preview too
        if (lightboxSourceCard === card && lightboxContext && loadedImage) {
          lightboxContext.bgColor = colorSwatch.value;
          const lbColorInput = document.getElementById('lightboxColorInput');
          if (lbColorInput) lbColorInput.value = colorSwatch.value;
          renderLightboxPreview(
            lightboxCanvas, loadedImage,
            lightboxContext.targetW, lightboxContext.targetH,
            lightboxContext.mode, lightboxContext.matPercent, colorSwatch.value
          );
        }
      });
      colorSwatch.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Attach click listener to thumbnail to open lightbox
    const previewEl = card.querySelector('.ratio-card__preview');
    if (previewEl) {
      previewEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!loadedImage) return;
        openLightbox(card, group);
      });
    }

    ratioGrid.appendChild(card);
  }

  // Draw crop previews if an image is loaded
  updateCropPreviews();
}

// =============================================================================
// CROP PREVIEW THUMBNAILS
// =============================================================================

/**
 * Updates crop preview thumbnails on every ratio card.
 * If no image is loaded, hides all preview containers.
 * Called automatically at the end of renderRatioCards().
 */
function updateCropPreviews() {
  const previews = ratioGrid.querySelectorAll('.ratio-card__preview');

  if (!loadedImage) {
    previews.forEach(p => p.classList.add('hidden'));
    return;
  }

  previews.forEach(p => {
    p.classList.remove('hidden');
    const canvas = p.querySelector('canvas');
    const groupId = canvas.dataset.groupId;
    const group = RATIO_GROUPS.find(g => g.id === groupId);
    if (!group) return;

    // Read the per-card mode from the parent .ratio-card element
    const card = p.closest('.ratio-card');
    const mode = card ? (card.dataset.fitMode || 'crop') : 'crop';

    const size = group[currentOrientation];
    renderCropPreview(canvas, loadedImage, size.width, size.height, mode, card);
  });
}

/**
 * Draws a crop preview thumbnail onto a small canvas.
 *
 * In "crop" mode: shows the full source image dimmed, with the center-crop
 * region at full brightness so the user can see what will be kept vs. cut.
 *
 * In "fit" mode: shows a black canvas at the target aspect ratio with the
 * full image fitted inside (letterboxed/pillarboxed), matching the actual
 * export output.
 *
 * @param {HTMLCanvasElement} canvas  – the card's preview canvas
 * @param {HTMLImageElement} img      – source image
 * @param {number} targetW           – target output width (px)
 * @param {number} targetH           – target output height (px)
 * @param {'crop'|'fit'|'mat'} [mode='crop'] – rendering mode
 * @param {HTMLElement} [card]       – parent ratio-card element (used to read mat percentage)
 */
function renderCropPreview(canvas, img, targetW, targetH, mode, card) {
  mode = mode || 'crop';
  const maxDim = 48;
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  // Read background color from the card (for fit/mat modes)
  const bgColor = card?.dataset.bgColor || '#000000';

  if (mode === 'fit') {
    // === FIT MODE ===
    // Canvas matches the target aspect ratio, scaled to fit maxDim
    const tScale = Math.min(maxDim / targetW, maxDim / targetH);
    const cw = Math.round(targetW * tScale);
    const ch = Math.round(targetH * tScale);

    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    // Background color (user-configurable)
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);

    // Scale source image to fit within the canvas
    const fitScale = Math.min(cw / srcW, ch / srcH);
    const drawW = Math.round(srcW * fitScale);
    const drawH = Math.round(srcH * fitScale);
    const drawX = Math.round((cw - drawW) / 2);
    const drawY = Math.round((ch - drawH) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, srcW, srcH, drawX, drawY, drawW, drawH);

    // Subtle border around the image area
    ctx.strokeStyle = 'rgba(74, 158, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX + 0.5, drawY + 0.5, drawW - 1, drawH - 1);

  } else if (mode === 'mat') {
    // === MAT MODE ===
    // Canvas matches the target aspect ratio, with uniform border on all 4 sides
    const tScale = Math.min(maxDim / targetW, maxDim / targetH);
    const cw = Math.round(targetW * tScale);
    const ch = Math.round(targetH * tScale);

    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    // Background color (user-configurable)
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);

    // Compute mat inset (user-configurable percentage of shorter canvas dimension)
    const matPct = parseFloat(card?.dataset.matPercent || '5') / 100;
    const matSize = Math.round(Math.min(cw, ch) * matPct);
    const innerW = cw - 2 * matSize;
    const innerH = ch - 2 * matSize;

    // Scale source image to fit within the inner area
    const fitScale = Math.min(innerW / srcW, innerH / srcH);
    const drawW = Math.round(srcW * fitScale);
    const drawH = Math.round(srcH * fitScale);
    const drawX = Math.round((cw - drawW) / 2);
    const drawY = Math.round((ch - drawH) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, srcW, srcH, drawX, drawY, drawW, drawH);

    // Subtle border around the image area
    ctx.strokeStyle = 'rgba(74, 158, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX + 0.5, drawY + 0.5, drawW - 1, drawH - 1);

  } else {
    // === CROP MODE (default) ===
    const scale = Math.min(maxDim / srcW, maxDim / srcH);
    const cw = Math.round(srcW * scale);
    const ch = Math.round(srcH * scale);

    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    // 1. Draw full image dimmed
    ctx.globalAlpha = 0.25;
    ctx.drawImage(img, 0, 0, cw, ch);

    // 2. Compute the center-crop region (same logic as cropAndResize)
    const targetRatio = targetW / targetH;
    const srcRatio = srcW / srcH;

    let cropX, cropY, cropW, cropH;
    if (srcRatio > targetRatio) {
      cropH = srcH;
      cropW = Math.round(srcH * targetRatio);
      cropX = Math.round((srcW - cropW) / 2);
      cropY = 0;
    } else {
      cropW = srcW;
      cropH = Math.round(srcW / targetRatio);
      cropX = 0;
      cropY = Math.round((srcH - cropH) / 2);
    }

    // Scale crop region to canvas coordinates
    const cx = Math.round(cropX * scale);
    const cy = Math.round(cropY * scale);
    const ccw = Math.round(cropW * scale);
    const cch = Math.round(cropH * scale);

    // 3. Draw the kept crop region at full brightness
    ctx.globalAlpha = 1.0;
    ctx.drawImage(img, cropX, cropY, cropW, cropH, cx, cy, ccw, cch);

    // 4. Subtle border around the crop region for clarity
    ctx.strokeStyle = 'rgba(74, 158, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, cy + 0.5, ccw - 1, cch - 1);
  }
}

// =============================================================================
// SELECT ALL / DESELECT ALL
// =============================================================================

selectAllBtn.addEventListener('click', () => {
  ratioGrid.querySelectorAll('input[name="ratio"]').forEach(cb => cb.checked = true);
});

deselectAllBtn.addEventListener('click', () => {
  ratioGrid.querySelectorAll('input[name="ratio"]').forEach(cb => cb.checked = false);
});

// =============================================================================
// EXPORT — CROP, RESIZE & ZIP
// =============================================================================

exportBtn.addEventListener('click', async () => {
  if (!loadedImage) return;

  // Verify JSZip loaded from CDN
  if (typeof JSZip === 'undefined') {
    alert('Export library (JSZip) failed to load.\n\nPlease check your internet connection and refresh the page.');
    return;
  }

  // Determine which formats are selected
  const wantPng = formatPngCheckbox.checked;
  const wantJpeg = formatJpegCheckbox.checked;

  if (!wantPng && !wantJpeg) {
    alert('Please select at least one export format (PNG or JPEG).');
    return;
  }

  // Build the list of formats to export
  const formats = [];
  if (wantPng) formats.push('png');
  if (wantJpeg) formats.push('jpeg');

  // Gather selected ratios for the current orientation
  const selected = getSelectedRatios();
  if (selected.length === 0) {
    alert('Please select at least one output ratio.');
    return;
  }

  // =========================================================================
  // QUALITY GATE — separate selected ratios into allowed (downscale/equal)
  // and skipped (would require upscaling).
  // =========================================================================
  const allowed = [];
  const skipped = [];

  for (const ratio of selected) {
    if (ratio.mode === 'fit' || ratio.mode === 'mat') {
      // Fit/Mat mode: upscaling occurs only when the source is smaller than
      // the target in both dimensions (i.e. the fit scale > 1).
      const fitScale = Math.min(ratio.width / loadedImage.naturalWidth, ratio.height / loadedImage.naturalHeight);
      if (fitScale > 1) {
        skipped.push({
          ...ratio,
          sourceW: loadedImage.naturalWidth,
          sourceH: loadedImage.naturalHeight,
        });
      } else {
        allowed.push(ratio);
      }
    } else {
      // Crop mode: existing logic
      const check = wouldUpscale(loadedImage, ratio.width, ratio.height);
      if (check.upscale) {
        skipped.push({
          ...ratio,
          sourceW: check.cropW,
          sourceH: check.cropH,
        });
      } else {
        allowed.push(ratio);
      }
    }
  }

  // Show skipped-size warnings in the UI (always update, even if empty)
  displaySkippedWarnings(skipped);

  // If every selected ratio was skipped, alert and bail out
  if (allowed.length === 0) {
    alert(
      'None of the selected sizes can be generated without upscaling.\n' +
      'Your source image is too small for every checked ratio.\n' +
      'See the warnings below for details.'
    );
    return;
  }

  // Total number of files = ratios × formats
  const totalFiles = allowed.length * formats.length;

  // Prevent double-clicks during export
  exportBtn.disabled = true;

  // Show progress overlay
  showProgress(true);
  updateProgress(0, `Starting export (${totalFiles} file${totalFiles > 1 ? 's' : ''})…`);

  try {
    const zip = new JSZip();
    const exportName = getExportName();
    let fileIndex = 0;

    for (let i = 0; i < allowed.length; i++) {
      const ratio = allowed[i];

      for (const fmt of formats) {
        const pct = Math.round((fileIndex / totalFiles) * 90); // 0–90% for rendering
        const fmtLabel = fmt.toUpperCase();
        updateProgress(pct, `Processing ${ratio.label} ${fmtLabel} (${ratio.width}×${ratio.height})…`);

        // Give the UI a chance to repaint
        await sleep(30);

        // Branch on mode: crop / fit / mat — passing format through
        let blob;
        if (ratio.mode === 'mat') {
          blob = await matAndPad(loadedImage, ratio.width, ratio.height, ratio.matPercent, ratio.bgColor, fmt);
        } else if (ratio.mode === 'fit') {
          blob = await fitAndPad(loadedImage, ratio.width, ratio.height, ratio.bgColor, fmt);
        } else {
          blob = await cropAndResize(loadedImage, ratio.width, ratio.height, fmt);
        }

        // Build filename — append mode suffix for non-crop exports
        const modeSuffix = ratio.mode === 'fit' ? '_fit' : ratio.mode === 'mat' ? '_mat' : '';
        const ext = fmt === 'jpeg' ? '.jpg' : '.png';
        const filename = `${exportName}_${ratio.filelabel}${modeSuffix}${ext}`;
        zip.file(filename, blob);

        fileIndex++;
      }
    }

    updateProgress(90, 'Creating ZIP archive…');
    await sleep(30);

    // Generate the ZIP
    const zipBlob = await zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
      (meta) => {
        const zipPct = 90 + Math.round(meta.percent * 0.1);
        updateProgress(zipPct, 'Compressing ZIP…');
      }
    );

    // Trigger download — ZIP uses the same custom export name
    downloadBlob(zipBlob, `${exportName}_posters.zip`);
    updateProgress(100, 'Done!');
    await sleep(600);

  } catch (err) {
    console.error('Export error:', err);
    alert(`Something went wrong during export.\n\n${err.message || 'Unknown error — check the browser console for details.'}`);
  } finally {
    showProgress(false);
    exportBtn.disabled = false;
  }
});

/**
 * Returns the ratio size objects for all checked cards in the current orientation.
 * Each returned object has: label, filelabel, width, height, mode (from the active orientation).
 * The `mode` field is 'crop' or 'fit', read from the card's data-fit-mode attribute.
 * @returns {Array}
 */
function getSelectedRatios() {
  const checked = Array.from(ratioGrid.querySelectorAll('input[name="ratio"]:checked'));
  return checked.map(cb => {
    const groupId = cb.value;
    const group = RATIO_GROUPS.find(g => g.id === groupId);
    if (!group) return null;
    const card = cb.closest('.ratio-card');
    const mode = card ? (card.dataset.fitMode || 'crop') : 'crop';
    const matPercent = parseFloat(card?.dataset.matPercent || '5');
    const bgColor = card?.dataset.bgColor || '#000000';
    return { ...group[currentOrientation], mode, matPercent, bgColor };
  }).filter(Boolean);
}

// =============================================================================
// QUALITY CHECK — UPSCALE DETECTION
// =============================================================================

/**
 * Determines whether generating a target size would require upscaling.
 *
 * How it works:
 *   1. Compute the center-crop region that matches the target aspect ratio.
 *   2. Compare the cropped region's pixel dimensions to the target output.
 *   3. If the crop region is SMALLER than the target in either axis,
 *      the image would need to be enlarged → quality loss → not allowed.
 *
 * Cropping itself is NOT considered quality loss — only enlargement is.
 *
 * @param {HTMLImageElement} img   – source image
 * @param {number} targetW        – desired output width (px)
 * @param {number} targetH        – desired output height (px)
 * @returns {{ upscale: boolean, cropW: number, cropH: number }}
 */
function wouldUpscale(img, targetW, targetH) {
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const targetRatio = targetW / targetH;
  const srcRatio = srcW / srcH;

  let cropW, cropH;

  if (srcRatio > targetRatio) {
    // Source is wider than target ratio → crop sides, full height kept
    cropH = srcH;
    cropW = Math.round(srcH * targetRatio);
  } else {
    // Source is taller than target ratio → crop top/bottom, full width kept
    cropW = srcW;
    cropH = Math.round(srcW / targetRatio);
  }

  // If the usable (cropped) pixels are fewer than what the target demands,
  // we would have to stretch/upscale → quality loss.
  const upscale = cropW < targetW || cropH < targetH;

  return { upscale, cropW, cropH };
}

// =============================================================================
// CANVAS — CENTER CROP & RESIZE
// =============================================================================

/**
 * Center-crops the source image to match the target aspect ratio,
 * then resizes to the exact target dimensions.
 *
 * IMPORTANT: This function should only be called after passing the
 * wouldUpscale() check. It assumes the source is large enough so that
 * only downscaling (or 1:1) is performed — never upscaling.
 *
 * @param {HTMLImageElement} img        – source image
 * @param {number} targetW             – desired output width (px)
 * @param {number} targetH             – desired output height (px)
 * @param {'png'|'jpeg'} [format='png'] – output format
 * @param {number} [jpegQuality=0.92]   – JPEG quality (0–1), ignored for PNG
 * @returns {Promise<Blob>}            – image blob of the result
 */
function cropAndResize(img, targetW, targetH, format = 'png', jpegQuality = 0.92) {
  return new Promise((resolve, reject) => {
    try {
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const targetRatio = targetW / targetH;
      const srcRatio = srcW / srcH;

      let cropW, cropH, cropX, cropY;

      if (srcRatio > targetRatio) {
        // Source is wider → crop sides, keep full height
        cropH = srcH;
        cropW = Math.round(srcH * targetRatio);
        cropX = Math.round((srcW - cropW) / 2);
        cropY = 0;
      } else {
        // Source is taller → crop top & bottom, keep full width
        cropW = srcW;
        cropH = Math.round(srcW / targetRatio);
        cropX = 0;
        cropY = Math.round((srcH - cropH) / 2);
      }

      // Create an offscreen canvas at the exact target dimensions
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      // High-quality resampling for downscaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw the center-cropped region, scaled down to fill the canvas
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

      // Export as blob with DPI metadata
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const blobArgs = format === 'jpeg' ? [mimeType, jpegQuality] : [mimeType];

      canvas.toBlob(
        async (blob) => {
          try {
            if (!blob) { reject(new Error(`Failed to generate ${targetW}×${targetH} image — your device may not support this canvas size. Try a smaller poster ratio.`)); return; }
            const dpiBlob = format === 'jpeg'
              ? await embedJpegDpi(blob, 300)
              : await embedPngDpi(blob, 300);
            resolve(dpiBlob);
          } catch (e) {
            reject(e);
          }
        },
        ...blobArgs
      );
    } catch (err) {
      reject(err);
    }
  });
}

// =============================================================================
// CANVAS — FIT & PAD (NO CROP)
// =============================================================================

/**
 * Scales the source image to fit entirely within the target dimensions,
 * then centers it on a black canvas. Nothing is cropped — the remaining
 * space is filled with black (letterbox / pillarbox).
 *
 * @param {HTMLImageElement} img        – source image
 * @param {number} targetW             – desired output width (px)
 * @param {number} targetH             – desired output height (px)
 * @param {string} [bgColor='#000000'] – background fill color
 * @param {'png'|'jpeg'} [format='png'] – output format
 * @param {number} [jpegQuality=0.92]   – JPEG quality (0–1), ignored for PNG
 * @returns {Promise<Blob>}            – image blob of the result
 */
function fitAndPad(img, targetW, targetH, bgColor = '#000000', format = 'png', jpegQuality = 0.92) {
  return new Promise((resolve, reject) => {
    try {
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;

      // Create canvas at exact target dimensions
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      // Fill with background color
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, targetW, targetH);

      // Scale image to fit entirely within the canvas
      const scale = Math.min(targetW / srcW, targetH / srcH);
      const drawW = Math.round(srcW * scale);
      const drawH = Math.round(srcH * scale);

      // Center the image
      const drawX = Math.round((targetW - drawW) / 2);
      const drawY = Math.round((targetH - drawH) / 2);

      // High-quality resampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(img, 0, 0, srcW, srcH, drawX, drawY, drawW, drawH);

      // Export as blob with DPI metadata
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const blobArgs = format === 'jpeg' ? [mimeType, jpegQuality] : [mimeType];

      canvas.toBlob(
        async (blob) => {
          try {
            if (!blob) { reject(new Error(`Failed to generate ${targetW}×${targetH} image — your device may not support this canvas size. Try a smaller poster ratio.`)); return; }
            const dpiBlob = format === 'jpeg'
              ? await embedJpegDpi(blob, 300)
              : await embedPngDpi(blob, 300);
            resolve(dpiBlob);
          } catch (e) {
            reject(e);
          }
        },
        ...blobArgs
      );
    } catch (err) {
      reject(err);
    }
  });
}

// =============================================================================
// CANVAS — MAT & PAD (UNIFORM BORDER, NO CROP)
// =============================================================================

/**
 * Scales the source image to fit within a reduced inner area, then centers
 * it on a black canvas with a uniform border (mat) on all 4 sides.
 * Nothing is cropped — the mat creates a gallery-style framed look.
 *
 * The mat width defaults to 5% of the target's shorter edge but can be
 * customized via the matPercent parameter (1–20).
 *
 * @param {HTMLImageElement} img        – source image
 * @param {number} targetW             – desired output width (px)
 * @param {number} targetH             – desired output height (px)
 * @param {number} [matPercent=5]       – mat border as a percentage of the shorter edge
 * @param {string} [bgColor='#000000'] – background fill color
 * @param {'png'|'jpeg'} [format='png'] – output format
 * @param {number} [jpegQuality=0.92]   – JPEG quality (0–1), ignored for PNG
 * @returns {Promise<Blob>}            – image blob of the result
 */
function matAndPad(img, targetW, targetH, matPercent = 5, bgColor = '#000000', format = 'png', jpegQuality = 0.92) {
  return new Promise((resolve, reject) => {
    try {
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;

      // Create canvas at exact target dimensions
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      // Fill with background color
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, targetW, targetH);

      // Compute uniform mat border (user-configurable percentage of shorter edge)
      const matSize = Math.round(Math.min(targetW, targetH) * (matPercent / 100));

      // Inner area after subtracting mat on all sides
      const innerW = targetW - 2 * matSize;
      const innerH = targetH - 2 * matSize;

      // Scale image to fit within the inner area
      const scale = Math.min(innerW / srcW, innerH / srcH);
      const drawW = Math.round(srcW * scale);
      const drawH = Math.round(srcH * scale);

      // Center the image within the canvas
      const drawX = Math.round((targetW - drawW) / 2);
      const drawY = Math.round((targetH - drawH) / 2);

      // High-quality resampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(img, 0, 0, srcW, srcH, drawX, drawY, drawW, drawH);

      // Export as blob with DPI metadata
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const blobArgs = format === 'jpeg' ? [mimeType, jpegQuality] : [mimeType];

      canvas.toBlob(
        async (blob) => {
          try {
            if (!blob) { reject(new Error(`Failed to generate ${targetW}×${targetH} image — your device may not support this canvas size. Try a smaller poster ratio.`)); return; }
            const dpiBlob = format === 'jpeg'
              ? await embedJpegDpi(blob, 300)
              : await embedPngDpi(blob, 300);
            resolve(dpiBlob);
          } catch (e) {
            reject(e);
          }
        },
        ...blobArgs
      );
    } catch (err) {
      reject(err);
    }
  });
}

// =============================================================================
// PNG DPI METADATA — pHYs CHUNK INJECTION
// =============================================================================

/**
 * Embeds DPI metadata into a PNG blob by injecting a pHYs chunk.
 *
 * PNG files store resolution in a "pHYs" (physical pixel dimensions) chunk
 * as pixels-per-METER. We convert DPI → pixels/meter (DPI × 39.3701).
 *
 * The pHYs chunk must appear before the first IDAT chunk. This function:
 *   1. Reads the raw PNG bytes
 *   2. Finds the insertion point (just before the first IDAT)
 *   3. Builds a valid pHYs chunk with CRC32
 *   4. Splices it in and returns a new Blob
 *
 * @param {Blob} pngBlob  – original PNG blob from canvas.toBlob()
 * @param {number} dpi    – desired DPI (e.g. 300)
 * @returns {Promise<Blob>}
 */
async function embedPngDpi(pngBlob, dpi) {
  const buf = await pngBlob.arrayBuffer();
  const data = new Uint8Array(buf);

  // Convert DPI to pixels per meter (1 inch = 0.0254 m)
  const ppm = Math.round(dpi / 0.0254); // 300 DPI → 11811 ppm

  // Find insertion point: scan chunks to locate the first IDAT
  // PNG structure: 8-byte signature, then chunks (4-byte length, 4-byte type, data, 4-byte CRC)
  let offset = 8; // skip PNG signature
  let insertAt = -1;

  while (offset < data.length) {
    const chunkLen = readUint32(data, offset);
    const chunkType = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);

    if (chunkType === 'IDAT') {
      insertAt = offset; // insert pHYs right before the first IDAT
      break;
    }

    // Move past this chunk: 4 (length) + 4 (type) + data + 4 (CRC)
    offset += 12 + chunkLen;
  }

  // If no IDAT found (shouldn't happen), return original
  if (insertAt === -1) return pngBlob;

  // Build the pHYs chunk (9 bytes of data)
  const phys = buildPhysChunk(ppm, ppm);

  // Splice: [before IDAT] + [pHYs chunk] + [IDAT onwards]
  const before = data.slice(0, insertAt);
  const after = data.slice(insertAt);
  const result = new Uint8Array(before.length + phys.length + after.length);
  result.set(before, 0);
  result.set(phys, before.length);
  result.set(after, before.length + phys.length);

  return new Blob([result], { type: 'image/png' });
}

/**
 * Builds a complete PNG pHYs chunk (21 bytes total).
 *
 * Layout:
 *   4 bytes — data length (always 9)
 *   4 bytes — chunk type ("pHYs")
 *   4 bytes — pixels per unit, X axis
 *   4 bytes — pixels per unit, Y axis
 *   1 byte  — unit (1 = meter)
 *   4 bytes — CRC32 of type + data
 *   ──────── = 4 + 4 + 9 + 4 = 21 bytes
 *
 * @param {number} ppmX – pixels per meter, X
 * @param {number} ppmY – pixels per meter, Y
 * @returns {Uint8Array}
 */
function buildPhysChunk(ppmX, ppmY) {
  const chunk = new Uint8Array(21); // 4 (len) + 4 (type) + 9 (data) + 4 (CRC)
  const view = new DataView(chunk.buffer);

  // Length of data section = 9
  view.setUint32(0, 9);

  // Chunk type: "pHYs"
  chunk[4] = 0x70; // p
  chunk[5] = 0x48; // H
  chunk[6] = 0x59; // Y
  chunk[7] = 0x73; // s

  // Pixels per unit X
  view.setUint32(8, ppmX);

  // Pixels per unit Y
  view.setUint32(12, ppmY);

  // Unit specifier: 1 = meter
  chunk[16] = 1;

  // CRC32 over type + data (bytes 4–16, inclusive = 13 bytes)
  const crc = crc32Png(chunk.slice(4, 17));
  view.setUint32(17, crc);

  return chunk;
}

/** Read a big-endian uint32 from a Uint8Array at the given offset. */
function readUint32(data, offset) {
  return (
    (data[offset]     << 24) |
    (data[offset + 1] << 16) |
    (data[offset + 2] << 8)  |
     data[offset + 3]
  ) >>> 0; // >>> 0 ensures unsigned
}

/**
 * CRC32 used by PNG (ISO 3309 / ITU-T V.42).
 * Polynomial: 0xEDB88320 (reflected).
 *
 * @param {Uint8Array} bytes
 * @returns {number}
 */
function crc32Png(bytes) {
  // Build table on first call, then cache
  if (!crc32Png._table) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    crc32Png._table = table;
  }

  const table = crc32Png._table;
  let crc = 0xFFFFFFFF;

  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// =============================================================================
// JPEG DPI METADATA — JFIF HEADER PATCHING
// =============================================================================

/**
 * Embeds DPI metadata into a JPEG blob by patching the JFIF header.
 *
 * JPEG files from canvas.toBlob() include a JFIF APP0 segment with density
 * fields at fixed byte offsets:
 *   Byte 13: density units (0=no units, 1=dots per inch, 2=dots per cm)
 *   Bytes 14-15: X density (big-endian uint16)
 *   Bytes 16-17: Y density (big-endian uint16)
 *
 * This function patches those 5 bytes to set the desired DPI.
 *
 * @param {Blob} jpegBlob  – original JPEG blob from canvas.toBlob()
 * @param {number} dpi     – desired DPI (e.g. 300)
 * @returns {Promise<Blob>}
 */
async function embedJpegDpi(jpegBlob, dpi) {
  const buf = await jpegBlob.arrayBuffer();
  const data = new Uint8Array(buf);

  // Verify this is a JPEG with a JFIF header:
  // SOI (FF D8) + APP0 marker (FF E0) + ... + "JFIF\0" at bytes 6-10
  if (data.length < 18 ||
      data[0] !== 0xFF || data[1] !== 0xD8 ||
      data[2] !== 0xFF || data[3] !== 0xE0) {
    // Not a standard JFIF — return as-is
    return jpegBlob;
  }

  // Check for "JFIF\0" identifier
  const jfifId = String.fromCharCode(data[6], data[7], data[8], data[9]);
  if (jfifId !== 'JFIF') {
    return jpegBlob;
  }

  // Patch density fields
  data[13] = 1; // units = dots per inch

  // X density (big-endian uint16)
  data[14] = (dpi >> 8) & 0xFF;
  data[15] = dpi & 0xFF;

  // Y density (big-endian uint16)
  data[16] = (dpi >> 8) & 0xFF;
  data[17] = dpi & 0xFF;

  return new Blob([data], { type: 'image/jpeg' });
}

// =============================================================================
// SKIPPED-SIZE WARNINGS — UI
// =============================================================================

/**
 * Renders the list of skipped (too-small) ratios into the warning panel.
 * If the array is empty, hides the panel.
 *
 * @param {Array} skippedList – objects with { label, width, height, sourceW, sourceH }
 */
function displaySkippedWarnings(skippedList) {
  const container = document.getElementById('skippedWarnings');
  const list = document.getElementById('skippedList');

  if (!container || !list) return;

  // Clear previous warnings
  list.innerHTML = '';

  if (skippedList.length === 0) {
    container.classList.add('hidden');
    return;
  }

  // Build a warning item for each skipped ratio
  for (const item of skippedList) {
    const li = document.createElement('li');
    li.className = 'skipped-item';
    li.innerHTML =
      `<svg class="skipped-item__icon" viewBox="0 0 16 16" fill="currentColor">` +
        `<path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>` +
      `</svg>` +
      `<span class="skipped-item__text">` +
        `<strong>${item.label}</strong> — The source image is smaller than ` +
        `${item.width.toLocaleString()} × ${item.height.toLocaleString()} px. ` +
        `This size was skipped to avoid quality loss. ` +
        `<span class="skipped-item__detail">(usable crop: ${item.sourceW.toLocaleString()} × ${item.sourceH.toLocaleString()} px)</span>` +
      `</span>`;
    list.appendChild(li);
  }

  container.classList.remove('hidden');
}

// =============================================================================
// UTILITY HELPERS
// =============================================================================

/**
 * Sanitize a string for safe use in a filename.
 * Keeps letters, digits, hyphens, underscores; replaces the rest with underscores.
 * @param {string} name
 * @returns {string}
 */
function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_{2,}/g, '_');
}

/**
 * Shows a dismissible toast notification at the top of the viewport.
 *
 * @param {string} message  – text to display
 * @param {number} [duration=5000] – auto-dismiss delay in ms
 */
function showToast(message, duration = 5000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML =
    `<svg class="toast__icon" viewBox="0 0 16 16" fill="currentColor">` +
      `<path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM8 4a.905.905 0 0 1 .9.995l-.35 3.507a.553.553 0 0 1-1.1 0L7.1 4.995A.905.905 0 0 1 8 4zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>` +
    `</svg>` +
    `<span class="toast__message">${message}</span>` +
    `<button class="toast__close" type="button" aria-label="Dismiss">&times;</button>`;

  /** Remove the toast with a slide-out animation */
  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(autoTimer);
    toast.classList.add('toast--dismissing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  toast.querySelector('.toast__close').addEventListener('click', dismiss);

  container.appendChild(toast);

  const autoTimer = setTimeout(dismiss, duration);
}

/** Trigger a browser download for a Blob */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Promise-based setTimeout */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// =============================================================================
// PROGRESS UI
// =============================================================================

/** Show or hide the progress overlay */
function showProgress(visible) {
  if (visible) {
    progressOverlay.classList.remove('hidden');
  } else {
    progressOverlay.classList.add('hidden');
    updateProgress(0, 'Preparing…');
  }
}

/**
 * Update the progress bar and status text.
 * @param {number} pct   – 0–100
 * @param {string} msg   – status message
 */
function updateProgress(pct, msg) {
  progressBar.style.width = `${pct}%`;
  progressPercent.textContent = `${pct}%`;
  if (msg) progressStatus.textContent = msg;
}

// =============================================================================
// LIGHTBOX — LARGE PREVIEW MODAL
// =============================================================================

/**
 * Opens the lightbox modal for a given ratio card.
 *
 * @param {HTMLElement} card   – the .ratio-card element
 * @param {Object} group       – the RATIO_GROUPS entry
 */
function openLightbox(card, group) {
  lightboxSourceCard = card;

  const mode = card.dataset.fitMode || 'crop';
  const matPercent = parseFloat(card.dataset.matPercent || '5');
  const size = group[currentOrientation];
  const tag = currentOrientation === 'portrait' ? 'Portrait' : 'Landscape';

  const bgColor = card.dataset.bgColor || '#000000';

  // Store context for re-rendering from the lightbox slider
  lightboxContext = {
    groupId: group.id,
    targetW: size.width,
    targetH: size.height,
    mode: mode,
    matPercent: matPercent,
    bgColor: bgColor,
  };

  // Set header text
  const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
  lightboxTitle.textContent = `${group.groupLabel} ${tag} — ${modeLabel}`;

  // Set description
  lightboxDesc.textContent = `${size.name}  ·  ${size.desc}`;

  // Show/hide mat controls
  if (mode === 'mat') {
    lightboxMatControls.classList.remove('hidden');
    lightboxMatRange.value = matPercent;
    lightboxMatValue.textContent = matPercent;
  } else {
    lightboxMatControls.classList.add('hidden');
  }

  // Show/hide color control (for fit + mat modes)
  if (mode === 'fit' || mode === 'mat') {
    lightboxColorControl.classList.remove('hidden');
    lightboxColorInput.value = bgColor;
  } else {
    lightboxColorControl.classList.add('hidden');
  }

  // Render the large preview
  renderLightboxPreview(lightboxCanvas, loadedImage, size.width, size.height, mode, matPercent, bgColor);

  // Show lightbox
  previewLightbox.classList.remove('hidden');
}

/**
 * Closes the lightbox modal.
 */
function closeLightbox() {
  previewLightbox.classList.add('hidden');
  lightboxSourceCard = null;
  lightboxContext = null;
}

// Close on backdrop click
lightboxBackdrop.addEventListener('click', closeLightbox);

// Close on X button
lightboxClose.addEventListener('click', closeLightbox);

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !previewLightbox.classList.contains('hidden')) {
    closeLightbox();
  }
});

// Lightbox mat slider — live update preview + sync back to source card
lightboxMatRange.addEventListener('input', () => {
  const val = lightboxMatRange.value;
  const pct = parseFloat(val);
  lightboxMatValue.textContent = val;

  if (!lightboxContext || !loadedImage) return;

  // Update the lightbox context
  lightboxContext.matPercent = pct;

  // Re-render the large preview
  renderLightboxPreview(
    lightboxCanvas,
    loadedImage,
    lightboxContext.targetW,
    lightboxContext.targetH,
    'mat',
    pct,
    lightboxContext.bgColor || '#000000'
  );

  // Sync back to the source card
  if (lightboxSourceCard) {
    lightboxSourceCard.dataset.matPercent = val;

    // Update the card's inline slider and label
    const cardRange = lightboxSourceCard.querySelector('.mat-range');
    const cardLabel = lightboxSourceCard.querySelector('.mat-value');
    if (cardRange) cardRange.value = val;
    if (cardLabel) cardLabel.textContent = val;

    // Re-render the card's small thumbnail
    const cardCanvas = lightboxSourceCard.querySelector('.ratio-card__preview canvas');
    if (cardCanvas) {
      renderCropPreview(
        cardCanvas,
        loadedImage,
        lightboxContext.targetW,
        lightboxContext.targetH,
        'mat',
        lightboxSourceCard
      );
    }
  }
});

// Lightbox color picker — live update preview + sync back to source card
lightboxColorInput.addEventListener('input', () => {
  const color = lightboxColorInput.value;

  if (!lightboxContext || !loadedImage) return;

  // Update the lightbox context
  lightboxContext.bgColor = color;

  // Re-render the large preview
  renderLightboxPreview(
    lightboxCanvas,
    loadedImage,
    lightboxContext.targetW,
    lightboxContext.targetH,
    lightboxContext.mode,
    lightboxContext.matPercent,
    color
  );

  // Sync back to the source card
  if (lightboxSourceCard) {
    lightboxSourceCard.dataset.bgColor = color;

    // Update the card's inline color swatch
    const cardSwatch = lightboxSourceCard.querySelector('.color-swatch');
    if (cardSwatch) cardSwatch.value = color;

    // Re-render the card's small thumbnail
    const cardCanvas = lightboxSourceCard.querySelector('.ratio-card__preview canvas');
    if (cardCanvas) {
      renderCropPreview(
        cardCanvas,
        loadedImage,
        lightboxContext.targetW,
        lightboxContext.targetH,
        lightboxContext.mode,
        lightboxSourceCard
      );
    }
  }
});

/**
 * Renders a large preview onto the lightbox canvas.
 * Same rendering logic as renderCropPreview but at a much larger size (maxDim = 500).
 *
 * @param {HTMLCanvasElement} canvas   – the lightbox canvas
 * @param {HTMLImageElement} img       – source image
 * @param {number} targetW            – target output width (px)
 * @param {number} targetH            – target output height (px)
 * @param {'crop'|'fit'|'mat'} mode   – rendering mode
 * @param {number} [matPercent=5]     – mat border percentage (only used in mat mode)
 * @param {string} [bgColor='#000000'] – background color for fit/mat modes
 */
function renderLightboxPreview(canvas, img, targetW, targetH, mode, matPercent, bgColor) {
  matPercent = matPercent || 5;
  bgColor = bgColor || '#000000';
  const maxDim = 500;
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  if (mode === 'fit') {
    // === FIT MODE ===
    const tScale = Math.min(maxDim / targetW, maxDim / targetH);
    const cw = Math.round(targetW * tScale);
    const ch = Math.round(targetH * tScale);

    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);

    const fitScale = Math.min(cw / srcW, ch / srcH);
    const drawW = Math.round(srcW * fitScale);
    const drawH = Math.round(srcH * fitScale);
    const drawX = Math.round((cw - drawW) / 2);
    const drawY = Math.round((ch - drawH) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, srcW, srcH, drawX, drawY, drawW, drawH);

    ctx.strokeStyle = 'rgba(74, 158, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX + 0.5, drawY + 0.5, drawW - 1, drawH - 1);

  } else if (mode === 'mat') {
    // === MAT MODE ===
    const tScale = Math.min(maxDim / targetW, maxDim / targetH);
    const cw = Math.round(targetW * tScale);
    const ch = Math.round(targetH * tScale);

    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, cw, ch);

    const matPct = matPercent / 100;
    const matSize = Math.round(Math.min(cw, ch) * matPct);
    const innerW = cw - 2 * matSize;
    const innerH = ch - 2 * matSize;

    const fitScale = Math.min(innerW / srcW, innerH / srcH);
    const drawW = Math.round(srcW * fitScale);
    const drawH = Math.round(srcH * fitScale);
    const drawX = Math.round((cw - drawW) / 2);
    const drawY = Math.round((ch - drawH) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, srcW, srcH, drawX, drawY, drawW, drawH);

    ctx.strokeStyle = 'rgba(74, 158, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(drawX + 0.5, drawY + 0.5, drawW - 1, drawH - 1);

  } else {
    // === CROP MODE (default) ===
    const scale = Math.min(maxDim / srcW, maxDim / srcH);
    const cw = Math.round(srcW * scale);
    const ch = Math.round(srcH * scale);

    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    // 1. Draw full image dimmed
    ctx.globalAlpha = 0.25;
    ctx.drawImage(img, 0, 0, cw, ch);

    // 2. Compute center-crop region
    const targetRatio = targetW / targetH;
    const srcRatio = srcW / srcH;

    let cropX, cropY, cropW, cropH;
    if (srcRatio > targetRatio) {
      cropH = srcH;
      cropW = Math.round(srcH * targetRatio);
      cropX = Math.round((srcW - cropW) / 2);
      cropY = 0;
    } else {
      cropW = srcW;
      cropH = Math.round(srcW / targetRatio);
      cropX = 0;
      cropY = Math.round((srcH - cropH) / 2);
    }

    const cx = Math.round(cropX * scale);
    const cy = Math.round(cropY * scale);
    const ccw = Math.round(cropW * scale);
    const cch = Math.round(cropH * scale);

    // 3. Draw kept crop region at full brightness
    ctx.globalAlpha = 1.0;
    ctx.drawImage(img, cropX, cropY, cropW, cropH, cx, cy, ccw, cch);

    // 4. Border around crop region
    ctx.strokeStyle = 'rgba(74, 158, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, cy + 0.5, ccw - 1, cch - 1);
  }
}

// =============================================================================
// INIT — render default cards on page load
// =============================================================================

renderRatioCards(currentOrientation);
