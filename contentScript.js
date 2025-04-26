const offersRootSelectorValue = "bx.catalog.container";
const offersRootSelector = `[elementtiming="${offersRootSelectorValue}"]`;
const offersSelector = '[data-marker="item"]';
const logPrefix = "[ave]";

const sellerPageSidebarSelector = `[class^="ExtendedProfileStickyContainer-"]`;

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

function getSellerId(initialData) {
  return initialData.data.ssrData.initData.result.value.data.customLink || initialData.data.ssrData.initData.result.value.data.profileUserHash;
}

function getCatalogData(initCatalogData) {
  const catalogItems = initCatalogData.data.catalog.items;
  const extraItems = initCatalogData.data.catalog.extraBlockItems;
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

  if (!offerIsHidden && (userIsBlacklisted || offerIsBlacklisted)) {
    // клонируем оригинальное объявление
    const offerElementClone = offerElement.cloneNode(true);
    // прячем оригинальное объявление
    offerElement.style.display = "none";
    // кладем клон в "скрытый" контейнер
    hiddenContainer.appendChild(offerElementClone);
    // переназначаем клон как offerElement, чтоб добавить к нему кнопки позже
    offerElement = offerElementClone;
    console.log(`${logPrefix} объявление ${offerInfo.offerId} скрыто`);
  } else if (offerIsHidden && !userIsBlacklisted && !offerIsBlacklisted) {
    // удаляем объявление из скрытых
    offerElement.remove();
    // находим оригинальное "скрытое" объявление
    // переназначаем offerElement, чтоб добавить к нему кнопки позже
    offerElement = document.querySelector(`[data-item-id="${offerInfo.offerId}"]`);
    // показываем его
    offerElement.style.display = "block";
  }

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
      const sellerUrl = currentOfferData?.iva?.UserInfoStep[0]?.payload?.profile?.link;
      userId = sellerUrl?.split("/")[2]?.split("?")[0];
    } catch (error) {
      console.error("Error extracting userId:", error);
      userId = undefined;
    } finally {
      updateOfferState(offerElement, { offerId, userId });
    }
  }
}

function checkButton() {
  const texts = ["Скрыть пользователя", "Показать пользователя"];
  const button = Array.from(document.querySelectorAll('button')).find(btn =>
      texts.includes(btn.textContent.trim())
  );
  return button !== undefined;
}

function insertBlockedSellerUI(userId) {
  if (!checkButton()){
    const sidebar = document.querySelector(sellerPageSidebarSelector);
    const unblockButtonHtml =
        '<button type="button" class="sellerPageControlButton removeSellerFromBlacklist styles-module-root-EEwdX styles-module-root_size_m-Joz68 styles-module-root_preset_secondary-_ysdV styles-module-root_fullWidth-jnoCY"><span class="styles-module-wrapper-_6mED"><span class="styles-module-text-G2ghF styles-module-text_size_m-DUDcO">Показать пользователя</span></span></button>';
    const badgeHtml =
        '<div class="ProfileBadge-root-bcR8G ProfileBadge-cloud-vOPD1 ProfileBadge-activatable-_4_K8 bad_badge" style="--badge-font-color:#000000;--badge-bgcolor:#f8cbcb;--badge-hover-bgcolor:#fd8181" data-marker="badge-102">❌ Пользователь в ЧС</div><div class="ProfileBadge-content-o2hDn"><div class="ProfileBadge-title-_Z4By" data-marker="badge-title-102"></div><div class="ProfileBadge-description-_lbMb" data-marker="badge-description-102"></div></div>';
    const firstBadge = sidebar.querySelector(`[class^="ProfileBadge-"]`);
    const badge_bar = firstBadge.parentElement;
    badge_bar.insertAdjacentHTML("beforeend", badgeHtml);
    sidebar.insertAdjacentHTML("beforeend", unblockButtonHtml);

    const actionButton = sidebar.querySelector(".removeSellerFromBlacklist");

    // убрать пользователя из ЧС
    actionButton.addEventListener("click", () => {
      removeUserFromBlacklist(userId);
      sidebar.querySelector(".bad_badge").remove();
      actionButton.remove();
      insertSellerUI(userId);
    });
  }
}

