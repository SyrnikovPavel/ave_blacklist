const offersRootSelectorValue = "bx.catalog.container";
const offersRootSelector = `[elementtiming="${offersRootSelectorValue}"]`;
const offersSelector = '[data-marker="item"]';
const logPrefix = "[ave]";
const NOTES_USERS_KEY = "notesUsers";
const NOTES_OFFERS_KEY = "notesOffers";
const NOTES_MAX_LENGTH = 2000;
const NOTES_SAVE_DEBOUNCE_MS = 450;
const HIDDEN_ORIGINAL_ATTR = "data-ave-hidden-original";
const HIDDEN_CLONE_ATTR = "data-ave-hidden-clone";
const MAX_AUTO_PAGINATION_PAGES = 20;
const MAX_AUTO_PAGINATION_ITEMS = 1000;
const MAX_CATALOG_ENTRIES = 1500;
const MAX_RESERVED_CACHE_SIZE = 500;
const PROCESS_SEARCH_DEBOUNCE_MS = 150;

const sellerPageSidebarSelector = `[class^="ExtendedProfileStickyContainer-"]`;

// Селекторы для раздела рекомендаций на главной странице
const recommendationsItemSelector = '[class*="js-item-"]';
const recommendationsCardSelector = '[data-marker="bx-recommendations-block-item"]';

// Определение главной страницы
function isHomePage() {
  const pathname = window.location.pathname;
  return pathname === '/' || pathname === '';
}

// ==================== USER PROFILE PAGE FUNCTIONALITY ====================

// Определение страницы профиля пользователя
function isUserProfilePage() {
  const pathname = window.location.pathname;
  return pathname.includes('/user/') || pathname.includes('/brands/');
}

// Извлечение ID продавца из URL профиля
function getSellerIdFromUrl() {
  const pathname = window.location.pathname;
  const userMatch = pathname.match(/\/user\/([^\/]+)/);
  const brandMatch = pathname.match(/\/brands\/([^\/]+)/);
  
  if (userMatch) return userMatch[1].split('?')[0];
  if (brandMatch) return brandMatch[1].split('?')[0];
  return null;
}

// ==================== ITEM PAGE FUNCTIONALITY ====================

// Определение страницы товара (item page)
// URL паттерн: /город/категория/название_ID или /город/категория/подкатегория/название_ID
function isItemPage() {
  const pathname = window.location.pathname;
  // Исключаем служебные страницы
  const excludedPaths = ['user', 'brands', 'companies', 'shops', 'profile', 'favorites', 'messages', 'search'];
  const pathParts = pathname.split('/').filter(part => part !== '');
  
  // Минимум 3 части: город, категория, название_id
  if (pathParts.length < 3) return false;
  
  // Первая часть не должна быть служебной
  if (excludedPaths.includes(pathParts[0])) return false;
  
  // Последняя часть должна содержать ID (заканчиваться на _цифры или просто цифры)
  const lastPart = pathParts[pathParts.length - 1];
  return /[_]\d+$/.test(lastPart) || /^\d+$/.test(lastPart);
}

// Извлечение ID объявления из URL страницы товара
function getItemPageOfferId() {
  const pathname = window.location.pathname;
  // Ищем ID в конце URL (после последнего _ или как отдельное число)
  const match = pathname.match(/_(\d+)(?:\?|$|#)/) || pathname.match(/\/(\d+)(?:\?|$|#)/);
  if (match) {
    return match[1];
  }
  // Альтернативный способ - из конца pathname
  const parts = pathname.split('/').filter(p => p);
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1].split('?')[0];
    const idMatch = lastPart.match(/_(\d+)$/) || lastPart.match(/^(\d+)$/);
    if (idMatch) {
      return idMatch[1];
    }
  }
  return null;
}

// Извлечение ID продавца из DOM на странице товара
function getItemPageSellerId() {
  // Ищем ссылку на продавца
  const sellerLink = document.querySelector('a[data-marker="seller-link/link"]');
  if (sellerLink) {
    const href = sellerLink.href;
    // Поддерживаем /user/ и /brands/
    const userMatch = href.match(/\/user\/([^\/\?]+)/);
    const brandMatch = href.match(/\/brands\/([^\/\?]+)/);
    
    if (userMatch) {
      return userMatch[1];
    } else if (brandMatch) {
      return brandMatch[1];
    }
  }
  return null;
}

function findItemPageContactsRoot() {
  return document.querySelector('[data-marker="item-view/item-view-contacts"]') ||
    document.querySelector('[class*="contact-bar__root"]') ||
    document.querySelector('[class*="style__contactBarOnly"]');
}

function findItemPageInstallmentsBlock() {
  const directBlock = document.querySelector('[data-marker="installments-promoblock"]');
  if (directBlock) return directBlock;

  const installmentsButton = document.querySelector('[data-marker="installments-promoblock/button"]');
  if (installmentsButton) {
    return installmentsButton.closest('[data-marker="installments-promoblock"]') ||
      installmentsButton.closest('[data-marker="installments-promoblock/button"]')?.parentElement ||
      installmentsButton.closest("div");
  }

  return null;
}

function findItemPageButtonsInsertPoint() {
  const installmentsBlock = findItemPageInstallmentsBlock();
  if (installmentsBlock?.parentElement) {
    return { anchor: installmentsBlock, mode: "before" };
  }

  const contactsRoot = findItemPageContactsRoot();
  if (!contactsRoot) return { anchor: null, mode: "append" };

  if (contactsRoot.parentElement) {
    return { anchor: contactsRoot, mode: "before" };
  }

  const phoneButton = contactsRoot.querySelector('[data-marker="item-phone-button/card"]');
  const messageButton = contactsRoot.querySelector('[data-marker="messenger-button/button"]');

  const phoneActionHost = phoneButton?.closest('[class*="item-actions-line"]') || phoneButton?.closest('div');
  const messageActionHost = messageButton?.closest('[class*="item-actions-line"]') || messageButton?.closest('div');

  if (phoneActionHost?.parentElement && phoneActionHost.parentElement === messageActionHost?.parentElement) {
    return { anchor: phoneActionHost.parentElement, mode: "append" };
  }

  if (messageActionHost?.parentElement) {
    return { anchor: messageActionHost.parentElement, mode: "append" };
  }

  if (phoneActionHost?.parentElement) {
    return { anchor: phoneActionHost.parentElement, mode: "append" };
  }

  return { anchor: contactsRoot, mode: "append" };
}

function insertItemPageContainer(container) {
  const insertPoint = findItemPageButtonsInsertPoint();
  if (!insertPoint?.anchor) return false;

  if (insertPoint.mode === "before") {
    insertPoint.anchor.before(container);
    return true;
  }

  insertPoint.anchor.appendChild(container);
  return true;
}

function updateInstallmentsVisibility() {
  const installmentsBlock = findItemPageInstallmentsBlock();
  if (!installmentsBlock) return;
  installmentsBlock.classList.toggle("ave-hidden-installments", hideInstallmentsEnabled);
}

// Проверка наличия кнопок на странице товара
function hasItemPageButtons() {
  return document.querySelector('.item-page-blacklist-container') !== null;
}

// Создание кнопки в стиле Avito
function createItemPageButton(text, isBlock, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = isBlock ? 'item-page-block-btn' : 'item-page-unblock-btn';
  button.innerHTML = `<span class="item-page-btn-wrapper"><span class="item-page-btn-text">${text}</span></span>`;
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  });
  return button;
}

function renderItemPageNotes(container, offerId, sellerId) {
  if (offerId) {
    createNoteBlock({
      container,
      entityType: "offer",
      entityId: offerId,
      label: "Заметка об объявлении",
      getMetadata: () => ({
        title: getItemPageTitle(),
        url: window.location.href,
      }),
    });
  }

  if (sellerId) {
    createNoteBlock({
      container,
      entityType: "user",
      entityId: sellerId,
      label: "Заметка о продавце",
      getMetadata: () => ({
        displayName: getItemPageSellerName(),
      }),
    });
  }
}

// Вставка кнопок на страницу товара
function insertItemPageButtons(offerId, sellerId) {
  // Проверяем, не добавлены ли уже кнопки
  if (hasItemPageButtons()) {
    // Обновляем существующие кнопки
    updateItemPageButtons(offerId, sellerId);
    return;
  }

  // Создаем контейнер для наших кнопок
  const container = document.createElement('div');
  container.className = 'item-page-blacklist-container';

  // Проверяем состояние в блеклисте
  const userIsBlacklisted = sellerId && blacklistUsers.includes(sellerId + "_blacklist_user");
  const offerIsBlacklisted = offerId && blacklistOffers.includes(offerId + "_blacklist_ad");

  // Кнопка для продавца
  if (sellerId) {
    const sellerButton = createItemPageButton(
      userIsBlacklisted ? 'Разблокировать продавца' : 'Заблокировать продавца',
      !userIsBlacklisted,
      () => {
        if (userIsBlacklisted) {
          removeUserFromBlacklist(sellerId);
        } else {
          addUserToBlacklist(sellerId);
        }
        updateItemPageButtons(offerId, sellerId);
      }
    );
    container.appendChild(sellerButton);
  }

  // Кнопка для объявления
  if (offerId) {
    const offerButton = createItemPageButton(
      offerIsBlacklisted ? 'Разблокировать объявление' : 'Заблокировать объявление',
      !offerIsBlacklisted,
      () => {
        if (offerIsBlacklisted) {
          removeOfferFromBlacklist(offerId);
        } else {
          addOfferToBlacklist(offerId);
        }
        updateItemPageButtons(offerId, sellerId);
      }
    );
    container.appendChild(offerButton);
  }

  renderItemPageNotes(container, offerId, sellerId);
  if (!insertItemPageContainer(container)) {
    console.log(`${logPrefix} Точка вставки кнопок не найдена на странице товара`);
    return;
  }

  console.log(`${logPrefix} Кнопки блокировки добавлены на страницу товара`);
}

// Обновление кнопок на странице товара
function updateItemPageButtons(offerId, sellerId) {
  const container = document.querySelector('.item-page-blacklist-container');
  if (!container) return;

  // Удаляем старые кнопки
  container.innerHTML = '';

  // Проверяем состояние в блеклисте
  const userIsBlacklisted = sellerId && blacklistUsers.includes(sellerId + "_blacklist_user");
  const offerIsBlacklisted = offerId && blacklistOffers.includes(offerId + "_blacklist_ad");

  // Кнопка для продавца
  if (sellerId) {
    const sellerButton = createItemPageButton(
      userIsBlacklisted ? 'Разблокировать продавца' : 'Заблокировать продавца',
      !userIsBlacklisted,
      () => {
        if (userIsBlacklisted) {
          removeUserFromBlacklist(sellerId);
        } else {
          addUserToBlacklist(sellerId);
        }
        updateItemPageButtons(offerId, sellerId);
      }
    );
    container.appendChild(sellerButton);
  }

  // Кнопка для объявления
  if (offerId) {
    const offerButton = createItemPageButton(
      offerIsBlacklisted ? 'Разблокировать объявление' : 'Заблокировать объявление',
      !offerIsBlacklisted,
      () => {
        if (offerIsBlacklisted) {
          removeOfferFromBlacklist(offerId);
        } else {
          addOfferToBlacklist(offerId);
        }
        updateItemPageButtons(offerId, sellerId);
      }
    );
    container.appendChild(offerButton);
  }

  renderItemPageNotes(container, offerId, sellerId);
}

// Основная функция обработки страницы товара
function processItemPage() {
  if (!isItemPage()) return;

  const offerId = getItemPageOfferId();
  const sellerId = getItemPageSellerId();
  updateInstallmentsVisibility();

  console.log(`${logPrefix} Страница товара: offerId=${offerId}, sellerId=${sellerId}`);

  if (offerId || sellerId) {
    insertItemPageButtons(offerId, sellerId);
  }
}

// Извлечение ID объявления из класса элемента рекомендаций (js-item-XXXXXXX)
function getRecommendationOfferId(element) {
  const classList = element.className;
  const match = classList.match(/js-item-(\d+)/);
  return match ? match[1] : null;
}

// browser compatibility
if (typeof browser === "undefined") {
  var browser = chrome;
}

// STORAGE
function hasNumber(myString) {
  return /\d/.test(myString);
}

