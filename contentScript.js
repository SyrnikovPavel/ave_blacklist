let regexp_user = /user\/(\S*)\//;
let regexp_brands = /brands\/(\S*)\?/;

// https://www.avito.ru/brands/b272c150d0862951334acb4959fce36e?src=search_seller_info
// https://www.avito.ru/user/683a062034c7f04de393ec2f84aa9ac6/profile?src=search_seller_info

const offersRootSelector = ".index-root-KVurS";
const offersContainerSelector = ".items-items-kAJAg";
const offersSelector = '[data-marker="item"]';
const logPrefix = "[ave]";

const sellerPageSidebarClass = ".Sidebar-root-h24MJ";
const badge_bar_id = "badgebar_v2";

/*
TODO

REWRITE functions

HIDE/SHOW ADD

*/

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
    const maxLength = chrome.storage.local.QUOTA_BYTES_PER_ITEM - index.length - 2;
    var valueLength = jsonstr.length;
    if (valueLength > maxLength) {
      valueLength = maxLength;
    }

    // trim down segment so it will be small enough even when run through `JSON.stringify` again at storage time
    //max try is QUOTA_BYTES_PER_ITEM to avoid infinite loop
    var segment = jsonstr.substr(0, valueLength);
    for (let i = 0; i < chrome.storage.local.QUOTA_BYTES_PER_ITEM; i++) {
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
  chrome.storage.local.set(storageObj);
}

function syncGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, function (items) {
      const keyArr = new Array();
      for (let item of Object.keys(items)) {
        if (item.includes(key)) {
          if (hasNumber(item)) {
            keyArr.push(item);
          }
        }
      }
      chrome.storage.local.get(keyArr, (items) => {
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

// async function checkIfUserInBlacklist(user_id) {
//   try {
//     const blacklist_users = await syncGet("blacklist_users");
//     let search_id = user_id + "_blacklist_user";
//     return blacklist_users.includes(search_id);
//   } catch (error) {
//     console.error(error);
//     return false;
//   }
// }

// async function checkIfAdInBlacklist(ad_id) {
//   try {
//     const blacklist_ads = await syncGet("blacklist_ads");
//     let search_id = ad_id + "_blacklist_user";
//     return blacklist_ads.includes(search_id);
//   } catch (error) {
//     console.error(error);
//     return false;
//   }
// }

// async function migrateData() {
//   chrome.storage.sync.get(null, async function (result) {
//     let oldBlacklist = result || [];
//     let newBlacklistUsers = (await syncGet("blacklist_users")) || [];
//     let newBlacklistAds = (await syncGet("blacklist_ads")) || [];

//     Object.keys(oldBlacklist).forEach(function (search_id) {
//       if (search_id.includes("_blacklist_user")) {
//         if (!newBlacklistUsers.includes(search_id)) {
//           newBlacklistUsers.push(search_id);
//         }
//       }
//       if (search_id.includes("_blacklist_ad")) {
//         if (!newBlacklistAds.includes(search_id)) {
//           newBlacklistAds.push(search_id);
//         }
//       }

//       chrome.storage.sync.clear(function () {
//         console.log("Chrome storage cleared.");
//         syncStore("blacklist_users", newBlacklistUsers);
//         syncStore("blacklist_ads", newBlacklistAds);
//       });
//     });
//   });
// }

function migrateStorage() {
  // Step 1: Retrieve all items from storage.sync
  chrome.storage.sync.get(null, function (items) {
    if (chrome.runtime.lastError) {
      console.error(`${logPrefix} Error retrieving sync storage:`, chrome.runtime.lastError);
      return;
    }

    // Step 2: Save the retrieved items to storage.local
    chrome.storage.local.set(items, function () {
      if (chrome.runtime.lastError) {
        console.error(`${logPrefix} Error setting local storage:`, chrome.runtime.lastError);
        return;
      }

      console.log(`${logPrefix} Data migrated to local storage successfully.`);
    });
  });
}

function getSellerId(initialData) {
  return initialData.data.ssrData.initData.result.value.data.customLink || initialData.data.ssrData.initData.result.value.data.profileUserHash;
}

function getCatalogData(initialData) {
  const catalogKeyString = "@avito"
  const avitoKey = Object.keys(initialData).find((key) => key.startsWith(catalogKeyString));

  if (avitoKey) {
    const catalogItems = initialData[avitoKey].data.catalog.items;
    return catalogItems.filter((item) => item.hasOwnProperty("categoryId"));
  } else {
    console.error(`${logPrefix} Catalog Key ${catalogKeyString} not found`);
  }
}

function parseInitialData() {
  const scripts = document.querySelectorAll("script");
  const targetScript = Array.from(scripts).find((script) => script.textContent.includes("window.__initialData__"));
  try {
    const scriptContent = decodeURIComponent(targetScript.innerHTML);

    // Find the start and end indexes of __initialData__ JSON
    const startIndex = scriptContent.indexOf('window.__initialData__ = "') + 'window.__initialData__ = "'.length;
    const endIndex = scriptContent.indexOf('";\nwindow.__mfe__');

    // Extract the JSON string
    const jsonString = scriptContent.substring(startIndex, endIndex);

    // Parse the JSON string into a JavaScript object
    const initialData = JSON.parse(jsonString);
    return initialData;
  } catch (error) {
    console.error(`${logPrefix} Error parsing script:`, error);
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

function addADToBlacklist(offerId) {
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

function removeADFromBlacklist(offerId) {
  let searchId = offerId + "_blacklist_ad";
  let inBlacklist = blacklistOffers.includes(searchId);
  if (inBlacklist) {
    blacklistOffers = blacklistOffers.filter((adId) => adId !== searchId);
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

function checkIfOffersAreProcessed() {
  console.log(`${logPrefix} Проверка на наличие кнопок`);
  const lastOffer = document.querySelector(offersContainerSelector).lastChild;
  const button = lastOffer?.querySelector(".custom-button");
  return button;
}

function checkIfSidebarIsProcessed() {
  console.log(`${logPrefix} Проверка, добавлены ли кнопки в сайдбар на странице продавца`);
  let processedSidebar = document.querySelector(".sidebar-processed");
  return processedSidebar;
}

// function getDataFromAdd(element) {
//   let id = element.getAttribute("data-item-id");
//   let name;
//   let price;
//   let current_datetime = new Date().toLocaleString("ru-RU", {
//     year: "numeric",
//     month: "numeric",
//     day: "numeric",
//     hour: "2-digit",
//     minute: "2-digit",
//   });

//   let names = element.querySelectorAll('[itemprop="name"]');
//   if (names.length > 0) {
//     name = names[0].textContent;
//   }

//   let prices = element.querySelectorAll('[itemprop="price"]');
//   if (prices.length > 0) {
//     price = prices[0].getAttribute("content");
//   }

//   return {
//     id: id,
//     name: name,
//     price: price,
//     datetime: current_datetime,
//   };
// }

// function getDataFromDetailAdd() {
//   let id;
//   let lat;
//   let lon;
//   let name;
//   let address;
//   let description;
//   let user;

//   let divs_for_id = document.querySelectorAll('div[class="style-item-map-wrapper-ElFsX style-expanded-x335n"]');
//   if (divs_for_id.length > 0) {
//     id = divs_for_id[0].getAttribute("data-item-id");
//     lat = divs_for_id[0].getAttribute("data-map-lat");
//     lon = divs_for_id[0].getAttribute("data-map-lon");
//   }

//   let divs_for_name = document.querySelectorAll('span[itemprop="name"]');
//   if (divs_for_name.length > 0) {
//     name = divs_for_name[0].textContent;
//   }

//   let divs_for_location = document.querySelectorAll('div[itemprop="address"]');
//   if (divs_for_location.length > 0) {
//     address = divs_for_location[0].textContent;
//   }

//   let divs_for_description = document.querySelectorAll('div[itemprop="description"]');
//   if (divs_for_description.length > 0) {
//     description = divs_for_description[0].textContent;
//   }

//   let divs_for_seller = document.querySelectorAll('div[data-marker="item-view/seller-info"]');
//   if (divs_for_seller.length > 0) {
//     let div_seller = divs_for_seller[0];
//     let href;
//     let user_id;
//     let user_name;

//     let hrefs = div_seller.querySelectorAll('a[data-marker="seller-link/link"]');
//     if (hrefs.length > 0) {
//       href = hrefs[0].getAttribute("href");
//       user_id = href.match(regexp)[1];
//       user_name = hrefs[0].querySelectorAll("span")[0].textContent;
//     }

//     let amount_adds = "0";
//     let amount_adds_divs = document.querySelectorAll('div[class="subscription-buttons-row-VT27g"]');
//     if (amount_adds_divs.length > 0) {
//       amount_adds = amount_adds_divs[0].textContent.replace(" объявлений пользователя", "").replace(" объявления пользователя", "");
//     }

//     user = {
//       id: user_id,
//       url: href,
//       name: user_name,
//       amount_adds: amount_adds,
//     };
//   }

//   console.log({
//     id: id,
//     location: {
//       lat: lat,
//       lon: lon,
//       address: address,
//     },
//     name: name,
//     description: description,
//     user: user,
//   });
// }

function insertBlockSellerButton(offerElement, offerInfo) {
  let buttonContainer = offerElement.querySelector(".button-container");
  if (!buttonContainer) {
    buttonContainer = insertButtonContainer(offerElement);
  }

  const blockButton = document.createElement("div");
  blockButton.title = "Скрыть все объявления продавца";

  const svgEl =
    '<svg xmlns="http://www.w3.org/2000/svg" class="custom-button block block-user-button" role="img" width="24" height="24" aria-label="user off" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!----><!----><path d="M8.18 8.189a4.01 4.01 0 0 0 2.616 2.627m3.507 -.545a4 4 0 1 0 -5.59 -5.552"></path><path d="M6 21v-2a4 4 0 0 1 4 -4h4c.412 0 .81 .062 1.183 .178m2.633 2.618c.12 .38 .184 .785 .184 1.204v2"></path><path d="M3 3l18 18"></path></svg>';

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
    '<svg xmlns="http://www.w3.org/2000/svg" class="custom-button block block-item-button" role="img" width="24" height="24" aria-label="x" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!----><!----><path d="M18 6l-12 12"></path><path d="M6 6l12 12"></path></svg>';

  blockButton.insertAdjacentHTML("beforeend", svgEl);
  buttonContainer.appendChild(blockButton);
  blockButton.addEventListener("click", (event) => {
    event.stopPropagation();
    addADToBlacklist(offerInfo.offerId);
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
    '<svg xmlns="http://www.w3.org/2000/svg" class="custom-button unblock unblock-user-button" role="img" width="24" height="24" aria-label="user x" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!----><!----><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"></path><path d="M6 21v-2a4 4 0 0 1 4 -4h3.5"></path><path d="M22 22l-5 -5"></path><path d="M17 22l5 -5"></path></svg>';

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
    '<svg xmlns="http://www.w3.org/2000/svg" class="custom-button unblock unblock-offer-button" role="img" width="24" height="24" aria-label="restore" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><!----><!----><path d="M3.06 13a9 9 0 1 0 .49 -4.087"></path><path d="M3 4.001v5h5"></path><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"></path></svg>';

  blockButton.insertAdjacentHTML("beforeend", svgEl);
  buttonContainer.appendChild(blockButton);
  blockButton.addEventListener("click", (event) => {
    event.stopPropagation();
    removeADFromBlacklist(offerInfo.offerId);
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
    // hide offer
    hiddenContainer.appendChild(offerElement);
    console.log(`${logPrefix} объявление ${offerInfo.offerId} скрыто`);
  } else if (offerIsHidden && !userIsBlacklisted && !offerIsBlacklisted) {
    // unhide
    document.querySelector(offersContainerSelector).prepend(offerElement);
    console.log(`${logPrefix} объявление ${offerInfo.offerId} восстановлено`);
  }

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
  const sidebar = document.querySelector(sellerPageSidebarClass);

  if (!sidebar) {
    // sidebar is not yet loaded
    return;
  }

  const searchId = userId + "_blacklist_user";
  if (blacklistUsers.includes(searchId)) {
    insertBlockedSellerUI(userId);
  } else {
    insertSellerUI(userId);
  }
  sidebar.classList.add("sidebar-processed");
}

function main() {
  const currentUrl = window.location.toString();
  if (currentUrl.includes("www.avito.ru/user/") || currentUrl.includes("sellerId") || currentUrl.includes("brands")) {
    console.log(`${logPrefix} user page`);

    let userId;

    document.addEventListener("readystatechange", () => {
      if (document.readyState === "interactive") {
        const initialData = parseInitialData();
        userId = getSellerId(initialData);
        processSellerPage(userId);
      }
    });

    const interval = setInterval(function () {
      if (!checkIfSidebarIsProcessed()) {
        processSellerPage(userId);
      }
    }, 500);
  } else {
    console.log(`${logPrefix} search page`);

    document.addEventListener("readystatechange", () => {
      if (document.readyState === "interactive") {
        const initialData = parseInitialData();
        catalogData = getCatalogData(initialData);
        processSearchPage(catalogData);
      }
    });

    const interval = setInterval(function () {
      if (!checkIfOffersAreProcessed()) {
        processSearchPage(catalogData);
      }
    }, 5000);
  }
}
async function load_arrays() {
  blacklistUsers = await syncGet("blacklistUsers");
  blacklistOffers = await syncGet("blacklistOffers");
}

// Call the migration function
migrateStorage();

/*migrateData();*/

let catalogData;

let blacklistUsers = [];
let blacklistOffers = [];

load_arrays();

main();
