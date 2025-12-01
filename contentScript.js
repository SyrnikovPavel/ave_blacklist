const offersRootSelectorValue = "bx.catalog.container";
const offersRootSelector = `[elementtiming="${offersRootSelectorValue}"]`;
const offersSelector = '[data-marker="item"]';
const logPrefix = "[ave]";

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

// Вставка кнопок на страницу товара
function insertItemPageButtons(offerId, sellerId) {
  // Проверяем, не добавлены ли уже кнопки
  if (hasItemPageButtons()) {
    // Обновляем существующие кнопки
    updateItemPageButtons(offerId, sellerId);
    return;
  }

  // Ищем контейнер с кнопками "Показать телефон" и "Написать"
  const contactBar = document.querySelector('[class*="contact-bar__root"]') || 
                     document.querySelector('[class*="style__contactBarOnly"]');
  
  if (!contactBar) {
    console.log(`${logPrefix} Контейнер contact-bar не найден на странице товара`);
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

  // Вставляем контейнер после основных кнопок
  contactBar.appendChild(container);
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
}

// Основная функция обработки страницы товара
function processItemPage() {
  if (!isItemPage()) return;

  const offerId = getItemPageOfferId();
  const sellerId = getItemPageSellerId();

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
    // Process the new offer
    const offerId = getOfferId(clone);
    const currentOfferData = catalogData.find((item) => item.id === Number(offerId));
    let userId = null;
    try {
      // Если у нас есть userId напрямую из данных каталога
      if (currentOfferData?.userId) {
        userId = currentOfferData.userId;
      } else {
        // Пробуем извлечь из структуры iva
        const sellerUrl = currentOfferData?.iva?.UserInfoStep[0]?.payload?.profile?.link;
        if (sellerUrl) {
          const userMatch = sellerUrl.match(/\/user\/([^\/]+)/);
          const brandMatch = sellerUrl.match(/\/brands\/([^\/]+)/);
          
          if (userMatch) {
            userId = userMatch[1].split('?')[0]; // Убираем параметры после ?
          } else if (brandMatch) {
            userId = brandMatch[1].split('?')[0]; // Убираем параметры после ?
          }
        }
      }
      
      // Если не получилось из данных каталога, пробуем извлечь из DOM
      if (!userId) {
        const sellerLinkElement = clone.querySelector('a[href*="/user/"]') || 
                                 clone.querySelector('a[href*="/brands/"]');
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
      }
    } catch (error) {
      console.error("Error extracting userId:", error);
      userId = undefined;
    } finally {
      updateOfferState(clone, { offerId, userId });
    }
  });
}

