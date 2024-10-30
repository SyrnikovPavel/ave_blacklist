const offersRootSelectorValue = "bx.catalog.container";
const offersRootSelector = `[elementtiming="${offersRootSelectorValue}"]`;
const offersSelector = '[data-marker="item"]';
const logPrefix = "[ave]";

const sellerPageSidebarClass = ".Sidebar-root-h24MJ";
const badge_bar_id = "badgebar_v2";

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
    '<svg xmlns="http://www.w3.org/2000/svg" class="custom-button block block-user-button" role="img" aria-label="user x" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!----><!----><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"></path><path d="M6 21v-2a4 4 0 0 1 4 -4h3.5"></path><path d="M22 22l-5 -5"></path><path d="M17 22l5 -5"></path></svg>';

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
    '<svg xmlns="http://www.w3.org/2000/svg" class="custom-button block block-item-button" role="img" aria-label="eye x" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!----><!----><path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"></path><path d="M13.048 17.942a9.298 9.298 0 0 1 -1.048 .058c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6a17.986 17.986 0 0 1 -1.362 1.975"></path><path d="M22 22l-5 -5"></path><path d="M17 22l5 -5"></path></svg>';

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
  const userIsBlacklisted = offerInfo.userId && blacklistUsers.includes(offerInfo.userId + "_blacklist_user");
  const offerIsBlacklisted = blacklistOffers.includes(offerInfo.offerId + "_blacklist_ad");

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
    const sellerUrl = currentOfferData?.iva?.UserInfoStep[0]?.payload?.profile?.link;
    const userId = sellerUrl?.split("/")[2]?.split("?")[0];
    updateOfferState(offerElement, { offerId, userId });
  }
}

function insertBlockedSellerUI(userId) {
  const sidebar = document.querySelector(sellerPageSidebarClass);
  const unblockButtonHtml =
    '<button type="button" class="sellerPageControlButton removeSellerFromBlacklist styles-module-root-EEwdX styles-module-root_size_m-Joz68 styles-module-root_preset_secondary-_ysdV styles-module-root_fullWidth-jnoCY"><span class="styles-module-wrapper-_6mED"><span class="styles-module-text-G2ghF styles-module-text_size_m-DUDcO">Показать пользователя</span></span></button>';
  const badgeHtml =
    '<div class="ProfileBadge-root-bcR8G ProfileBadge-cloud-vOPD1 ProfileBadge-activatable-_4_K8 bad_badge" style="--badge-font-color:#000000;--badge-bgcolor:#f8cbcb;--badge-hover-bgcolor:#fd8181" data-marker="badge-102"><div class="ProfileBadge-aside-_0Ky7"><div class="ProfileBadge-icon-wrap-p9n7e"><img class="ProfileBadge-icon-iUIed" src="https://60.img.avito.st/image/1/1.3v4G9ra3qI-xVyBFNvWR3zpUcBW0UXYXeFQ.ZdJ7TPsRy16QtmiICqWohuc48kE3jvh8_F9UOOyoODw" alt="badge icon" data-marker="badge-image-102"></div></div><div class="ProfileBadge-content-o2hDn"><div class="ProfileBadge-title-_Z4By" data-marker="badge-title-102">Пользователь в ЧС</div><div class="ProfileBadge-description-_lbMb" data-marker="badge-description-102"></div></div>';
  const badge_bar = document.getElementById(badge_bar_id);
  badge_bar.insertAdjacentHTML("afterbegin", badgeHtml);
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

function insertSellerUI(userId) {
  const sidebar = document.querySelector(sellerPageSidebarClass);
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
  const catalogKeyString = "@avito";
  const avitoKey = Object.keys(initialData).find((key) => key.startsWith(catalogKeyString));

  if (avitoKey) {
    const catalogItems = initialData[avitoKey].data.catalog.items;
    const extraItems = initialData[avitoKey].data.catalog.extraBlockItems;
    let allItems = catalogItems.concat(extraItems);
    allItems = allItems.filter((item) => item.hasOwnProperty("categoryId"));
    return allItems;
  } else {
    console.error(`${logPrefix} ключ ${catalogKeyString} не найден`);
  }
}

async function main() {
  const currentUrl = window.location.toString();
  const userPageStrings = ["www.avito.ru/user/", "sellerId", "brands"];
  const isUserPage = userPageStrings.some((str) => currentUrl.includes(str));
  if (isUserPage) console.log(`${logPrefix} страница определена: продавец`);
  else console.log(`${logPrefix} страница определена: поиск`);

  const target = document;
  let initialData;

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach(async function (node) {
          if (isUserPage) {
            // страница продавца
            if (
              node?.classList?.toString().includes("styles-module-theme-_4Zlk styles-module-theme-kvanA") &&
              node.querySelector(".ExtendedProfile-root-i6PQx")
            ) {
              console.log(`${logPrefix} страница продваца обновлена`);
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
              const initCatalogDataContent = await waitForNodeContent(node, "searchCore");
              if (initCatalogDataContent.startsWith("window.__initialData__")) {
                initialData = parseInitialData(initCatalogDataContent);
                catalogData = getCatalogDataFromInit(initialData);
              } else {
                const initCatalogData = JSON.parse(initCatalogDataContent);
                catalogData = getCatalogData(initCatalogData);
              }

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