function syncStore(key, objectToStore) {
  var jsonstr = JSON.stringify(objectToStore);
  var i = 0;
  var storageObj = {};

  // split jsonstr into chunks and store them in an object indexed by `key_i`
  while (jsonstr.length > 0) {
    var index = key + "_" + i++;

    // since the key uses up some per-item quota, see how much is left for the value
    // also trim off 2 for quotes added by storage-time `stringify`
    const maxLength = browser.storage.local.QUOTA_BYTES_PER_ITEM - index.length - 2;
    var valueLength = jsonstr.length;
    if (valueLength > maxLength) {
      valueLength = maxLength;
    }

    // trim down segment so it will be small enough even when run through `JSON.stringify` again at storage time
    //max try is QUOTA_BYTES_PER_ITEM to avoid infinite loop
    var segment = jsonstr.substr(0, valueLength);
    for (let i = 0; i < browser.storage.local.QUOTA_BYTES_PER_ITEM; i++) {
      const jsonLength = JSON.stringify(segment).length;
      if (jsonLength > maxLength) {
        segment = jsonstr.substr(0, --valueLength);
      } else {
        break;
      }
    }

    storageObj[index] = segment;
    jsonstr = jsonstr.substr(valueLength);
  }
  browser.storage.local.set(storageObj);
}

function syncGet(key) {
  return new Promise((resolve) => {
    browser.storage.local.get(null, function (items) {
      const keyArr = new Array();
      for (let item of Object.keys(items)) {
        if (item.includes(key)) {
          if (hasNumber(item)) {
            keyArr.push(item);
          }
        }
      }
      browser.storage.local.get(keyArr, (items) => {
        const keys = Object.keys(items);
        const length = keys.length;
        let results = "";
        if (length > 0) {
          const sepPos = keys[0].lastIndexOf("_");
          const prefix = keys[0].substring(0, sepPos);
          for (let x = 0; x < length; x++) {
            results += items[`${prefix}_${x}`];
          }
          results = results
            .replaceAll("[", "")
            .replaceAll("]", ",")
            .replaceAll(" ", "")
            .replaceAll('"', "")
            .replaceAll('"', "")
            .split(",")
            .filter((element) => element !== "");
          resolve(results);
          return;
        }
        resolve([]);
      });
    });
  });
}

function sanitizeNotesMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const normalized = {};
  for (const [entityId, note] of Object.entries(value)) {
    if (!note || typeof note !== "object") continue;
    const text = typeof note.text === "string" ? note.text : "";
    if (!text.trim()) continue;
    normalized[entityId] = {
      text: text.slice(0, NOTES_MAX_LENGTH),
      updatedAt: typeof note.updatedAt === "string" ? note.updatedAt : null,
      displayName: typeof note.displayName === "string" ? note.displayName : undefined,
      title: typeof note.title === "string" ? note.title : undefined,
      url: typeof note.url === "string" ? note.url : undefined,
    };
  }

  return normalized;
}

function getNotesStateKey(entityType) {
  return entityType === "user" ? NOTES_USERS_KEY : NOTES_OFFERS_KEY;
}

function getNotesMap(entityType) {
  return entityType === "user" ? notesUsers : notesOffers;
}

function setNotesMap(entityType, value) {
  if (entityType === "user") {
    notesUsers = value;
    return;
  }
  notesOffers = value;
}

async function loadNotes() {
  const result = await browser.storage.local.get([NOTES_USERS_KEY, NOTES_OFFERS_KEY]);
  notesUsers = sanitizeNotesMap(result[NOTES_USERS_KEY]);
  notesOffers = sanitizeNotesMap(result[NOTES_OFFERS_KEY]);
}

function getNote(entityType, entityId) {
  if (!entityId) return null;
  const map = getNotesMap(entityType);
  return map[entityId] || null;
}

function getNotePreviewText(noteText) {
  if (!noteText || !noteText.trim()) {
    return "Добавить заметку";
  }
  const normalized = noteText.replace(/\s+/g, " ").trim();
  return normalized.length > 80 ? `${normalized.slice(0, 80)}...` : normalized;
}

function getProfileSellerName() {
  const nameHeader = document.querySelector('[data-marker^="name "]');
  if (nameHeader?.textContent) {
    return nameHeader.textContent.trim();
  }
  return null;
}

function getItemPageSellerName() {
  const sellerNameEl = document.querySelector('[data-marker="seller-info/name"]') ||
    document.querySelector('[data-marker="seller-link/name"]') ||
    document.querySelector('[class*="SellerInfo-name"]');
  if (sellerNameEl?.textContent) {
    return sellerNameEl.textContent.trim();
  }
  return null;
}

function getItemPageTitle() {
  const titleEl = document.querySelector('[data-marker="item-view/title-info"]') ||
    document.querySelector("h1");
  if (titleEl?.textContent) {
    return titleEl.textContent.trim();
  }
  return null;
}

function normalizeNoteText(textValue) {
  const text = typeof textValue === "string" ? textValue : "";
  return text.slice(0, NOTES_MAX_LENGTH);
}

async function saveNote(entityType, entityId, textValue, metadata = {}) {
  if (!entityId) return;
  const mapKey = getNotesStateKey(entityType);
  const map = { ...getNotesMap(entityType) };
  const normalizedText = normalizeNoteText(textValue);

  if (!normalizedText.trim()) {
    if (map[entityId]) {
      delete map[entityId];
      setNotesMap(entityType, map);
      await browser.storage.local.set({ [mapKey]: map });
      console.log(`${logPrefix} заметка удалена: ${entityType} ${entityId}`);
    }
    return;
  }

  const note = {
    text: normalizedText,
    updatedAt: new Date().toISOString(),
  };

  if (typeof metadata.displayName === "string" && metadata.displayName.trim()) {
    note.displayName = metadata.displayName.trim();
  } else if (map[entityId]?.displayName) {
    note.displayName = map[entityId].displayName;
  }

  if (typeof metadata.title === "string" && metadata.title.trim()) {
    note.title = metadata.title.trim();
  } else if (map[entityId]?.title) {
    note.title = map[entityId].title;
  }

  if (typeof metadata.url === "string" && metadata.url.trim()) {
    note.url = metadata.url.trim();
  } else if (map[entityId]?.url) {
    note.url = map[entityId].url;
  }

  map[entityId] = note;
  setNotesMap(entityType, map);
  await browser.storage.local.set({ [mapKey]: map });
  console.log(`${logPrefix} заметка сохранена: ${entityType} ${entityId}`);
}

function registerNoteBlockController(entityType, entityId, controller) {
  const key = `${entityType}:${entityId}`;
  if (!noteBlockControllers.has(key)) {
    noteBlockControllers.set(key, new Set());
  }
  noteBlockControllers.get(key).add(controller);
}

function refreshNoteBlocks(entityType, entityId) {
  const key = `${entityType}:${entityId}`;
  const controllers = noteBlockControllers.get(key);
  if (!controllers) return;

  for (const controller of [...controllers]) {
    if (!controller?.element?.isConnected) {
      controllers.delete(controller);
      continue;
    }
    controller.refresh();
  }

  if (controllers.size === 0) {
    noteBlockControllers.delete(key);
  }
}

function refreshAllNoteBlocks() {
  for (const [key, controllers] of [...noteBlockControllers.entries()]) {
    for (const controller of [...controllers]) {
      if (!controller?.element?.isConnected) {
        controllers.delete(controller);
        continue;
      }
      controller.refresh();
    }
    if (controllers.size === 0) {
      noteBlockControllers.delete(key);
    }
  }
}

function createNoteBlock(options) {
  const existing = options.container.querySelector(
    `.ave-note-card[data-ave-note-type="${options.entityType}"][data-ave-note-id="${options.entityId}"]`
  );
  if (existing) return existing;

  const details = document.createElement("details");
  details.className = "ave-note-card";
  details.dataset.aveNoteType = options.entityType;
  details.dataset.aveNoteId = options.entityId;

  const summary = document.createElement("summary");
  summary.className = "ave-note-summary";
  const summaryLabel = document.createElement("span");
  summaryLabel.className = "ave-note-summary-label";
  summaryLabel.textContent = options.label;
  const summaryPreview = document.createElement("span");
  summaryPreview.className = "ave-note-summary-preview";
  summary.appendChild(summaryLabel);
  summary.appendChild(summaryPreview);

  const body = document.createElement("div");
  body.className = "ave-note-body";

  const textarea = document.createElement("textarea");
  textarea.className = "ave-note-textarea";
  textarea.placeholder = "Введите заметку...";
  textarea.maxLength = NOTES_MAX_LENGTH;

  const footer = document.createElement("div");
  footer.className = "ave-note-footer";
  const statusEl = document.createElement("span");
  statusEl.className = "ave-note-status";
  const counterEl = document.createElement("span");
  counterEl.className = "ave-note-counter";
  footer.appendChild(statusEl);
  footer.appendChild(counterEl);

  body.appendChild(textarea);
  body.appendChild(footer);
  details.appendChild(summary);
  details.appendChild(body);
  options.container.appendChild(details);

  let saveTimer = null;
  let saveRequestId = 0;

  const setStatus = (status) => {
    statusEl.dataset.state = status;
    if (status === "saving") {
      statusEl.textContent = "Сохранение...";
      return;
    }
    if (status === "saved") {
      statusEl.textContent = "Сохранено";
      return;
    }
    if (status === "error") {
      statusEl.textContent = "Ошибка сохранения";
      return;
    }
    statusEl.textContent = "";
  };

  const updateCounter = () => {
    counterEl.textContent = `${textarea.value.length}/${NOTES_MAX_LENGTH}`;
  };

  const refresh = () => {
    const note = getNote(options.entityType, options.entityId);
    const noteText = note?.text || "";
    if (document.activeElement !== textarea) {
      textarea.value = noteText;
      updateCounter();
    }
    summaryPreview.textContent = getNotePreviewText(noteText);
    if (note?.updatedAt) {
      setStatus("saved");
    } else if (!textarea.value.trim()) {
      setStatus("idle");
    }
  };

  const saveNow = async () => {
    const requestId = ++saveRequestId;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    setStatus("saving");
    try {
      const metadata = typeof options.getMetadata === "function" ? options.getMetadata() : {};
      await saveNote(options.entityType, options.entityId, textarea.value, metadata);
      if (requestId !== saveRequestId) return;
      setStatus("saved");
      summaryPreview.textContent = getNotePreviewText(textarea.value);
      refreshNoteBlocks(options.entityType, options.entityId);
    } catch (error) {
      console.error(`${logPrefix} ошибка сохранения заметки`, error);
      if (requestId !== saveRequestId) return;
      setStatus("error");
    }
  };

  textarea.addEventListener("input", () => {
    if (textarea.value.length > NOTES_MAX_LENGTH) {
      textarea.value = textarea.value.slice(0, NOTES_MAX_LENGTH);
    }
    updateCounter();
    setStatus("saving");
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, NOTES_SAVE_DEBOUNCE_MS);
  });

  textarea.addEventListener("blur", () => {
    saveNow();
  });

  registerNoteBlockController(options.entityType, options.entityId, {
    element: details,
    refresh,
  });

  refresh();
  updateCounter();
  return details;
}

function migrateStorage() {
  // Step 1: Retrieve all items from storage.sync
  browser.storage.sync.get(null, function (items) {
    if (browser.runtime.lastError) {
      console.error(`${logPrefix} Error retrieving sync storage:`, browser.runtime.lastError);
      return;
    }

    // Step 2: Save the retrieved items to storage.local
    browser.storage.local.set(items, function () {
      if (browser.runtime.lastError) {
        console.error(`${logPrefix} Error setting local storage:`, browser.runtime.lastError);
        return;
      }

      console.log(`${logPrefix} Data migrated to local storage successfully.`);
    });
  });
}

