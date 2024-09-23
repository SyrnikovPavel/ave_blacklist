// browser compatibility
if (typeof browser === "undefined") {
  var browser = chrome;
}

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
          results = results.replaceAll("[", "").replaceAll("]", ",").replaceAll(" ", "").replaceAll('"', "").replaceAll('"', "").split(",");
          resolve(results);
          return;
        }
        resolve([]);
      });
    });
  });
}

function importFromTextUsers() {
  let text = document
    .getElementById("users")
    .value.replace(/{/g, "")
    .replace(/}/g, "")
    .replace(/_blacklist_ad/g, "")
    .replace(/_blacklist_user/g, "")
    .replace(/true/g, "")
    .replace(/:/g, "")
    .replace(/\[/g, "")
    .replace(/]/g, "")
    .replace(/"/g, "")
    .replace(/'/g, "")
    .replace(/\n/g, ",")
    .replace(/ /g, "");

  let newUserIds = [];
  for (let id of text.split(",")) {
    if (id !== "") {
      if (id.length >= 30) {
        newUserIds.push(id);
      }
    }
  }

  let blacklistUsers = [];
  for (const userId of newUserIds) {
    blacklistUsers.push(userId + "_blacklist_user");
  }
  syncStore("blacklistUsers", blacklistUsers);
}

const importUsers = document.getElementById("importUsers");
importUsers.addEventListener("click", importFromTextUsers);

function importFromTextOffers() {
  let text = document
    .getElementById("offers")
    .value.replace(/{/g, "")
    .replace(/}/g, "")
    .replace(/_blacklist_ad/g, "")
    .replace(/_blacklist_user/g, "")
    .replace(/true/g, "")
    .replace(/:/g, "")
    .replace(/\[/g, "")
    .replace(/]/g, "")
    .replace(/"/g, "")
    .replace(/'/g, "")
    .replace(/\n/g, ",")
    .replace(/ /g, "");

  let newOfferIds = [];
  for (let id of text.split(",")) {
    if (id !== "") {
      if (id.length < 30) {
        newOfferIds.push(id);
      }
    }
  }

  let blacklistOffers = [];
  for (const offerId of newOfferIds) {
    blacklistOffers.push(offerId + "blacklist_ad");
  }
  syncStore("blacklistOffers", blacklistOffers);
}

document.getElementById("importOffers").addEventListener("click", importFromTextOffers);