async function fetchNextPage() {
  if (!isPaginationEnabled || isLoading) {
    console.log(`${logPrefix} Fetch aborted - script disabled or already loading`);
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

    // Find catalog data in the new page
    const scriptElements = doc.querySelectorAll("script");
    for (const script of scriptElements) {
      if (script.textContent.includes("abCentral") && !script.textContent.startsWith("window[")) {
        try {
          const initCatalogDataContent = script.textContent;
          const decodedJson = decodeHtmlEntities(initCatalogDataContent);
          const newInitialData = JSON.parse(decodedJson);
          const newCatalogData = getCatalogDataFromInit(newInitialData);
          // Merge new catalog data with existing
          catalogData = [...catalogData, ...newCatalogData];
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
          // Create new container if none exists
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
        }
      }
    }

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
  const label = document.querySelector('[data-marker="filters/cityOnly"]');
  if (!label) return;
  
  const checkbox = label.querySelector('input[type="checkbox"]');
  setToggleVisualState(checkbox, label, cityFilterEnabled);
}

// Создание UI переключателя "Только из [город]"
function insertCityFilterToggle() {
  // Проверяем, не добавлен ли уже переключатель
  const existingToggle = document.querySelector('[data-marker="filters/cityOnly"]');
  if (existingToggle) {
    // Обновляем состояние существующего переключателя
    updateCityFilterToggleState();
    return;
  }

  // Ищем панель с переключателем "Сначала из..."
  const topPanel = document.querySelector('[class*="index-topPanel-"]');
  if (!topPanel) {
    console.log(`${logPrefix} Верхняя панель не найдена для вставки переключателя города`);
    return;
  }

  // Ищем существующий переключатель "Сначала из..." для копирования структуры
  const existingToggleContainer = topPanel.querySelector('[data-marker="filters/localPriority/localPriority"]');
  if (!existingToggleContainer) {
    console.log(`${logPrefix} Существующий переключатель не найден`);
    return;
  }

  const cityName = getCityDisplayName();
  
  // Клонируем родительский контейнер переключателя
  const parentContainer = existingToggleContainer.closest('.styles-module-theme-CW0hC');
  if (!parentContainer) {
    console.log(`${logPrefix} Родительский контейнер не найден`);
    return;
  }

  const newContainer = parentContainer.cloneNode(true);
  
  // Настраиваем label
  const newLabel = newContainer.querySelector('label');
  if (newLabel) {
    newLabel.setAttribute('data-marker', 'filters/cityOnly');
  }
  
  // Изменяем текст
  const labelText = newContainer.querySelector('.filters-switcherLabel-vbkFI');
  if (labelText) {
    labelText.textContent = `Только из ${cityName}`;
  }

  // Настраиваем checkbox
  const checkbox = newContainer.querySelector('input[type="checkbox"]');
  if (checkbox) {
    checkbox.name = 'cityOnly';
    checkbox.value = 'cityOnly';
    checkbox.setAttribute('data-marker', 'filters/cityOnly/toggle');
    
    // Устанавливаем начальное визуальное состояние
    setToggleVisualState(checkbox, newLabel, cityFilterEnabled);
    
    // Обработчик изменения checkbox
    checkbox.addEventListener('change', function() {
      cityFilterEnabled = this.checked;
      setToggleVisualState(this, newLabel, cityFilterEnabled);
      browser.storage.local.set({ isCityFilterEnabled: cityFilterEnabled });
      console.log(`${logPrefix} Фильтр по городу: ${cityFilterEnabled ? 'включен' : 'выключен'}`);
      processSearchPage();
    });
  }

  // Вставляем новый переключатель после существующего
  parentContainer.after(newContainer);
  console.log(`${logPrefix} Переключатель "Только из ${cityName}" добавлен`);
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

function updateOfferState(offerElement, offerInfo) {
  const hiddenContainer = createHiddenContainer();
  const offerIsHidden = hiddenContainer.contains(offerElement);
  const userIsBlacklisted = offerInfo?.userId && blacklistUsers.includes(offerInfo.userId + "_blacklist_user");
  const offerIsBlacklisted = offerInfo?.offerId && blacklistOffers.includes(offerInfo.offerId + "_blacklist_ad");
  
  // Проверка фильтра по городу
  const isFromCurrentCity = isOfferFromCurrentCity(offerElement);
  const shouldHideByCity = cityFilterEnabled && !isFromCurrentCity;

  // Определяем, нужно ли скрыть объявление
  const shouldHide = userIsBlacklisted || offerIsBlacklisted || shouldHideByCity;

  if (!offerIsHidden && shouldHide) {
    // клонируем оригинальное объявление
    const offerElementClone = offerElement.cloneNode(true);
    // прячем оригинальное объявление
    offerElement.style.display = "none";
    // кладем клон в "скрытый" контейнер
    hiddenContainer.appendChild(offerElementClone);
    // переназначаем клон как offerElement, чтоб добавить к нему кнопки позже
    offerElement = offerElementClone;
    if (shouldHideByCity && !userIsBlacklisted && !offerIsBlacklisted) {
      console.log(`${logPrefix} объявление ${offerInfo.offerId} скрыто (другой город)`);
    } else {
      console.log(`${logPrefix} объявление ${offerInfo.offerId} скрыто`);
    }
  } else if (offerIsHidden && !shouldHide) {
    // удаляем объявление из скрытых
    offerElement.remove();
    // находим оригинальное "скрытое" объявление
    // переназначаем offerElement, чтоб добавить к нему кнопки позже
    offerElement = document.querySelector(`[data-item-id="${offerInfo.offerId}"]`);
    // показываем его
    if (offerElement) {
      offerElement.style.display = "block";
    }
  }

  // Если элемент не найден (уже удален), выходим
  if (!offerElement) return;

  // добавляем контейнер с кнопками
  const buttonContainer = offerElement.querySelector(".button-container");
  if (buttonContainer) buttonContainer.remove();
  if (offerInfo.userId) {
    userIsBlacklisted ? insertUnblockSellerButton(offerElement, offerInfo) : insertBlockSellerButton(offerElement, offerInfo);
  }
  offerIsBlacklisted ? insertUnblockOfferButton(offerElement, offerInfo) : insertBlockOfferButton(offerElement, offerInfo);
}

function processSearchPage() {
  const offerElements = document.querySelectorAll(offersSelector);
  for (const offerElement of offerElements) {
    const offerId = getOfferId(offerElement);
    const currentOfferData = catalogData.find((item) => item.id === Number(offerId));
    let userId = null;
    
    try {
      // Если у нас есть userId напрямую из данных каталога
      if (currentOfferData?.userId) {
        userId = currentOfferData.userId;
      } else {
        // Пробуем извлечь из структуры iva
        const sellerUrl = currentOfferData?.iva?.UserInfoStep[0]?.payload?.profile?.link;
        if (sellerUrl) {
          const userMatch = sellerUrl.match(/\/user\/([^\/]+)/);
          const brandMatch = sellerUrl.match(/\/brands\/([^\/]+)/);
          
          if (userMatch) {
            userId = userMatch[1].split('?')[0]; // Убираем параметры после ?
          } else if (brandMatch) {
            userId = brandMatch[1].split('?')[0]; // Убираем параметры после ?
          }
        }
      }
      
      // Если не получилось из данных каталога, пробуем извлечь из DOM
      if (!userId) {
        const sellerLinkElement = offerElement.querySelector('a[href*="/user/"]') || 
                                 offerElement.querySelector('a[href*="/brands/"]');
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
      }
    } catch (error) {
      console.warn(`${logPrefix} Error extracting userId:`, error);
      userId = undefined;
    } finally {
      updateOfferState(offerElement, { offerId, userId });
    }
  }
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
    
    // Пробуем получить данные каталога альтернативным способом при загрузке
    if (!catalogData || catalogData.length === 0) {
      console.log(`${logPrefix} Пробуем получить данные каталога при инициализации`);
      catalogData = getCatalogDataAlternative();
      if (catalogData && catalogData.length > 0) {
        console.log(`${logPrefix} Данные каталога получены при инициализации:`, catalogData);
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
                node.querySelector('[class*="contact-bar__root"]') ||
                node.querySelector('[class*="style__contactBarOnly"]') ||
                node.classList?.toString().includes('contact-bar')
              );
              // Или появилась информация о продавце
              const hasSellerInfo = node.querySelector && (
                node.querySelector('[data-marker="seller-link/link"]') ||
                node.querySelector('[data-marker="seller-info/name"]')
              );
              if (hasContactBar || hasSellerInfo) {
                console.log(`${logPrefix} обнаружен контейнер контактов или информация о продавце`);
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
              if (!catalogData) return;
              processSearchPage();
            }
            if (node?.classList?.toString().includes("styles-singlePageWrapper")) {
              console.log(`${logPrefix} singlePageWrapper обновлен`);
              // Пробуем добавить переключатель при обновлении DOM
              insertCityFilterToggle();
              if (!catalogData) return;
              processSearchPage();
            }
            // Проверяем появление верхней панели с фильтрами
            if (node instanceof Element && node?.classList?.toString().includes("index-topPanel-")) {
              console.log(`${logPrefix} Верхняя панель обнаружена`);
              insertCityFilterToggle();
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
                catalogData = getCatalogDataFromInit(initialData);
                console.log(`${logPrefix} catalogData получен`, catalogData);
                if (catalogData && catalogData.length > 0) {
                  processSearchPage();
                } else {
                  console.warn(`${logPrefix} catalogData пуст или не найден, пробуем альтернативные способы`);
                  catalogData = getCatalogDataAlternative();
                  if (catalogData && catalogData.length > 0) {
                    console.log(`${logPrefix} Данные получены альтернативным способом:`, catalogData);
                    processSearchPage();
                  } else {
                    console.warn(`${logPrefix} Не удалось получить данные каталога никаким способом`);
                  }
                }
              } catch (error) {
                console.error("Error processing catalog data:", error);
                // Если основной способ не сработал, пробуем альтернативные
                console.log(`${logPrefix} Пробуем альтернативные способы получения данных`);
                catalogData = getCatalogDataAlternative();
                if (catalogData && catalogData.length > 0) {
                  console.log(`${logPrefix} Данные получены альтернативным способом после ошибки:`, catalogData);
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
}

let isPaginationEnabled = false;
let cityFilterEnabled = false;

browser.storage.local.get(["isPaginationEnabled", "isCityFilterEnabled"], function (result) {
  if (result.isPaginationEnabled !== undefined) {
    isPaginationEnabled = result.isPaginationEnabled;
  }
  if (result.isCityFilterEnabled !== undefined) {
    cityFilterEnabled = result.isCityFilterEnabled;
    // Отложенное обновление визуального состояния переключателя,
    // т.к. DOM может быть ещё не готов при загрузке storage
    setTimeout(updateCityFilterToggleState, 100);
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
});

let catalogData;
let isLoading = false;
let checkTimeout;
let blacklistUsers = [];
let blacklistOffers = [];

load_arrays();

main();