// ==================== AUTO-PAGINATION FUNCTIONALITY ====================
function createSpinner() {
  const spinner = document.createElement("div");
  spinner.className = "avito-auto-pagination-loader-spinner";
  spinner.style.display = "none";
  spinner.style.position = "absolute";
  spinner.style.right = "10px";
  spinner.style.top = "50%";
  spinner.style.transform = "translateY(-50%)";
  spinner.style.border = "3px solid rgba(255, 255, 255, 0.3)";
  spinner.style.borderTop = "3px solid white";
  spinner.style.borderRadius = "50%";
  spinner.style.width = "16px";
  spinner.style.height = "16px";
  spinner.style.animation = "spin 0.8s linear infinite";

  // Add keyframes for spinner if not already added
  if (!document.getElementById("avito-spinner-style")) {
    const style = document.createElement("style");
    style.id = "avito-spinner-style";
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  return spinner;
}

function getMainOffersContainer() {
  const containers = document.querySelectorAll('[class*="items-items-"]');
  return containers.length > 0 ? containers[0] : null;
}

function getOtherCitiesContainer() {
  const containers = document.querySelectorAll('[class*="items-items-"]');
  return containers.length > 1 ? containers[1] : null;
}

function isPaginatorVisible() {
  const paginator = document.querySelector('[class*="js-pages pagination-pagination-"]');
  if (!paginator) {
    console.log(`${logPrefix} Paginator not found`);
    return false;
  }

  const rect = paginator.getBoundingClientRect();
  const isVisible = rect.top <= (window.innerHeight || document.documentElement.clientHeight) && rect.bottom >= 0;

  // console.log(`${logPrefix} Paginator visibility check: ${isVisible}`);
  return isVisible;
}

// Get current page number
function getCurrentPage() {
  const currentPageElement = document.querySelector('[class*="styles-module-item_current-"]');
  if (currentPageElement) {
    const pageText = currentPageElement.querySelector("span")?.textContent;
    const page = parseInt(pageText, 10) || 1;
    console.log(`${logPrefix} Current page: ${page}`);
    return page;
  }
  console.log(`${logPrefix} Current page not found, defaulting to 1`);
  return 1;
}

function getNextPageUrl() {
  const currentPage = getCurrentPage();
  const nextPageElement = document.querySelector(`[data-value="${currentPage + 1}"]`);
  const url = nextPageElement ? nextPageElement.href : null;
  console.log(`${logPrefix} Next page URL: ${url}`);
  return url;
}

function removeBrokenElements(item) {
  item.querySelectorAll('[class*="photo-slider-extra"]').forEach((container) => {
    container.remove();
  });

  item.querySelectorAll('[class*="iva-item-actions-"]').forEach((container) => {
    container.remove();
  });
}

// Fix missing images in an item
function fixItemImages(item) {
  const imageContainers = item.querySelectorAll('[class*="photo-slider-dotsCounter"]');
  imageContainers.forEach((container) => {
    const imageMarker = container.getAttribute("data-marker");
    if (!imageMarker || !imageMarker.startsWith("slider-image/image-")) return;

    const imageUrl = imageMarker.replace("slider-image/image-", "");

    const imageSpan = container.querySelector("[class*='photo-slider-image-']");

    // If we have a span instead of an img, fix it
    if (imageSpan && imageSpan.tagName === "SPAN") {
      const img = document.createElement("img");
      img.className = "photo-slider-image";
      img.alt = item.querySelector('[itemprop="name"]')?.textContent || "";
      img.src = imageUrl;

      // Replace span with img
      imageSpan.replaceWith(img);
    }
  });
}

// Process new items - fix images and add to DOM
function processNewItems(newItems, targetContainer) {
  console.log(`${logPrefix} Processing ${newItems.length} new items into ${targetContainer.className}`);
  newItems.forEach((offer) => {
    const clone = offer.cloneNode(true);
    removeBrokenElements(clone);
    fixItemImages(clone);
    targetContainer.appendChild(clone);
    processOfferElement(clone);
  });
}

async function fetchNextPage() {
  if (!isPaginationEnabled || isLoading) {
    console.log(`${logPrefix} Fetch aborted - script disabled or already loading`);
    return;
  }

  if (autoPaginationPagesLoaded >= MAX_AUTO_PAGINATION_PAGES) {
    console.log(`${logPrefix} Достигнут лимит автопагинации: ${MAX_AUTO_PAGINATION_PAGES} страниц`);
    return;
  }

  if (autoPaginationItemsLoaded >= MAX_AUTO_PAGINATION_ITEMS) {
    console.log(`${logPrefix} Достигнут лимит автопагинации: ${MAX_AUTO_PAGINATION_ITEMS} объявлений`);
    return;
  }

  const spinner = createSpinner();

  const nextPageUrl = getNextPageUrl();
  if (!nextPageUrl) {
    console.log(`${logPrefix} Все станицы получены`);
    return;
  }

  isLoading = true;
  console.log(`${logPrefix} Загрузка страницы  ${getCurrentPage() + 1}`);

  // Append spinner to pagination
  const paginator = document.querySelector('[class*="js-pages pagination-pagination-"]');
  if (paginator) {
    paginator.style.position = "relative";

    // Create status text element
    const statusText = document.createElement("span");
    statusText.className = "avito-pagination-status";
    statusText.textContent = `Загрузка страницы ${getCurrentPage() + 1}`;
    statusText.style.marginRight = "10px";
    statusText.style.color = "#999";
    statusText.style.fontSize = "14px";

    // Add elements to pagination
    spinner.style.display = "block";
    paginator.appendChild(statusText);
    paginator.appendChild(spinner);
  }

  try {
    const response = await fetch(nextPageUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Find all containers in the new page
    const newContainers = doc.querySelectorAll('[class*="items-items"]');

    console.log(`${logPrefix} Found ${newContainers.length} containers in new page`);

    if (newContainers.length === 0) {
      console.log(`${logPrefix} No containers found in new page`);
      return;
    }

    let addedItemsCount = 0;

    // Find catalog data in the new page
    const scriptElements = doc.querySelectorAll("script");
    for (const script of scriptElements) {
      if (script.textContent.includes("abCentral") && !script.textContent.startsWith("window[")) {
        try {
          const initCatalogDataContent = script.textContent;
          const decodedJson = decodeHtmlEntities(initCatalogDataContent);
          const newInitialData = JSON.parse(decodedJson);
          const newCatalogData = getCatalogDataFromInit(newInitialData);
          appendCatalogData(newCatalogData);
          console.log(`${logPrefix} Added ${newCatalogData.length} items to catalogData`);
          break;
        } catch (error) {
          console.error(`${logPrefix} Error parsing catalog data from new page:`, error);
        }
      }
    }

    // Process main offers (first container)
    const newMainOffers = Array.from(newContainers[0].children).filter((el) => el.hasAttribute("data-item-id"));
    if (newMainOffers.length > 0) {
      const mainContainer = getMainOffersContainer();
      if (mainContainer) {
        console.log(`${logPrefix} Adding ${newMainOffers.length} main offers`);
        processNewItems(newMainOffers, mainContainer);
        addedItemsCount += newMainOffers.length;
      } else {
        console.log(`${logPrefix} Main container not found`);
      }
    }

    // Process other cities offers (second container if exists)
    if (newContainers.length > 1) {
      const newOtherCitiesOffers = Array.from(newContainers[1].children).filter((el) => el.hasAttribute("data-item-id"));
      if (newOtherCitiesOffers.length > 0) {
        let targetContainer = getOtherCitiesContainer();

        if (!targetContainer) {
          console.log(`${logPrefix} No existing other cities container - creating one`);
          const mainContainer = getMainOffersContainer();
          if (mainContainer) {
            const newContainer = document.createElement("div");
            newContainer.className = "items-items-";
            mainContainer.after(newContainer);
            targetContainer = newContainer;
          }
        }

        if (targetContainer) {
          console.log(`${logPrefix} Adding ${newOtherCitiesOffers.length} other cities offers`);
          processNewItems(newOtherCitiesOffers, targetContainer);
          addedItemsCount += newOtherCitiesOffers.length;
        }
      }
    }

    autoPaginationPagesLoaded += 1;
    autoPaginationItemsLoaded += addedItemsCount;

    // Update pagination
    const newPaginator = doc.querySelector('[class*="js-pages pagination-pagination-"]');
    if (newPaginator) {
      if (paginator) {
        paginator.innerHTML = newPaginator.innerHTML;
        console.log(`${logPrefix} Updated pagination controls`);
      }
    }
    console.log(`${logPrefix} Страница успешно загружена`);
  } catch (error) {
    console.error(`${logPrefix} Ошибка загрузки страницы:`, error);
  } finally {
    isLoading = false;

    // Remove spinner and status text from pagination
    spinner.style.display = "none";
    if (spinner.parentNode) {
      const statusText = spinner.parentNode.querySelector(".avito-pagination-status");
      if (statusText) statusText.remove();
      spinner.parentNode.removeChild(spinner);
    }
  }
}

function checkPaginationVisibility() {
  if (!isPaginationEnabled || isLoading) return;
  clearTimeout(checkTimeout);
  checkTimeout = setTimeout(() => {
    if (isPaginatorVisible()) {
      fetchNextPage();
    }
  }, 200);
}

// Initialize MutationObserver to watch for paginator changes
function initPaginationObserver() {
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.addedNodes.length) {
        // console.log(`${logPrefix} DOM mutation detected, checking paginator visibility`);
        checkPaginationVisibility();
      }
    });
  });

  // Observe the document body for added nodes
  observer.observe(document, {
    childList: true,
    subtree: true,
  });

  return observer;
}

// Initialize pagination functionality
async function initPagination() {
  console.log(`${logPrefix} Initializing Avito Auto-Pagination script`);

  // Set up scroll listener
  window.addEventListener("scroll", checkPaginationVisibility);

  // Set up mutation observer
  initPaginationObserver();
}

// ==================== CITY FILTER FUNCTIONALITY ====================

// Служебные пути Avito, которые не являются городами
const EXCLUDED_URL_PATHS = ['user', 'brands', 'companies', 'shops', 'profile', 'favorites', 'messages'];

// CSS класс Avito для визуального состояния "включено" у переключателя
// Примечание: класс содержит хеш, который может измениться при обновлении Avito
const TOGGLE_CHECKED_CLASS = 'styles-module-controlledInput_checked-fJhQQ';
const CITY_FILTER_MARKER = 'filters/cityOnly';
const HIDE_RESERVED_FILTER_MARKER = 'filters/hideReserved';
const RESERVED_CHECK_TIMEOUT_MS = 5000;
const RESERVED_TEST_MODE_LOGS = true;

// Извлечение города из URL (общая функция)
function extractCityFromUrl(url) {
  if (!url) return null;
  const match = url.match(/avito\.ru\/([a-z_]+)/i);
  if (match && match[1]) {
    const path = match[1].toLowerCase();
    if (!EXCLUDED_URL_PATHS.includes(path)) {
      return path;
    }
  }
  return null;
}

// Извлечение города из URL страницы
function getCityFromPageUrl() {
  return extractCityFromUrl(window.location.href);
}

// Извлечение города из URL объявления
function getCityFromOfferUrl(url) {
  return extractCityFromUrl(url);
}

// Получение URL объявления из DOM элемента
function getOfferUrl(offerElement) {
  // Ищем ссылку на объявление в элементе
  const titleLink = offerElement.querySelector('[data-marker="item-title"]');
  if (titleLink && titleLink.href) {
    return titleLink.href;
  }
  // Альтернативный поиск ссылки
  const anyLink = offerElement.querySelector('a[href*="/"]');
  if (anyLink && anyLink.href && anyLink.href.includes('avito.ru/')) {
    return anyLink.href;
  }
  return null;
}