function insertSellerUI(userId) {
  if (!checkButton()) {
    const sidebar = document.querySelector(sellerPageSidebarSelector);
    const blockButtonHtml =
        '<button type="button" class="sellerPageControlButton addSellerToBlacklist styles-module-root-EEwdX styles-module-root_size_m-Joz68 styles-module-root_preset_secondary-_ysdV styles-module-root_fullWidth-jnoCY"><span class="styles-module-wrapper-_6mED"><span class="styles-module-text-G2ghF styles-module-text_size_m-DUDcO">Скрыть пользователя</span></span></button>';

    sidebar.insertAdjacentHTML("beforeend", blockButtonHtml);

    const actionButton = sidebar.querySelector(".addSellerToBlacklist");

    // добавить пользователя в ЧС
    actionButton.addEventListener("click", () => {
      addUserToBlacklist(userId);
      actionButton.remove();
      insertBlockedSellerUI(userId);
    });
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

function waitForNodeContent(node, string) {
  // ждем когда текст нода загрузится в dom полностью
  // в цикле проверяем, если ли в тексте `string`, пока не найдем
  return new Promise((resolve) => {
    const checkInterval = 100;
    const intervalId = setInterval(() => {
      if (node.textContent.includes(string)) {
        clearInterval(intervalId);
        resolve(node.textContent);
      }
    }, checkInterval);
  });
}

function getCatalogDataFromInit(initialData) {
  const catalogItems = initialData.data.catalog.items;
  const extraItems = initialData.data.catalog.extraBlockItems;
  let allItems = catalogItems.concat(extraItems);
  allItems = allItems.filter((item) => item.hasOwnProperty("categoryId"));
  return allItems;
}

function decodeHtmlEntities(str) {
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}

// ==================== AUTO-PAGINATION FUNCTIONALITY ====================

// Check if script is enabled (default to true)
const SCRIPT_ENABLED_KEY = "avito-auto-pagination-enabled";
let isPaginationEnabled = true;
let isLoading = false;

// Create controls element
async function createPaginationControls() {
  if (!document.body) {
    await new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (document.body) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(document.documentElement, { childList: true });
    });
  }

  const controls = document.createElement("div");
  controls.className = "avito-auto-pagination-controls";
  controls.style.position = "fixed";
  controls.style.left = "20px";
  controls.style.bottom = "20px";
  controls.style.zIndex = "9999";
  controls.style.background = "white";
  controls.style.padding = "10px 14px";
  controls.style.borderRadius = "10px";
  controls.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
  controls.style.display = "flex";
  controls.style.flexDirection = "column";
  controls.style.alignItems = "center";
  controls.style.gap = "8px";
  controls.style.minWidth = "180px";
  controls.style.fontFamily = "Arial, sans-serif";
  controls.style.fontSize = "13px";
  controls.style.color = "#333";

  const status = document.createElement("div");
  status.className = "avito-auto-pagination-status";
  status.textContent = isPaginationEnabled ? "Автопагинация включена" : "Автопагинация отключена";
  status.style.textAlign = "center";
  status.style.fontWeight = "500";

  const button = document.createElement("button");
  button.className = "avito-auto-pagination-toggle";
  button.textContent = isPaginationEnabled ? "Отключить" : "Включить";
  button.style.position = "relative";
  button.style.padding = "8px 14px";
  button.style.border = "none";
  button.style.borderRadius = "6px";
  button.style.background = "#3498db";
  button.style.color = "white";
  button.style.fontWeight = "bold";
  button.style.cursor = "pointer";
  button.style.width = "100%";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.gap = "8px";
  button.style.transition = "background 0.3s ease";

  button.onmouseenter = () => {
    button.style.background = "#2980b9";
  };
  button.onmouseleave = () => {
    button.style.background = "#3498db";
  };

  const spinner = document.createElement("div");
  spinner.className = "avito-auto-pagination-loader-spinner";
  spinner.style.display = "none";
  spinner.style.border = "3px solid rgba(255, 255, 255, 0.3)";
  spinner.style.borderTop = "3px solid white";
  spinner.style.borderRadius = "50%";
  spinner.style.width = "16px";
  spinner.style.height = "16px";
  spinner.style.animation = "spin 0.8s linear infinite";

  button.onclick = () => {
    isPaginationEnabled = !isPaginationEnabled;
    button.childNodes[0].textContent = isPaginationEnabled ? "Отключить" : "Включить";
    status.textContent = isPaginationEnabled ? "Автопагинация включена" : "Автопагинация отключена";
    if (isPaginationEnabled) checkPaginationVisibility();
  };

  button.appendChild(spinner);

  controls.appendChild(status);
  controls.appendChild(button);
  document.body.appendChild(controls);

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

  return { controls, status, button, spinner };
}

