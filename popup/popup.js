// browser compatibility
if (typeof browser === 'undefined') {
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
    browser.storage.local.set(storageObj)
}

function syncGet(key) {
    return new Promise((resolve) => {
        browser.storage.local.get(null, function(items) {
            const keyArr = new Array();
            for (let item of Object.keys(items)){
                if (item.includes(key)){
                    if (hasNumber(item)){
                        keyArr.push(item)
                    }
                }
            }
            browser.storage.local.get(keyArr, (items) => {

                const keys = Object.keys(items);


                const length = keys.length;
                let results = "";
                if(length > 0){
                    const sepPos = keys[0].lastIndexOf("_");
                    const prefix = keys[0].substring(0, sepPos);
                    for(let x = 0; x < length; x ++){
                        results += items[`${prefix }_${x}`];
                    }
                    results = results.replaceAll('[', '').replaceAll(']', ',').replaceAll(' ', '').replaceAll('\"', '').replaceAll('\"', '').split(",").filter((element) => element !== "")
                    resolve(results);
                    return;
                }
                resolve([]);

            })
        });
    })
}



async function exportDatabase() {

    let items = {};

    const blacklistUsers = await syncGet("blacklistUsers");
    for (let userId of blacklistUsers){
        items[userId] = true
    }

    const blacklistOffers = await syncGet("blacklistOffers");
    for (let offerId of blacklistOffers){
        items[offerId] = true
    }

    console.log(items);

    const serializedData = JSON.stringify(items, null, 2);
    const blob = new Blob([serializedData], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    browser.downloads.download({
        url: url,
        filename: "avito_blacklist_database.json"
    });
}

async function exportDatabaseBlacklistUsers() {
    let items = []
    const blacklistUsers = await syncGet("blacklistUsers");
    for (let user_id of blacklistUsers){
        items.push(user_id.replace('_blacklist_user', ''))
    }

    const serializedData = JSON.stringify(items, null, 2);
    const blob = new Blob([serializedData], {type: "application/json"});
    const url = URL.createObjectURL(blob);

    browser.downloads.download({
        url: url,
        filename: "avito_blacklist_users_database.json"
    });
}

async function exportDatabaseBlacklistOffers() {
    let items = []
    const blacklistOffers = await syncGet("blacklistOffers");
    for (let offerId of blacklistOffers){
        items.push(offerId.replace('_blacklist_ad', ''))
    }

    const serializedData = JSON.stringify(items, null, 2);
    const blob = new Blob([serializedData], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    browser.downloads.download({
        url: url,
        filename: "avito_blacklist_offers_database.json"
    });
}

const exportButton = document.getElementById("exportButton");
exportButton.addEventListener("click", exportDatabase);

const exportUsersButton = document.getElementById("exportUsersButton");
exportUsersButton.addEventListener("click", exportDatabaseBlacklistUsers);

const exportOffersButton = document.getElementById("exportOffersButton");
exportOffersButton.addEventListener("click", exportDatabaseBlacklistOffers);

function importFromJSONFile() {
    const fileInput = document.getElementById('fileInput');
    fileInput.click();

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        reader.onload = function(readerEvent) {
            const json = readerEvent.target.result;
            try {
                const data = JSON.parse(json);

                let blacklistUsers = [];
                let blacklistOffers = [];

                Object.keys(data).forEach(function(search_id) {
                    if (search_id.includes('_blacklist_user')){
                        if (!blacklistUsers.includes(search_id)){
                            blacklistUsers.push(search_id)
                        }
                    }
                    if (search_id.includes('_blacklist_ad')){
                        if (!blacklistOffers.includes(search_id)){
                            blacklistOffers.push(search_id)
                        }
                    }
                });

                browser.storage.local.clear(function() {
                    console.log('browser storage cleared.');
                    syncStore('blacklistUsers', blacklistUsers);
                    syncStore('blacklistOffers', blacklistOffers)
                });
            } catch (error) {
                console.error('Failed to parse JSON:', error);
            }
        };
    });
}

function importFromJSONFileUsers() {
    const fileInput = document.getElementById('fileInput');
    fileInput.click();

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        reader.onload = function(readerEvent) {
            const json = readerEvent.target.result;
            try {
                const newUserIds = JSON.parse(json);

                let blacklistUsers = [];
                for (const userId of newUserIds) {
                    blacklistUsers.push(userId + "_blacklist_user");
                }
                syncStore('blacklistUsers', blacklistUsers);

            } catch (error) {
                console.error('Failed to parse JSON:', error);
            }
        };
    });
}

function importFromJSONFileOffers() {
    const fileInput = document.getElementById('fileInput');
    fileInput.click();

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        reader.onload = function(readerEvent) {
            const json = readerEvent.target.result;
            try {
                const newOfferIds = JSON.parse(json);
                let blacklistOffers = [];
                for (const offerId of newOfferIds) {
                    blacklistOffers.push(offerId + "_blacklist_ad");
                }
                syncStore('blacklistOffers', blacklistOffers);

            } catch (error) {
                console.error('Failed to parse JSON:', error);
            }
        };
    });
}

function clearDatabase(){
    browser.storage.local.clear(function() {
        console.log('browser storage cleared.');
        syncStore('blacklistUsers', []);
        syncStore('blacklistOffers', [])
    });
}

function openNewTab(){
    chrome.tabs.create({ url: chrome.runtime.getURL("popup/import_from_text.html") });
}



const importButton = document.getElementById("importButton");
importButton.addEventListener("click", importFromJSONFile);

const importButtonUsers = document.getElementById("importButtonUsers");
importButtonUsers.addEventListener("click", importFromJSONFileUsers);

const importButtonOffers = document.getElementById("importButtonOffers");
importButtonOffers.addEventListener("click", importFromJSONFileOffers);

const importText = document.getElementById("importText");
importText.addEventListener("click", openNewTab);

const clearButton = document.getElementById("clearButton");
clearButton.addEventListener("click", () => {
    confirm("База данных будет очищена, вы уверены?");
    clearDatabase();
  });