// Получение читаемого названия города из UI (из элемента "Сначала из Тюмени")
function getCityDisplayName() {
  const localPriorityLabel = document.querySelector('.filters-switcherLabel-vbkFI');
  if (localPriorityLabel) {
    const text = localPriorityLabel.textContent;
    // Извлекаем название города из "Сначала из Тюмени" -> "Тюмени"
    const match = text.match(/Сначала из (.+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  // Fallback: используем город из URL
  const cityLat = getCityFromPageUrl();
  return cityLat || 'города';
}

// Проверка, принадлежит ли объявление текущему городу
function isOfferFromCurrentCity(offerElement) {
  const currentCity = getCityFromPageUrl();
  if (!currentCity) return true; // Если не можем определить город, не фильтруем
  
  const offerUrl = getOfferUrl(offerElement);
  if (!offerUrl) return true; // Если нет URL, не фильтруем
  
  const offerCity = getCityFromOfferUrl(offerUrl);
  if (!offerCity) return true; // Если не можем определить город объявления, не фильтруем
  
  return offerCity === currentCity;
}

// Установка визуального состояния переключателя (checkbox + label)
function setToggleVisualState(checkbox, label, isEnabled) {
  if (checkbox) {
    checkbox.checked = isEnabled;
    checkbox.classList.toggle(TOGGLE_CHECKED_CLASS, isEnabled);
  }
  if (label) {
    label.setAttribute('aria-checked', isEnabled ? 'true' : 'false');
  }
}

// Обновление визуального состояния переключателя города
function updateCityFilterToggleState() {
  const label = document.querySelector(`[data-marker="${CITY_FILTER_MARKER}"]`);
  if (!label) return;
  
  const checkbox = label.querySelector('input[type="checkbox"]');
  setToggleVisualState(checkbox, label, cityFilterEnabled);
}

// Обновление визуального состояния переключателя "Скрывать резервы"
function updateHideReservedToggleState() {
  const label = document.querySelector(`[data-marker="${HIDE_RESERVED_FILTER_MARKER}"]`);
  if (!label) return;
  const checkbox = label.querySelector('input[type="checkbox"]');
  setToggleVisualState(checkbox, label, hideReservedEnabled);
}

function insertSearchFilterToggle(options) {
  const existingToggle = document.querySelector(`[data-marker="${options.labelMarker}"]`);
  if (existingToggle) {
    options.onExisting(existingToggle);
    return;
  }

  const topPanel = document.querySelector('[class*="index-topPanel-"]');
  if (!topPanel) {
    console.log(`${logPrefix} Верхняя панель не найдена для вставки переключателя ${options.labelMarker}`);
    return;
  }

  const existingToggleContainer = topPanel.querySelector('[data-marker="filters/localPriority/localPriority"]');
  if (!existingToggleContainer) {
    console.log(`${logPrefix} Существующий переключатель не найден`);
    return;
  }

  const getToggleHostContainer = (labelElement) => {
    return (
      labelElement.closest('[class*="styles-module-theme-"]') ||
      labelElement.closest('[class*="filters-subscription-additions-"]') ||
      labelElement.parentElement
    );
  };

  const parentContainer = getToggleHostContainer(existingToggleContainer);
  if (!parentContainer) {
    console.log(`${logPrefix} Родительский контейнер не найден`);
    return;
  }

  const newContainer = parentContainer.cloneNode(true);
  const newLabel = newContainer.querySelector('label');
  if (newLabel) {
    newLabel.setAttribute('data-marker', options.labelMarker);
  }

  const labelText = newContainer.querySelector('.filters-switcherLabel-vbkFI');
  if (labelText) {
    labelText.textContent = typeof options.labelText === 'function' ? options.labelText() : options.labelText;
  }

  const checkbox = newContainer.querySelector('input[type="checkbox"]');
  if (checkbox) {
    checkbox.name = options.checkboxName;
    checkbox.value = options.checkboxValue;
    checkbox.setAttribute('data-marker', `${options.labelMarker}/toggle`);
    setToggleVisualState(checkbox, newLabel, options.getIsEnabled());
    checkbox.addEventListener('change', function () {
      options.onToggle(this.checked, this, newLabel);
    });
  }

  let insertAfterContainer = parentContainer;
  if (options.insertAfterMarker) {
    const afterLabel = topPanel.querySelector(`[data-marker="${options.insertAfterMarker}"]`);
    const afterContainer = afterLabel ? getToggleHostContainer(afterLabel) : null;
    if (afterContainer) {
      insertAfterContainer = afterContainer;
    }
  }

  insertAfterContainer.after(newContainer);
}

// Создание UI переключателя "Только из [город]"
function insertCityFilterToggle() {
  const cityName = getCityDisplayName();
  insertSearchFilterToggle({
    labelMarker: CITY_FILTER_MARKER,
    checkboxName: 'cityOnly',
    checkboxValue: 'cityOnly',
    labelText: () => `Только из ${getCityDisplayName()}`,
    getIsEnabled: () => cityFilterEnabled,
    insertAfterMarker: 'filters/localPriority/localPriority',
    onExisting: () => {
      updateCityFilterToggleState();
      const existingText = document.querySelector(`[data-marker="${CITY_FILTER_MARKER}"] .filters-switcherLabel-vbkFI`);
      if (existingText) {
        existingText.textContent = `Только из ${getCityDisplayName()}`;
      }
    },
    onToggle: (isEnabled, checkbox, label) => {
      cityFilterEnabled = isEnabled;
      setToggleVisualState(checkbox, label, cityFilterEnabled);
      browser.storage.local.set({ isCityFilterEnabled: cityFilterEnabled });
      console.log(`${logPrefix} Фильтр по городу: ${cityFilterEnabled ? 'включен' : 'выключен'}`);
      processSearchPage();
    },
  });
  console.log(`${logPrefix} Переключатель "Только из ${cityName}" добавлен/обновлен`);
}

function insertHideReservedToggle() {
  insertSearchFilterToggle({
    labelMarker: HIDE_RESERVED_FILTER_MARKER,
    checkboxName: 'hideReserved',
    checkboxValue: 'hideReserved',
    labelText: 'Скрывать резервы',
    getIsEnabled: () => hideReservedEnabled,
    insertAfterMarker: CITY_FILTER_MARKER,
    onExisting: updateHideReservedToggleState,
    onToggle: (isEnabled, checkbox, label) => {
      hideReservedEnabled = isEnabled;
      setToggleVisualState(checkbox, label, hideReservedEnabled);
      browser.storage.local.set({ isHideReservedEnabled: hideReservedEnabled });
      console.log(`${logPrefix} Фильтр по резервам: ${hideReservedEnabled ? 'включен' : 'выключен'}`);
      processSearchPage();
    },
  });
}

// ==================== MAIN FUNCTIONALITY ====================

function getSellerId(initialData) {
  const customLink = initialData.data.ssrData.initData.result.value.data.customLink;
  const profileUserHash = initialData.data.ssrData.initData.result.value.data.profileUserHash;
  
  // Поддерживаем как /user/ так и /brands/ ссылки
  if (customLink) {
    const userMatch = customLink.match(/\/user\/([^\/]+)/);
    const brandMatch = customLink.match(/\/brands\/([^\/]+)/);
    
    if (userMatch) {
      return userMatch[1].split('?')[0]; // Убираем параметры после ?
    } else if (brandMatch) {
      // Для брендов используем ID бренда
      return brandMatch[1].split('?')[0]; // Убираем параметры после ?
    }
  }
  
  return profileUserHash;
}

function getCatalogData(initCatalogData) {
  // Проверяем существование необходимых свойств
  if (!initCatalogData || !initCatalogData.data || !initCatalogData.data.catalog) {
    console.warn(`${logPrefix} Неверная структура initCatalogData:`, initCatalogData);
    return [];
  }
  
  const catalogItems = initCatalogData.data.catalog.items || [];
  const extraItems = initCatalogData.data.catalog.extraBlockItems || [];
  let allItems = catalogItems.concat(extraItems);
  allItems = allItems.filter((item) => item.hasOwnProperty("categoryId"));
  return allItems;
}

function parseInitialData(initialDataContent) {
  try {
    initialDataContent = decodeURIComponent(initialDataContent);

    // Find the start and end indexes of __initialData__ JSON
    const startIndex = initialDataContent.indexOf('window.__initialData__ = "') + 'window.__initialData__ = "'.length;
    const endIndex = initialDataContent.indexOf('";\nwindow.__mfe__');

    // Extract the JSON string
    const jsonString = initialDataContent.substring(startIndex, endIndex);

    // Parse the JSON string into a JavaScript object
    const initialData = JSON.parse(jsonString);
    return initialData;
  } catch (error) {
    console.error(`${logPrefix} Ошибка парсинга __initialData__:`, error);
  }
  return null;
}

function addUserToBlacklist(userId) {
  let searchId = userId + "_blacklist_user";
  let inBlacklist = blacklistUsers.includes(searchId);
  if (!inBlacklist) {
    blacklistUsers.push(searchId);
    syncStore("blacklistUsers", blacklistUsers);
  }
  console.log(`${logPrefix} продавец ${userId} добавлен в блеклист`);
}

function addOfferToBlacklist(offerId) {
  let searchId = offerId + "_blacklist_ad";
  let inBlacklist = blacklistOffers.includes(searchId);
  if (!inBlacklist) {
    blacklistOffers.push(searchId);
    syncStore("blacklistOffers", blacklistOffers);
  }
  console.log(`${logPrefix} объявление ${offerId} добавлено в блеклист`);
}

function removeUserFromBlacklist(userId) {
  let searchId = userId + "_blacklist_user";
  let inBlacklist = blacklistUsers.includes(searchId);
  if (inBlacklist) {
    blacklistUsers = blacklistUsers.filter((userId) => userId !== searchId);
    syncStore("blacklistUsers", blacklistUsers);
  }
  console.log(`${logPrefix} продавец ${userId} удален из блеклиста`);
}

function removeOfferFromBlacklist(offerId) {
  let searchId = offerId + "_blacklist_ad";
  let inBlacklist = blacklistOffers.includes(searchId);
  if (inBlacklist) {
    blacklistOffers = blacklistOffers.filter((offerId) => offerId !== searchId);
    syncStore("blacklistOffers", blacklistOffers);
  }
  console.log(`${logPrefix} объявление ${offerId} удалено из блеклиста`);
}

function getOfferId(offerElement) {
  return offerElement.getAttribute("data-item-id");
}

function getHiddenContainerEl() {
  return document.querySelector(".hidden-container");
}

function isHiddenClone(offerElement) {
  return offerElement?.getAttribute(HIDDEN_CLONE_ATTR) === "true";
}

function isHiddenOriginal(offerElement) {
  return offerElement?.getAttribute(HIDDEN_ORIGINAL_ATTR) === "true";
}

function findHiddenCloneByOfferId(offerId) {
  const hiddenContainer = getHiddenContainerEl();
  if (!hiddenContainer || !offerId) return null;
  return hiddenContainer.querySelector(`[${HIDDEN_CLONE_ATTR}="true"][data-item-id="${offerId}"]`);
}

function findHiddenOriginalByOfferId(offerId) {
  if (!offerId) return null;
  return document.querySelector(`[${HIDDEN_ORIGINAL_ATTR}="true"][data-item-id="${offerId}"]`);
}

function dedupeHiddenClones(offerId) {
  const hiddenContainer = getHiddenContainerEl();
  if (!hiddenContainer || !offerId) return;
  const clones = hiddenContainer.querySelectorAll(`[${HIDDEN_CLONE_ATTR}="true"][data-item-id="${offerId}"]`);
  for (let i = 1; i < clones.length; i++) {
    clones[i].remove();
  }
}

function dedupeAllHiddenClones() {
  const hiddenContainer = getHiddenContainerEl();
  if (!hiddenContainer) return;
  const seen = new Set();
  hiddenContainer.querySelectorAll(`[${HIDDEN_CLONE_ATTR}="true"]`).forEach((clone) => {
    const offerId = getOfferId(clone);
    if (!offerId || seen.has(offerId)) {
      clone.remove();
      return;
    }
    seen.add(offerId);
  });
}

function extractUserIdFromSellerUrl(sellerUrl) {
  if (!sellerUrl) return null;
  const userMatch = sellerUrl.match(/\/user\/([^\/]+)/);
  const brandMatch = sellerUrl.match(/\/brands\/([^\/]+)/);
  if (userMatch) return userMatch[1].split("?")[0];
  if (brandMatch) return brandMatch[1].split("?")[0];
  return null;
}

function extractUserIdFromOfferElement(offerElement) {
  const sellerLinkElement = offerElement.querySelector('a[href*="/user/"]') ||
    offerElement.querySelector('a[href*="/brands/"]');
  if (!sellerLinkElement) return null;
  return extractUserIdFromSellerUrl(sellerLinkElement.href);
}

function extractUserIdFromCatalogItem(catalogItem) {
  if (!catalogItem) return null;
  if (catalogItem.userId) return catalogItem.userId;
  if (catalogItem.sellerLink) return extractUserIdFromSellerUrl(catalogItem.sellerLink);
  const sellerUrl = catalogItem.iva?.UserInfoStep?.[0]?.payload?.profile?.link;
  return extractUserIdFromSellerUrl(sellerUrl);
}

function trimCatalogItem(item) {
  if (!item?.id) return null;
  const trimmed = { id: item.id };
  const userId = extractUserIdFromCatalogItem(item);
  if (userId) trimmed.userId = userId;
  else {
    const sellerUrl = item.sellerLink || item.iva?.UserInfoStep?.[0]?.payload?.profile?.link;
    if (sellerUrl) trimmed.sellerLink = sellerUrl;
  }
  return trimmed;
}

function mergeCatalogData(existing, newItems) {
  const map = new Map();
  for (const item of existing || []) {
    const trimmed = trimCatalogItem(item);
    if (trimmed) map.set(trimmed.id, trimmed);
  }
  for (const item of newItems || []) {
    const trimmed = trimCatalogItem(item);
    if (trimmed) map.set(trimmed.id, trimmed);
  }
  let entries = Array.from(map.values());
  if (entries.length > MAX_CATALOG_ENTRIES) {
    entries = entries.slice(entries.length - MAX_CATALOG_ENTRIES);
  }
  return entries;
}

function setCatalogData(data) {
  catalogData = mergeCatalogData([], data);
}

function appendCatalogData(newItems) {
  catalogData = mergeCatalogData(catalogData, newItems);
}

function getCatalogItemByOfferId(offerId) {
  return catalogData?.find((item) => item.id === Number(offerId));
}

function setReservedStatusCache(offerId, value) {
  if (!offerId) return;
  if (reservedStatusCache.size >= MAX_RESERVED_CACHE_SIZE && !reservedStatusCache.has(offerId)) {
    const firstKey = reservedStatusCache.keys().next().value;
    reservedStatusCache.delete(firstKey);
    reservedRequestCache.delete(firstKey);
  }
  reservedStatusCache.set(offerId, value);
}

function pruneReservedCaches() {
  const activeOfferIds = new Set();
  document.querySelectorAll("[data-item-id]").forEach((el) => {
    const id = el.getAttribute("data-item-id");
    if (id) activeOfferIds.add(id);
  });
  for (const key of [...reservedStatusCache.keys()]) {
    if (!activeOfferIds.has(key)) {
      reservedStatusCache.delete(key);
      reservedRequestCache.delete(key);
    }
  }
}

function createHiddenContainer() {
  const offersRoot = document.querySelector(offersRootSelector);

  const hr = document.createElement("hr");
  hr.classList.add("custom-hr");

  const existingContainerEl = document.querySelector(".hidden-container");
  if (existingContainerEl) return existingContainerEl;

  // Create the <details> element
  const detailsElement = document.createElement("details");

  // Create the <summary> element
  const summaryElement = document.createElement("summary");
  summaryElement.textContent = "Скрытые объявления";
  summaryElement.classList.add("custom-summary");

  // Create content for the <details> element
  const contentElement = document.createElement("div");
  contentElement.classList.add("hidden-container");

  // Append the <summary> and content to the <details> element
  detailsElement.appendChild(summaryElement);
  detailsElement.appendChild(contentElement);

  // Append the <details> element to the document body or another element
  offersRoot.appendChild(hr);
  offersRoot.appendChild(detailsElement);

  return contentElement;
}

function insertBlockSellerButton(offerElement, offerInfo) {
  let buttonContainer = offerElement.querySelector(".button-container");
  if (!buttonContainer) {
    buttonContainer = insertButtonContainer(offerElement);
  }

  const blockButton = document.createElement("div");
  blockButton.title = "Скрыть все объявления продавца";

  const svgEl =
    '<svg xmlns="http://www.w3.org/2000/svg" class="custom-button block block-user-button" role="img" aria-label="user x" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!----><!----><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"></path><path d="M6 21v-2a4 4 0 0 1 4 -4h3.5"></path><path d="M22 22l-5 -5"></path><path d="M17 22l5 -5"></path></svg>';

  blockButton.insertAdjacentHTML("beforeend", svgEl);
  buttonContainer.appendChild(blockButton);
  blockButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (offerInfo.userId) addUserToBlacklist(offerInfo.userId);
    buttonContainer.remove();
    processSearchPage();
  });
}

function insertBlockOfferButton(offerElement, offerInfo) {
  let buttonContainer = offerElement.querySelector(".button-container");
  if (!buttonContainer) {
    buttonContainer = insertButtonContainer(offerElement);
  }

  const blockButton = document.createElement("div");
  blockButton.title = "Скрыть это объявление";

  const svgEl =
    '<svg xmlns="http://www.w3.org/2000/svg" class="custom-button block block-item-button" role="img" aria-label="eye x" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!----><!----><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path><path d="M13.048 17.942a9.298 9.298 0 0 1 -1.048 .058c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6a17.986 17.986 0 0 1 -1.362 1.975"></path><path d="M22 22l-5 -5"></path><path d="M17 22l5 -5"></path></svg>';

  blockButton.insertAdjacentHTML("beforeend", svgEl);
  buttonContainer.appendChild(blockButton);
  blockButton.addEventListener("click", (event) => {
    event.stopPropagation();
    addOfferToBlacklist(offerInfo.offerId);
    buttonContainer.remove();
    updateOfferState(offerElement, offerInfo);
  });
}

function insertUnblockSellerButton(offerElement, offerInfo) {
  let buttonContainer = offerElement.querySelector(".button-container");
  if (!buttonContainer) {
    buttonContainer = insertButtonContainer(offerElement);
  }

  const blockButton = document.createElement("div");
  blockButton.title = "Удалить продавца из черного списка";

  const svgEl =
    '<svg xmlns="http://www.w3.org/2000/svg" class="custom-button unblock unblock-user-button" role="img" aria-label="user check" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!----><!----><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"></path><path d="M6 21v-2a4 4 0 0 1 4 -4h4"></path><path d="M15 19l2 2l4 -4"></path></svg>';

  blockButton.insertAdjacentHTML("beforeend", svgEl);
  buttonContainer.appendChild(blockButton);
  blockButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (offerInfo.userId) removeUserFromBlacklist(offerInfo.userId);
    buttonContainer.remove();
    processSearchPage();
  });
}