// Find the main offers container
function getMainOffersContainer() {
  const containers = document.querySelectorAll(".items-items-Iy89l");
  return containers.length > 0 ? containers[0] : null;
}

// Find the "other cities" container
function getOtherCitiesContainer() {
  const containers = document.querySelectorAll(".items-items-Iy89l");
  return containers.length > 1 ? containers[1] : null;
}

// Check if paginator is visible
function isPaginatorVisible() {
  const paginator = document.querySelector(".js-pages.pagination-pagination-JPulP");
  if (!paginator) {
    console.log(`${logPrefix} Paginator not found`);
    return false;
  }

  const rect = paginator.getBoundingClientRect();
  const isVisible = rect.top <= (window.innerHeight || document.documentElement.clientHeight) && rect.bottom >= 0;

  console.log(`${logPrefix} Paginator visibility check: ${isVisible}`);
  return isVisible;
}

// Get current page number
function getCurrentPage() {
  const currentPageElement = document.querySelector(".styles-module-item_current-u7t1s");
  if (currentPageElement) {
    const pageText = currentPageElement.querySelector(".styles-module-text-LjJRZ")?.textContent;
    const page = parseInt(pageText, 10) || 1;
    console.log(`${logPrefix} Current page: ${page}`);
    return page;
  }
  console.log(`${logPrefix} Current page not found, defaulting to 1`);
  return 1;
}

// Get next page URL
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
    const imageSpan = container.querySelector(".photo-slider-image-xjG6U");

    // If we have a span instead of an img, fix it
    if (imageSpan && imageSpan.tagName === "SPAN") {
      const img = document.createElement("img");
      img.className = "photo-slider-image-xjG6U";
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
      const sellerUrl = currentOfferData?.iva?.UserInfoStep[0]?.payload?.profile?.link;
      userId = sellerUrl?.split("/")[2]?.split("?")[0];
    } catch (error) {
      console.error("Error extracting userId:", error);
      userId = undefined;
    } finally {
      updateOfferState(clone, { offerId, userId });
    }
  });
}