function insertUnblockOfferButton(offerElement, offerInfo) {
  let buttonContainer = offerElement.querySelector(".button-container");
  if (!buttonContainer) {
    buttonContainer = insertButtonContainer(offerElement);
  }

  const blockButton = document.createElement("div");
  blockButton.title = "Удалить это объявление из черного списка";

  const svgEl =
    '<svg xmlns="http://www.w3.org/2000/svg" class="custom-button unblock unblock-offer-button" role="img" aria-label="eye check" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!----><!----><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path><path d="M11.102 17.957c-3.204 -.307 -5.904 -2.294 -8.102 -5.957c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6a19.5 19.5 0 0 1 -.663 1.032"></path><path d="M15 19l2 2l4 -4"></path></svg>';

  blockButton.insertAdjacentHTML("beforeend", svgEl);
  buttonContainer.appendChild(blockButton);
  blockButton.addEventListener("click", (event) => {
    event.stopPropagation();
    removeOfferFromBlacklist(offerInfo.offerId);
    buttonContainer.remove();
    updateOfferState(offerElement, offerInfo);
  });
}

function insertButtonContainer(offerElement) {
  const container = document.createElement("div");
  container.classList.add("button-container");
  offerElement.appendChild(container);
  return container;
}

function getHiddenReason(params) {
  if (params.userIsBlacklisted) {
    return { text: "Продавец скрыт пользователем", className: "hidden-reason-user", logLabel: "продавец в ЧС" };
  }
  if (params.offerIsBlacklisted) {
    return { text: "Объявление скрыто пользователем", className: "hidden-reason-offer", logLabel: "объявление в ЧС" };
  }
  if (params.shouldHideByReserved) {
    return { text: "В резерве", className: "hidden-reason-reserved", logLabel: "в резерве" };
  }
  if (params.shouldHideByCity) {
    return { text: "Другой город", className: "hidden-reason-city", logLabel: "другой город" };
  }
  return null;
}

function setHiddenReasonBadge(offerElement, reason) {
  const currentBadge = offerElement.querySelector(".hidden-reason-badge");
  if (currentBadge) {
    currentBadge.remove();
  }
  if (!reason) return;
  if (!offerElement.closest(".hidden-container")) return;

  const badge = document.createElement("div");
  badge.className = `hidden-reason-badge ${reason.className}`;
  badge.textContent = reason.text;

  const imageContainer = offerElement.querySelector('[class*="photo-slider-root"]') || offerElement;
  if (getComputedStyle(imageContainer).position === "static") {
    imageContainer.style.position = "relative";
  }
  imageContainer.appendChild(badge);
}

function hasAnyNoteForOfferInfo(offerInfo) {
  const offerHasNote = Boolean(offerInfo?.offerId && notesOffers[offerInfo.offerId]?.text?.trim());
  const userHasNote = Boolean(offerInfo?.userId && notesUsers[offerInfo.userId]?.text?.trim());
  return {
    offerHasNote,
    userHasNote,
    hasNote: offerHasNote || userHasNote,
  };
}

function getOfferNoteIndicatorTitle(offerInfo) {
  const noteState = hasAnyNoteForOfferInfo(offerInfo);
  if (noteState.offerHasNote && noteState.userHasNote) {
    return "Есть заметки об объявлении и продавце";
  }
  if (noteState.offerHasNote) {
    return "Есть заметка об объявлении";
  }
  if (noteState.userHasNote) {
    return "Есть заметка о продавце";
  }
  return "";
}

function setOfferNoteIndicator(offerElement, offerInfo) {
  const existingIndicator = offerElement.querySelector(".ave-note-indicator");
  if (existingIndicator) {
    existingIndicator.remove();
  }

  const noteState = hasAnyNoteForOfferInfo(offerInfo);
  if (!noteState.hasNote) return;

  const imageContainer = offerElement.querySelector('[class*="photo-slider-root"]') || offerElement;
  if (getComputedStyle(imageContainer).position === "static") {
    imageContainer.style.position = "relative";
  }

  const indicator = document.createElement("div");
  indicator.className = "ave-note-indicator";
  indicator.title = getOfferNoteIndicatorTitle(offerInfo);
  indicator.textContent = noteState.offerHasNote && noteState.userHasNote ? "2 заметки" : "Заметка";
  imageContainer.appendChild(indicator);
}

function getCachedReservedStatus(offerId) {
  if (!offerId || !reservedStatusCache.has(offerId)) return undefined;
  return reservedStatusCache.get(offerId);
}

async function checkOfferReserved(offerId) {
  if (!offerId) return null;
  if (reservedStatusCache.has(offerId)) {
    return reservedStatusCache.get(offerId);
  }
  if (reservedRequestCache.has(offerId)) {
    return reservedRequestCache.get(offerId);
  }

  const requestPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RESERVED_CHECK_TIMEOUT_MS);
    try {
      const response = await fetch(`https://www.avito.ru/web/1/delivery/conditions/${offerId}/buyer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.warn(`${logPrefix} Не удалось проверить резерв для ${offerId}: HTTP ${response.status}`);
        setReservedStatusCache(offerId, null);
        return null;
      }

      const data = await response.json();
      const isReserved = data?.reserved === true;
      setReservedStatusCache(offerId, isReserved);
      if (RESERVED_TEST_MODE_LOGS) {
        console.log(`${logPrefix} [reserve-test] ${offerId}: ${isReserved ? "В резерве" : "Активно"}`);
      }
      return isReserved;
    } catch (error) {
      console.warn(`${logPrefix} Ошибка проверки резерва для ${offerId}:`, error);
      setReservedStatusCache(offerId, null);
      if (RESERVED_TEST_MODE_LOGS) {
        console.log(`${logPrefix} [reserve-test] ${offerId}: статус не определен`);
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
      reservedRequestCache.delete(offerId);
    }
  })();

  reservedRequestCache.set(offerId, requestPromise);
  return requestPromise;
}

function applyOfferState(offerElement, offerInfo) {
  const normalizedOfferInfo = {
    offerId: offerInfo.offerId,
    userId: offerInfo.userId,
    isReserved: null,
  };
  if (!hideReservedEnabled || !offerInfo.offerId) {
    updateOfferState(offerElement, normalizedOfferInfo);
    return;
  }

  const cachedReservedStatus = getCachedReservedStatus(offerInfo.offerId);
  normalizedOfferInfo.isReserved = cachedReservedStatus === undefined ? null : cachedReservedStatus;
  updateOfferState(offerElement, normalizedOfferInfo);

  if (cachedReservedStatus === undefined) {
    checkOfferReserved(offerInfo.offerId).then((isReserved) => {
      updateOfferState(offerElement, {
        offerId: offerInfo.offerId,
        userId: offerInfo.userId,
        isReserved,
      });
    });
  }
}

function updateOfferState(offerElement, offerInfo) {
  const hiddenContainer = createHiddenContainer();
  const offerId = offerInfo?.offerId;

  if (isHiddenOriginal(offerElement)) {
    const existingClone = findHiddenCloneByOfferId(offerId);
    if (existingClone) {
      offerElement = existingClone;
    } else {
      offerElement.removeAttribute(HIDDEN_ORIGINAL_ATTR);
      offerElement.style.display = "";
    }
  }

  const offerIsHiddenClone = isHiddenClone(offerElement) && hiddenContainer.contains(offerElement);
  const userIsBlacklisted = offerInfo?.userId && blacklistUsers.includes(offerInfo.userId + "_blacklist_user");
  const offerIsBlacklisted = offerId && blacklistOffers.includes(offerId + "_blacklist_ad");

  const isFromCurrentCity = isOfferFromCurrentCity(offerElement);
  const shouldHideByCity = cityFilterEnabled && !isFromCurrentCity;
  const shouldHideByReserved = hideReservedEnabled && offerInfo?.isReserved === true;
  const hideReason = getHiddenReason({
    userIsBlacklisted,
    offerIsBlacklisted,
    shouldHideByReserved,
    shouldHideByCity,
  });

  const shouldHide = userIsBlacklisted || offerIsBlacklisted || shouldHideByReserved || shouldHideByCity;

  if (!offerIsHiddenClone && shouldHide) {
    const existingClone = findHiddenCloneByOfferId(offerId);
    if (existingClone) {
      offerElement = existingClone;
    } else if (offerElement.style.display === "none" && findHiddenCloneByOfferId(offerId)) {
      return;
    } else {
      const offerElementClone = offerElement.cloneNode(true);
      offerElementClone.setAttribute(HIDDEN_CLONE_ATTR, "true");
      offerElement.setAttribute(HIDDEN_ORIGINAL_ATTR, "true");
      offerElement.style.display = "none";
      dedupeHiddenClones(offerId);
      hiddenContainer.appendChild(offerElementClone);
      offerElement = offerElementClone;
      console.log(`${logPrefix} объявление ${offerId} скрыто (${hideReason?.logLabel || "фильтр"})`);
    }
  } else if (offerIsHiddenClone && !shouldHide) {
    offerElement.remove();
    const original = findHiddenOriginalByOfferId(offerId);
    if (original) {
      original.removeAttribute(HIDDEN_ORIGINAL_ATTR);
      original.style.display = "";
      offerElement = original;
    } else {
      offerElement = null;
    }
  }

  if (!offerElement) return;
  setHiddenReasonBadge(offerElement, shouldHide ? hideReason : null);
  setOfferNoteIndicator(offerElement, offerInfo);

  const buttonContainer = offerElement.querySelector(".button-container");
  if (buttonContainer) buttonContainer.remove();
  if (offerInfo.userId) {
    userIsBlacklisted ? insertUnblockSellerButton(offerElement, offerInfo) : insertBlockSellerButton(offerElement, offerInfo);
  }
  offerIsBlacklisted ? insertUnblockOfferButton(offerElement, offerInfo) : insertBlockOfferButton(offerElement, offerInfo);
}

function processOfferElement(offerElement) {
  const offerId = getOfferId(offerElement);
  const currentOfferData = getCatalogItemByOfferId(offerId);
  let userId = null;

  try {
    userId = extractUserIdFromCatalogItem(currentOfferData);
    if (!userId) {
      userId = extractUserIdFromOfferElement(offerElement);
    }
  } catch (error) {
    console.warn(`${logPrefix} Error extracting userId:`, error);
    userId = undefined;
  } finally {
    applyOfferState(offerElement, { offerId, userId });
  }
}

function processSearchPageNow() {
  if (!catalogData) return;
  dedupeAllHiddenClones();
  pruneReservedCaches();

  const offerElements = document.querySelectorAll(offersSelector);
  for (const offerElement of offerElements) {
    if (isHiddenOriginal(offerElement)) continue;
    processOfferElement(offerElement);
  }
}

function processSearchPage() {
  clearTimeout(processSearchPageTimeout);
  processSearchPageTimeout = setTimeout(processSearchPageNow, PROCESS_SEARCH_DEBOUNCE_MS);
}

// ==================== RECOMMENDATIONS PAGE FUNCTIONALITY ====================

// Флаг для предотвращения повторной обработки
let isProcessingRecommendations = false;
let recommendationsDebounceTimeout = null;

function insertRecommendationButtons(offerElement, offerId) {
  // Проверяем, не добавлены ли уже кнопки
  if (offerElement.querySelector(".recommendation-button-container")) return;

  // Создаем контейнер для кнопки
  const buttonContainer = document.createElement("div");
  buttonContainer.classList.add("recommendation-button-container");
  buttonContainer.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 10;
    display: flex;
    gap: 4px;
  `;

  // Устанавливаем position: relative для родителя, если ещё не установлено
  const cardElement = offerElement.querySelector(recommendationsCardSelector) || offerElement;
  if (cardElement && getComputedStyle(cardElement).position === 'static') {
    cardElement.style.position = 'relative';
  }

  // Кнопка блокировки
  const blockButton = document.createElement("div");
  blockButton.title = "Скрыть это объявление";
  blockButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="custom-button block block-item-button" role="img" aria-label="eye x" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path>
      <path d="M13.048 17.942a9.298 9.298 0 0 1 -1.048 .058c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6a17.986 17.986 0 0 1 -1.362 1.975"></path>
      <path d="M22 22l-5 -5"></path>
      <path d="M17 22l5 -5"></path>
    </svg>`;
  blockButton.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    addOfferToBlacklist(offerId);
    // Просто удаляем элемент со страницы
    offerElement.remove();
    console.log(`${logPrefix} рекомендация ${offerId} скрыта и удалена`);
  });
  buttonContainer.appendChild(blockButton);

  // Вставляем кнопки в карточку
  if (cardElement) {
    cardElement.appendChild(buttonContainer);
  } else {
    offerElement.appendChild(buttonContainer);
  }
}

function processRecommendationsPage() {
  if (!isHomePage()) return;
  
  // Защита от повторного вызова
  if (isProcessingRecommendations) return;
  isProcessingRecommendations = true;

  console.log(`${logPrefix} Обработка раздела рекомендаций`);
  
  // Находим все элементы рекомендаций по классу js-item-XXXXXXX
  const recommendationElements = document.querySelectorAll(recommendationsItemSelector);
  
  let processedCount = 0;
  let hiddenCount = 0;
  
  for (const element of recommendationElements) {
    // Пропускаем уже обработанные элементы
    if (element.hasAttribute("data-recommendation-processed")) continue;
    
    const offerId = getRecommendationOfferId(element);
    if (offerId) {
      const offerIsBlacklisted = blacklistOffers.includes(offerId + "_blacklist_ad");
      
      if (offerIsBlacklisted) {
        // Удаляем заблокированное объявление со страницы
        element.remove();
        hiddenCount++;
        console.log(`${logPrefix} рекомендация ${offerId} удалена (в блеклисте)`);
      } else {
        // Добавляем кнопку блокировки
        insertRecommendationButtons(element, offerId);
        element.setAttribute("data-recommendation-processed", "true");
        processedCount++;
      }
    }
  }
  
  console.log(`${logPrefix} Обработано ${processedCount} рекомендаций, скрыто ${hiddenCount}`);
  
  // Сбрасываем флаг через небольшую задержку
  setTimeout(() => {
    isProcessingRecommendations = false;
  }, 100);
}

// Проверка наличия кнопок блокировки на странице профиля
function hasProfilePageButtons() {
  return document.querySelector('.profile-page-blacklist-container') !== null;
}

// Поиск контейнера для вставки кнопок на странице профиля
function findProfileButtonsInsertPoint() {
  const sidebar = document.querySelector(sellerPageSidebarSelector);
  if (!sidebar) return null;
  
  // Ищем блок с кнопкой "Подписаться"
  const subscribeBlock = sidebar.querySelector('[class*="SubscribeInfo-module-subscribe"]');
  if (subscribeBlock) {
    return subscribeBlock.parentElement;
  }
  
  // Ищем блок с кнопками контактов (Написать, Показать телефон)
  const contactBar = sidebar.querySelector('[class*="ContactBar-module-controls"]');
  if (contactBar) {
    return contactBar.parentElement;
  }
  
  // Fallback: вставляем в конец sidebar
  return sidebar;
}

// Создание контейнера для кнопок на странице профиля
function createProfileButtonsContainer() {
  const container = document.createElement('div');
  container.className = 'profile-page-blacklist-container';
  return container;
}

// Создание кнопки блокировки/разблокировки для страницы профиля
function createProfilePageButton(text, isBlock, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = isBlock ? 'item-page-block-btn' : 'item-page-unblock-btn';
  button.innerHTML = `<span class="item-page-btn-wrapper"><span class="item-page-btn-text">${text}</span></span>`;
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  });
  return button;
}

function renderProfileNote(container, userId) {
  if (!container || !userId) return;
  createNoteBlock({
    container,
    entityType: "user",
    entityId: userId,
    label: "Заметка о продавце",
    getMetadata: () => ({
      displayName: getProfileSellerName(),
    }),
  });
}

function insertBlockedSellerUI(userId) {
  if (hasProfilePageButtons()) {
    // Обновляем существующие кнопки
    updateProfilePageButtons(userId);
    return;
  }

  const insertPoint = findProfileButtonsInsertPoint();
  if (!insertPoint) {
    console.log(`${logPrefix} Точка вставки кнопок не найдена на странице профиля`);
    return;
  }

  // Создаем контейнер
  const container = createProfileButtonsContainer();

  // Добавляем бейдж "В черном списке"
  const sidebar = document.querySelector(sellerPageSidebarSelector);
  const firstBadge = sidebar?.querySelector(`[class^="ProfileBadge-"]`);
  if (firstBadge) {
    const badgeBar = firstBadge.parentElement;
    const badgeHtml = '<div class="ProfileBadge-root-bcR8G ProfileBadge-cloud-vOPD1 ProfileBadge-activatable-_4_K8 bad_badge" style="--badge-font-color:#000000;--badge-bgcolor:#f8cbcb;--badge-hover-bgcolor:#fd8181" data-marker="badge-blacklisted">❌ Пользователь в ЧС</div>';
    badgeBar.insertAdjacentHTML("beforeend", badgeHtml);
  }

  // Создаем кнопку разблокировки
  const unblockButton = createProfilePageButton('Разблокировать продавца', false, () => {
    removeUserFromBlacklist(userId);
    // Удаляем бейдж
    const badge = sidebar?.querySelector('.bad_badge');
    if (badge) badge.remove();
    // Удаляем контейнер с кнопками
    container.remove();
    // Вставляем кнопку блокировки
    insertSellerUI(userId);
  });
  
  container.appendChild(unblockButton);
  renderProfileNote(container, userId);
  insertPoint.appendChild(container);
  console.log(`${logPrefix} Кнопка разблокировки добавлена на страницу профиля`);
}

function insertSellerUI(userId) {
  if (hasProfilePageButtons()) {
    // Обновляем существующие кнопки
    updateProfilePageButtons(userId);
    return;
  }

  const insertPoint = findProfileButtonsInsertPoint();
  if (!insertPoint) {
    console.log(`${logPrefix} Точка вставки кнопок не найдена на странице профиля`);
    return;
  }

  // Создаем контейнер
  const container = createProfileButtonsContainer();

  // Создаем кнопку блокировки
  const blockButton = createProfilePageButton('Заблокировать продавца', true, () => {
    addUserToBlacklist(userId);
    // Удаляем контейнер с кнопками
    container.remove();
    // Вставляем кнопку разблокировки
    insertBlockedSellerUI(userId);
  });
  
  container.appendChild(blockButton);
  renderProfileNote(container, userId);
  insertPoint.appendChild(container);
  console.log(`${logPrefix} Кнопка блокировки добавлена на страницу профиля`);
}

// Обновление кнопок на странице профиля
function updateProfilePageButtons(userId) {
  const container = document.querySelector('.profile-page-blacklist-container');
  if (!container) return;

  const userIsBlacklisted = blacklistUsers.includes(userId + "_blacklist_user");
  
  // Удаляем старые кнопки
  container.innerHTML = '';

  if (userIsBlacklisted) {
    const unblockButton = createProfilePageButton('Разблокировать продавца', false, () => {
      removeUserFromBlacklist(userId);
      const sidebar = document.querySelector(sellerPageSidebarSelector);
      const badge = sidebar?.querySelector('.bad_badge');
      if (badge) badge.remove();
      updateProfilePageButtons(userId);
    });
    container.appendChild(unblockButton);
  } else {
    const blockButton = createProfilePageButton('Заблокировать продавца', true, () => {
      addUserToBlacklist(userId);
      updateProfilePageButtons(userId);
    });
    container.appendChild(blockButton);
  }

  renderProfileNote(container, userId);
}

function processSellerPage(userId) {
  const searchId = userId + "_blacklist_user";
  if (blacklistUsers.includes(searchId)) {
    insertBlockedSellerUI(userId);
  } else {
    insertSellerUI(userId);
  }
}

function getCatalogDataFromInit(initialData) {
  // Проверяем существование необходимых свойств
  if (!initialData || !initialData.data || !initialData.data.catalog) {
    console.warn(`${logPrefix} Неверная структура initialData:`, initialData);
    return [];
  }
  
  const catalogItems = initialData.data.catalog.items || [];
  const extraItems = initialData.data.catalog.extraBlockItems || [];
  let allItems = catalogItems.concat(extraItems);
  allItems = allItems.filter((item) => item.hasOwnProperty("categoryId"));
  return allItems;
}

// Альтернативный способ получения данных каталога из DOM
function getCatalogDataFromDOM() {
  console.log(`${logPrefix} Попытка получения данных каталога из DOM`);
  
  const catalogData = [];
  
  // Способ 1: Извлечение данных из элементов с data-item-id
  const offerElements = document.querySelectorAll('[data-item-id]');
  offerElements.forEach(element => {
    const offerId = element.getAttribute('data-item-id');
    if (offerId) {
      // Извлекаем информацию из DOM элемента
      const titleElement = element.querySelector('[data-marker="item-title"]');
      const priceElement = element.querySelector('[data-marker="item-price"]');
      const sellerElement = element.querySelector('[data-marker="seller-info/summary"]');
      const sellerLinkElement = element.querySelector('a[href*="/user/"]') || 
                               element.querySelector('a[href*="/brands/"]');
      
      // Получаем ссылку на объявление
      const offerLinkElement = element.querySelector('a[href*="/predlozheniya_uslug/"]');
      const offerUrl = offerLinkElement ? offerLinkElement.href : '';
      
      // Извлекаем ID продавца из ссылки (поддерживаем и /user/ и /brands/)
      let userId = null;
      if (sellerLinkElement) {
        const sellerHref = sellerLinkElement.href;
        const userMatch = sellerHref.match(/\/user\/([^\/]+)/);
        const brandMatch = sellerHref.match(/\/brands\/([^\/]+)/);
        
        if (userMatch) {
          userId = userMatch[1].split('?')[0]; // Убираем параметры после ?
        } else if (brandMatch) {
          // Для брендов используем ID бренда
          userId = brandMatch[1].split('?')[0]; // Убираем параметры после ?
        }
      }
      
      catalogData.push({
        id: parseInt(offerId),
        title: titleElement?.textContent?.trim() || '',
        price: priceElement?.textContent?.trim() || '',
        seller: sellerElement?.textContent?.trim() || '',
        url: offerUrl,
        userId: userId,
        // Создаем минимальную структуру для совместимости
        iva: {
          UserInfoStep: [{
            payload: {
              profile: {
                link: sellerLinkElement?.href || ''
              }
            }
          }]
        }
      });
    }
  });
  
  // Способ 2: Если не нашли элементы с data-item-id, пробуем из ссылок
  if (catalogData.length === 0) {
    const offerLinks = document.querySelectorAll('a[href*="/predlozheniya_uslug/"]');
    offerLinks.forEach(link => {
      const href = link.href;
      const match = href.match(/\/predlozheniya_uslug\/(\d+)/);
      if (match) {
        const offerId = match[1];
        const offerElement = link.closest('[class*="iva-item"]');
        
        if (offerElement) {
          const titleElement = offerElement.querySelector('[data-marker="item-title"]') || 
                              offerElement.querySelector('h2') || 
                              offerElement.querySelector('[class*="title"]');
          const priceElement = offerElement.querySelector('[data-marker="item-price"]') || 
                              offerElement.querySelector('[class*="price"]');
          const sellerElement = offerElement.querySelector('[data-marker="seller-info/summary"]') || 
                               offerElement.querySelector('[class*="seller"]');
          const sellerLinkElement = offerElement.querySelector('a[href*="/user/"]') || 
                                   offerElement.querySelector('a[href*="/brands/"]');
          
          let userId = null;
          if (sellerLinkElement) {
            const sellerHref = sellerLinkElement.href;
            const userMatch = sellerHref.match(/\/user\/([^\/]+)/);
            const brandMatch = sellerHref.match(/\/brands\/([^\/]+)/);
            
            if (userMatch) {
              userId = userMatch[1].split('?')[0]; // Убираем параметры после ?
            } else if (brandMatch) {
              userId = brandMatch[1].split('?')[0]; // Убираем параметры после ?
            }
          }
          
          catalogData.push({
            id: parseInt(offerId),
            title: titleElement?.textContent?.trim() || '',
            price: priceElement?.textContent?.trim() || '',
            seller: sellerElement?.textContent?.trim() || '',
            url: href,
            userId: userId,
            iva: {
              UserInfoStep: [{
                payload: {
                  profile: {
                    link: sellerLinkElement?.href || ''
                  }
                }
              }]
            }
          });
        }
      }
    });
  }
  
  console.log(`${logPrefix} Найдено ${catalogData.length} объявлений в DOM`);
  return catalogData;
}

// Способ получения данных из window.__preloadedState__
function getCatalogDataFromPreloadedState() {
  console.log(`${logPrefix} Попытка получения данных из window.__preloadedState__`);
  
  try {
    if (window.__preloadedState__) {
      const preloadedState = typeof window.__preloadedState__ === 'string' 
        ? JSON.parse(decodeURIComponent(window.__preloadedState__))
        : window.__preloadedState__;
      
      console.log(`${logPrefix} __preloadedState__ найден:`, preloadedState);
      
      // Ищем данные каталога в различных местах
      if (preloadedState.catalog) {
        return getCatalogDataFromInit({ data: preloadedState });
      }
      
      // Ищем в других возможных местах
      if (preloadedState.data?.catalog) {
        return getCatalogDataFromInit(preloadedState);
      }
    }
  } catch (error) {
    console.warn(`${logPrefix} Ошибка парсинга __preloadedState__:`, error);
  }
  
  return [];
}

// Дополнительная функция для извлечения данных из элементов с data-marker="item"
function getCatalogDataFromItemMarkers() {
  console.log(`${logPrefix} Поиск данных из элементов с data-marker="item"`);
  
  const catalogData = [];
  const itemElements = document.querySelectorAll('[data-marker="item"]');
  
  itemElements.forEach(element => {
    const offerId = element.getAttribute('data-item-id');
    if (offerId) {
      // Извлекаем информацию из различных селекторов
      const titleElement = element.querySelector('[data-marker="item-title"]') || 
                          element.querySelector('h2[itemprop="name"]') ||
                          element.querySelector('h2');
      const priceElement = element.querySelector('[data-marker="item-price"]') || 
                          element.querySelector('[itemprop="offers"]') ||
                          element.querySelector('[class*="price"]');
      const sellerElement = element.querySelector('[data-marker="seller-info/summary"]') || 
                           element.querySelector('[class*="seller"]');
      const sellerLinkElement = element.querySelector('a[href*="/user/"]') || 
                               element.querySelector('a[href*="/brands/"]');
      
      // Получаем ссылку на объявление
      const offerLinkElement = element.querySelector('a[href*="/predlozheniya_uslug/"]');
      const offerUrl = offerLinkElement ? offerLinkElement.href : '';
      
      // Извлекаем ID продавца из ссылки (поддерживаем и /user/ и /brands/)
      let userId = null;
      if (sellerLinkElement) {
        const sellerHref = sellerLinkElement.href;
        const userMatch = sellerHref.match(/\/user\/([^\/]+)/);
        const brandMatch = sellerHref.match(/\/brands\/([^\/]+)/);
        
        if (userMatch) {
          userId = userMatch[1].split('?')[0]; // Убираем параметры после ?
        } else if (brandMatch) {
          // Для брендов используем ID бренда
          userId = brandMatch[1].split('?')[0]; // Убираем параметры после ?
        }
      }
      
      catalogData.push({
        id: parseInt(offerId),
        title: titleElement?.textContent?.trim() || '',
        price: priceElement?.textContent?.trim() || '',
        seller: sellerElement?.textContent?.trim() || '',
        url: offerUrl,
        userId: userId,
        iva: {
          UserInfoStep: [{
            payload: {
              profile: {
                link: sellerLinkElement?.href || ''
              }
            }
          }]
        }
      });
    }
  });
  
  console.log(`${logPrefix} Найдено ${catalogData.length} элементов с data-marker="item"`);
  return catalogData;
}

// Комбинированный способ получения данных каталога
function getCatalogDataAlternative() {
  console.log(`${logPrefix} Попытка альтернативного получения данных каталога`);
  
  // Способ 1: Из элементов с data-marker="item"
  let catalogData = getCatalogDataFromItemMarkers();
  
  // Способ 2: Из DOM элементов с data-item-id
  if (catalogData.length < 5) {
    const domData = getCatalogDataFromDOM();
    if (domData.length > catalogData.length) {
      catalogData = domData;
    }
  }
  
  // Способ 3: Из window.__preloadedState__
  if (catalogData.length < 5) {
    const preloadedData = getCatalogDataFromPreloadedState();
    if (preloadedData.length > catalogData.length) {
      catalogData = preloadedData;
    }
  }
  
  // Способ 4: Извлечение из всех скриптов на странице
  if (catalogData.length < 5) {
    const scriptData = getCatalogDataFromScripts();
    if (scriptData.length > catalogData.length) {
      catalogData = scriptData;
    }
  }
  
  console.log(`${logPrefix} Итого получено ${catalogData.length} элементов каталога`);
  return catalogData;
}

// Поиск данных каталога во всех скриптах
function getCatalogDataFromScripts() {
  console.log(`${logPrefix} Поиск данных каталога в скриптах`);
  
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    try {
      const content = script.textContent;
      
      // Ищем различные паттерны данных
      if (content.includes('catalog') && content.includes('items')) {
        // Пробуем найти JSON данные
        const jsonMatch = content.match(/\{.*"catalog".*"items".*\}/s);
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[0]);
            if (data.catalog && data.catalog.items) {
              console.log(`${logPrefix} Найдены данные каталога в скрипте`);
              return getCatalogDataFromInit({ data });
            }
          } catch (e) {
            // Игнорируем ошибки парсинга
          }
        }
      }
    } catch (error) {
      // Игнорируем ошибки
    }
  }
  
  return [];
}

function decodeHtmlEntities(str) {
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}

async function getDataNodeContent() {
  const response = await fetch(window.location.href);
  const html = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const scripts = doc.querySelectorAll("script");
  for (const script of scripts) {
    if (script.textContent.includes("abCentral") && script.textContent.trim().startsWith("{")) {
      return script.textContent;
    }
  }

  console.warn(`${logPrefix} dataNodeContent не найден на старнице`);
}

async function main() {
  const currentUrl = window.location.toString();
  const userPageStrings = ["www.avito.ru/user/", "sellerId", "brands"];
  const isUserPage = userPageStrings.some((str) => currentUrl.includes(str));
  const isHomePageFlag = isHomePage();
  const isItemPageFlag = isItemPage();
  
  if (isUserPage) {
    console.log(`${logPrefix} страница определена: продавец`);
    // Отложенная обработка страницы продавца после загрузки DOM
    // Используем ID из URL напрямую, не дожидаясь __initialData__
    const sellerIdFromUrl = getSellerIdFromUrl();
    if (sellerIdFromUrl) {
      setTimeout(() => {
        processSellerPage(sellerIdFromUrl);
      }, 500);
    }
  } else if (isItemPageFlag) {
    console.log(`${logPrefix} страница определена: товар`);
    // Отложенная обработка страницы товара после загрузки DOM
    setTimeout(() => {
      processItemPage();
    }, 500);
  } else if (isHomePageFlag) {
    console.log(`${logPrefix} страница определена: главная (рекомендации)`);
    // Отложенная обработка рекомендаций после загрузки DOM
    setTimeout(() => {
      processRecommendationsPage();
    }, 500);
  } else {
    console.log(`${logPrefix} страница определена: поиск`);
    await initPagination();
    
    // Добавляем переключатель фильтра по городу
    insertCityFilterToggle();
    insertHideReservedToggle();
    
    // Пробуем получить данные каталога альтернативным способом при загрузке
    if (!catalogData || catalogData.length === 0) {
      console.log(`${logPrefix} Пробуем получить данные каталога при инициализации`);
      setCatalogData(getCatalogDataAlternative());
      if (catalogData && catalogData.length > 0) {
        console.log(`${logPrefix} Данные каталога получены при инициализации: ${catalogData.length} элементов`);
        processSearchPage();
      }
    }
  }

  const target = document;
  let initialData;

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach(async function (node) {
          if (isUserPage) {
            // страница продавца
            if (
              node?.classList?.toString().includes("styles-module-theme-_4Zlk styles-module-theme-kvanA") ||
              node?.classList
                ?.toString()
                .includes(
                  "styles-module-flex-MLjHp styles-module-flex-col-_wNyN styles-module-child-width-fit-oDxVB styles-module-child-height-fit-LmDUR"
                ) ||
              (node?.classList
                ?.toString()
                .includes(
                  "styles-module-flex-MLjHp styles-module-flex-col-_wNyN styles-module-child-width-full-bPGg_ styles-module-child-height-fit-LmDUR styles-module-align-start-rasRB styles-module-max-w-full-hU4Na"
                ) &&
                node.querySelector(`[class^="ProfileBadge-root-"]`))
            ) {
              console.log(`${logPrefix} страница продавца обновлена`);
              // Используем ID из URL как основной источник, initialData как fallback
              let userId = getSellerIdFromUrl();
              if (!userId && initialData) {
                userId = getSellerId(initialData);
              }
              if (userId) {
                processSellerPage(userId);
              }
            }
            if (node?.nodeName === "SCRIPT" && node?.textContent?.includes("__initialData__")) {
              const initialDataContent = node.textContent;
              initialData = parseInitialData(initialDataContent);
              console.log(`${logPrefix} initialData найден`, initialData);
              // Используем ID из URL как основной источник
              let userId = getSellerIdFromUrl();
              if (!userId) {
                userId = getSellerId(initialData);
              }
              if (userId) {
                processSellerPage(userId);
              }
            }
            // Обработка появления sidebar с кнопками
            if (node instanceof Element) {
              const hasSidebar = node.querySelector && (
                node.querySelector(sellerPageSidebarSelector) ||
                node.querySelector('[class*="SubscribeInfo-module-subscribe"]') ||
                node.querySelector('[class*="ContactBar-module-controls"]')
              );
              if (hasSidebar) {
                console.log(`${logPrefix} обнаружен sidebar на странице продавца`);
                const userId = getSellerIdFromUrl();
                if (userId) {
                  processSellerPage(userId);
                }
              }
            }
          } else if (isItemPageFlag) {
            // страница товара
            if (node instanceof Element) {
              // Проверяем, появился ли контейнер с кнопками контактов
              const hasContactBar = node.querySelector && (
                node.querySelector('[data-marker="item-view/item-view-contacts"]') ||
                node.querySelector('[data-marker="item-phone-button/card"]') ||
                node.querySelector('[data-marker="messenger-button/button"]') ||
                node.querySelector('[class*="contact-bar__root"]') ||
                node.querySelector('[class*="style__contactBarOnly"]') ||
                node.classList?.toString().includes('contact-bar')
              );
              const hasInstallmentsBlock = node.querySelector && (
                node.querySelector('[data-marker="installments-promoblock"]') ||
                node.querySelector('[data-marker="installments-promoblock/button"]')
              );
              // Или появилась информация о продавце
              const hasSellerInfo = node.querySelector && (
                node.querySelector('[data-marker="sellerInfo"]') ||
                node.querySelector('[data-marker="item-view/seller-info"]') ||
                node.querySelector('[data-marker="seller-link/link"]') ||
                node.querySelector('[data-marker="seller-info/name"]')
              );
              if (hasContactBar || hasSellerInfo || hasInstallmentsBlock) {
                console.log(`${logPrefix} обнаружен контейнер контактов или информация о продавце`);
                updateInstallmentsVisibility();
                processItemPage();
              }
            }
          } else if (isHomePageFlag) {
            // главная страница - раздел рекомендаций
            if (node instanceof Element) {
              // Проверяем, содержит ли добавленный узел элементы рекомендаций
              const hasRecommendations = node.querySelector && (
                node.querySelector(recommendationsItemSelector) ||
                node.querySelector(recommendationsCardSelector) ||
                node.classList?.toString().includes('js-item-')
              );
              if (hasRecommendations) {
                // Используем debounce чтобы не вызывать слишком часто
                clearTimeout(recommendationsDebounceTimeout);
                recommendationsDebounceTimeout = setTimeout(() => {
                  console.log(`${logPrefix} обнаружены новые рекомендации`);
                  processRecommendationsPage();
                }, 300);
              }
            }
          } else {
            // страница поиска
            if (node instanceof Element && node?.getAttribute("elementtiming") === offersRootSelectorValue) {
              console.log(`${logPrefix} offersRootSelector обновлен`);
              // Пробуем добавить переключатель при обновлении DOM
              insertCityFilterToggle();
              insertHideReservedToggle();
              if (!catalogData) return;
              processSearchPage();
            }
            if (node?.classList?.toString().includes("styles-singlePageWrapper")) {
              console.log(`${logPrefix} singlePageWrapper обновлен`);
              // Пробуем добавить переключатель при обновлении DOM
              insertCityFilterToggle();
              insertHideReservedToggle();
              if (!catalogData) return;
              processSearchPage();
            }
            // Проверяем появление верхней панели с фильтрами
            if (node instanceof Element && node?.classList?.toString().includes("index-topPanel-")) {
              console.log(`${logPrefix} Верхняя панель обнаружена`);
              insertCityFilterToggle();
              insertHideReservedToggle();
            }
            if (node instanceof HTMLScriptElement && node?.textContent?.includes("abCentral") && node?.textContent?.startsWith("{")) {
              try {
                let dataNodeContent = node.textContent;
                if (!dataNodeContent?.endsWith("}")) {
                  console.log(`${logPrefix} Ошибка парсинга dataNodeContent с текущей старницы, пробуем альтернативный вариант`);
                  dataNodeContent = await getDataNodeContent();
                }

                const decodedJson = decodeHtmlEntities(dataNodeContent);
                const initialData = JSON.parse(decodedJson);
                setCatalogData(getCatalogDataFromInit(initialData));
                console.log(`${logPrefix} catalogData получен: ${catalogData.length} элементов`);
                if (catalogData && catalogData.length > 0) {
                  processSearchPage();
                } else {
                  console.warn(`${logPrefix} catalogData пуст или не найден, пробуем альтернативные способы`);
                  setCatalogData(getCatalogDataAlternative());
                  if (catalogData && catalogData.length > 0) {
                    console.log(`${logPrefix} Данные получены альтернативным способом: ${catalogData.length} элементов`);
                    processSearchPage();
                  } else {
                    console.warn(`${logPrefix} Не удалось получить данные каталога никаким способом`);
                  }
                }
              } catch (error) {
                console.error("Error processing catalog data:", error);
                console.log(`${logPrefix} Пробуем альтернативные способы получения данных`);
                setCatalogData(getCatalogDataAlternative());
                if (catalogData && catalogData.length > 0) {
                  console.log(`${logPrefix} Данные получены альтернативным способом после ошибки: ${catalogData.length} элементов`);
                  processSearchPage();
                }
              }
            }
          }
        });
      }
    });
  });

  // Configuration of the observer:
  const config = { attributes: false, childList: true, subtree: true };

  // Start observing the target node for configured mutations
  observer.observe(target, config);
}

async function load_arrays() {
  blacklistUsers = await syncGet("blacklistUsers");
  blacklistOffers = await syncGet("blacklistOffers");
  await loadNotes();
}

let isPaginationEnabled = false;
let cityFilterEnabled = false;
let hideReservedEnabled = false;
let hideInstallmentsEnabled = true;

browser.storage.local.get(["isPaginationEnabled", "isCityFilterEnabled", "isHideReservedEnabled", "isHideInstallmentsEnabled"], function (result) {
  if (result.isPaginationEnabled !== undefined) {
    isPaginationEnabled = result.isPaginationEnabled;
  }
  if (result.isCityFilterEnabled !== undefined) {
    cityFilterEnabled = result.isCityFilterEnabled;
  }
  if (result.isHideReservedEnabled !== undefined) {
    hideReservedEnabled = result.isHideReservedEnabled;
  }
  if (result.isHideInstallmentsEnabled !== undefined) {
    hideInstallmentsEnabled = result.isHideInstallmentsEnabled;
  } else {
    hideInstallmentsEnabled = true;
  }
  // Отложенное обновление визуального состояния переключателей,
  // т.к. DOM может быть ещё не готов при загрузке storage
  setTimeout(() => {
    updateCityFilterToggleState();
    updateHideReservedToggleState();
    updateInstallmentsVisibility();
  }, 100);
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  let shouldRefreshNotes = false;
  if (changes[NOTES_USERS_KEY]) {
    notesUsers = sanitizeNotesMap(changes[NOTES_USERS_KEY].newValue);
    shouldRefreshNotes = true;
  }
  if (changes[NOTES_OFFERS_KEY]) {
    notesOffers = sanitizeNotesMap(changes[NOTES_OFFERS_KEY].newValue);
    shouldRefreshNotes = true;
  }
  if (changes.isHideInstallmentsEnabled) {
    hideInstallmentsEnabled = changes.isHideInstallmentsEnabled.newValue !== undefined
      ? changes.isHideInstallmentsEnabled.newValue
      : true;
    if (isItemPage()) {
      updateInstallmentsVisibility();
    }
  }

  if (shouldRefreshNotes) {
    refreshAllNoteBlocks();
    const isSearchPage = !isUserProfilePage() && !isItemPage() && !isHomePage();
    if (isSearchPage && catalogData) {
      processSearchPage();
    }
  }
});

browser.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === "updatePaginationState") {
    isPaginationEnabled = request.isEnabled;
    if (isPaginationEnabled) {
      checkPaginationVisibility();
    }
  }
  if (request.action === "updateCityFilterState") {
    cityFilterEnabled = request.isEnabled;
    // Обновляем визуальное состояние переключателя
    updateCityFilterToggleState();
    // Переобрабатываем страницу для применения фильтра
    processSearchPage();
  }
  if (request.action === "updateHideReservedState") {
    hideReservedEnabled = request.isEnabled;
    updateHideReservedToggleState();
    processSearchPage();
  }
  if (request.action === "updateHideInstallmentsState") {
    hideInstallmentsEnabled = request.isEnabled;
    if (isItemPage()) {
      updateInstallmentsVisibility();
      processItemPage();
    }
  }
});

let catalogData;
let isLoading = false;
let checkTimeout;
let processSearchPageTimeout;
let autoPaginationPagesLoaded = 0;
let autoPaginationItemsLoaded = 0;
let blacklistUsers = [];
let blacklistOffers = [];
let notesUsers = {};
let notesOffers = {};
let noteBlockControllers = new Map();
let reservedStatusCache = new Map();
let reservedRequestCache = new Map();

load_arrays().finally(() => {
  main();
});