// Fetch next page
async function fetchNextPage() {
  if (!isPaginationEnabled || isLoading) {
    console.log(`${logPrefix} Fetch aborted - script disabled or already loading`);
    return;
  }

  const nextPageUrl = getNextPageUrl();
  if (!nextPageUrl) {
    paginationControls.status.textContent = "Все станицы получены";
    console.log(`${logPrefix} Все станицы получены`);
    return;
  }

  isLoading = true;
  paginationControls.button.disabled = true;
  paginationControls.spinner.style.display = "block";
  paginationControls.status.textContent = "Загрузка страницы " + (getCurrentPage() + 1);
  console.log(`${logPrefix} Загрузка страницы  ${getCurrentPage() + 1}`);

  try {
    const response = await fetch(nextPageUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Find all containers in the new page
    const newContainers = doc.querySelectorAll(".items-items-Iy89l");
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
            newContainer.className = "items-items-Iy89l";
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
    const newPaginator = doc.querySelector(".js-pages.pagination-pagination-JPulP");
    if (newPaginator) {
      const paginator = document.querySelector(".js-pages.pagination-pagination-JPulP");
      if (paginator) {
        paginator.innerHTML = newPaginator.innerHTML;
        console.log(`${logPrefix} Updated pagination controls`);
      }
    }

    paginationControls.status.textContent = "Страница успешно загружена";
    console.log(`${logPrefix} Страница успешно загружена`);
  } catch (error) {
    console.error(`${logPrefix} Ошибка загрузки страницы:`, error);
    paginationControls.status.textContent = "Ошибка загрузки страницы";
  } finally {
    isLoading = false;
    paginationControls.button.disabled = false;
    paginationControls.spinner.style.display = "none";

    // Wait a bit before allowing the next load
    setTimeout(() => {
      paginationControls.status.textContent = isPaginationEnabled ? "Автоматическая пагинация включена" : "Автоматическая пагинация отключена";
    }, 2000);
  }
}

// Check pagination visibility with debounce
let checkTimeout;
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
        console.log(`${logPrefix} DOM mutation detected, checking paginator visibility`);
        checkPaginationVisibility();
      }
    });
  });

  // Observe the document body for added nodes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}

// Initialize pagination functionality
async function initPagination() {
  console.log(`${logPrefix} Initializing Avito Auto-Pagination script`);

  // Create controls
  window.paginationControls = await createPaginationControls();

  // Add initial loader if enabled
  if (isPaginationEnabled && isPaginatorVisible()) {
    fetchNextPage();
  }

  // Set up scroll listener
  window.addEventListener("scroll", checkPaginationVisibility);

  // Set up mutation observer
  initPaginationObserver();
}

// ==================== MAIN FUNCTIONALITY ====================

async function main() {
  const currentUrl = window.location.toString();
  const userPageStrings = ["www.avito.ru/user/", "sellerId", "brands"];
  const isUserPage = userPageStrings.some((str) => currentUrl.includes(str));
  if (isUserPage) console.log(`${logPrefix} страница определена: продавец`);
  else {
    console.log(`${logPrefix} страница определена: поиск`);
    // Initialize pagination only on search pages
    await initPagination();
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
              console.log(`${logPrefix} страница продваца обновлена`);
              // debugger;
              if (!initialData) return;
              let userId = getSellerId(initialData);
              processSellerPage(userId);
            }
            if (node?.nodeName === "SCRIPT" && node?.textContent?.includes("__initialData__")) {
              // waitForNodeContent нужен, так как в моем тестировании иногда, при получении текста сразу, он был обрезан вполовину или вообще был undefined
              const initialDataContent = await waitForNodeContent(node, "__mfe__");
              initialData = parseInitialData(initialDataContent);
              console.log(`${logPrefix} initialData найден`, initialData);
              let userId = getSellerId(initialData);
              processSellerPage(userId);
            }
          } else {
            // страница поиска
            if (node instanceof Element && node?.getAttribute("elementtiming") === offersRootSelectorValue) {
              console.log(`${logPrefix} offersRootSelector обновлен`);
              if (!catalogData) return;
              processSearchPage();
            }
            if (node?.classList?.toString().includes("styles-singlePageWrapper")) {
              console.log(`${logPrefix} singlePageWrapper обновлен`);
              if (!catalogData) return;
              processSearchPage();
            }
            if (node instanceof HTMLScriptElement && node?.textContent?.includes("abCentral") && !node?.textContent?.startsWith("window[")) {
              // waitForNodeContent нужен, так как в моем тестировании иногда, при получении текста сразу, он был обрезан вполовину или вообще был undefined
              const initCatalogDataContent = await waitForNodeContent(node, "isAuthenticated");
              const decodedJson = decodeHtmlEntities(initCatalogDataContent);
              const initialData = JSON.parse(decodedJson);
              catalogData = getCatalogDataFromInit(initialData);
              console.log(`${logPrefix} catalogData найден`, catalogData);
              processSearchPage();
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

let catalogData;

let blacklistUsers = [];
let blacklistOffers = [];

load_arrays();

main();
