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
        const maxLength = chrome.storage.sync.QUOTA_BYTES_PER_ITEM - index.length - 2;
        var valueLength = jsonstr.length;
        if (valueLength > maxLength) {
            valueLength = maxLength;
        }

        // trim down segment so it will be small enough even when run through `JSON.stringify` again at storage time
        //max try is QUOTA_BYTES_PER_ITEM to avoid infinite loop
        var segment = jsonstr.substr(0, valueLength);
        for (let i = 0; i < chrome.storage.sync.QUOTA_BYTES_PER_ITEM; i++) {
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
    chrome.storage.sync.set(storageObj)
}

function syncGet(key) {
    return new Promise((resolve) => {
        chrome.storage.sync.get(null, function(items) {
            const keyArr = new Array();
            for (let item of Object.keys(items)){
                if (item.includes(key)){
                    if (hasNumber(item)){
                        keyArr.push(item)
                    }
                }
            }
            chrome.storage.sync.get(keyArr, (items) => {

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

    const blacklist_users = await syncGet("blacklist_users");
    for (let user_id of blacklist_users){
        items[user_id] = true
    }

    const blacklist_ads = await syncGet("blacklist_ads");
    for (let ad_id of blacklist_ads){
        items[ad_id] = true
    }

    console.log(items);

    const serializedData = JSON.stringify(items, null, 2);
    const blob = new Blob([serializedData], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
        url: url,
        filename: "avito_blacklist_database.json"
    });
}

async function exportDatabaseBlacklistUsers() {
    let items = []
    const blacklist_users = await syncGet("blacklist_users");
    for (let user_id of blacklist_users){
        items.push(user_id.replace('_blacklist_user', ''))
    }

    const serializedData = JSON.stringify(items, null, 2);
    const blob = new Blob([serializedData], {type: "application/json"});
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
        url: url,
        filename: "avito_blacklist_users_database.json"
    });
}

async function exportDatabaseBlacklistAds() {
    let items = []
    const blacklist_ads = await syncGet("blacklist_ads");
    for (let ad_id of blacklist_ads){
        items.push(ad_id.replace('_blacklist_ad', ''))
    }

    const serializedData = JSON.stringify(items, null, 2);
    const blob = new Blob([serializedData], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
        url: url,
        filename: "avito_blacklist_ads_database.json"
    });
}

const exportButton = document.getElementById("exportButton");
exportButton.addEventListener("click", exportDatabase);

const exportUserButton = document.getElementById("exportUserButton");
exportUserButton.addEventListener("click", exportDatabaseBlacklistUsers);

const exportAdButton = document.getElementById("exportAdButton");
exportAdButton.addEventListener("click", exportDatabaseBlacklistAds);

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

                let newBlacklistUsers = [];
                let newBlacklistAds = [];

                Object.keys(data).forEach(function(search_id) {
                    if (search_id.includes('_blacklist_user')){
                        if (!newBlacklistUsers.includes(search_id)){
                            newBlacklistUsers.push(search_id)
                        }
                    }
                    if (search_id.includes('_blacklist_ad')){
                        if (!newBlacklistAds.includes(search_id)){
                            newBlacklistAds.push(search_id)
                        }
                    }
                });

                chrome.storage.sync.clear(function() {
                    console.log('Chrome storage cleared.');
                    syncStore('blacklist_users', newBlacklistUsers);
                    syncStore('blacklist_ads', newBlacklistAds)
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
                const newUserIDs = JSON.parse(json);

                let blacklist_users = [];
                for (const userID of newUserIDs) {
                    blacklist_users.push(userID + "_blacklist_user");
                }
                syncStore('blacklist_users', blacklist_users);

            } catch (error) {
                console.error('Failed to parse JSON:', error);
            }
        };
    });
}

function importFromJSONFileAds() {
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
                const newAdIDs = JSON.parse(json);
                let blacklist_ads = [];
                for (const adID of newAdIDs) {
                    blacklist_ads.push(adID + "_blacklist_ad");
                }
                syncStore('blacklist_ads', blacklist_ads);

            } catch (error) {
                console.error('Failed to parse JSON:', error);
            }
        };
    });
}

function openNewTab(){
    chrome.tabs.create({ url: chrome.runtime.getURL("import_from_text.html") });
}



const importButton = document.getElementById("importButton");
importButton.addEventListener("click", importFromJSONFile);

const importButtonUser = document.getElementById("importButtonUser");
importButtonUser.addEventListener("click", importFromJSONFileUsers);

const importButtonAd = document.getElementById("importButtonAd");
importButtonAd.addEventListener("click", importFromJSONFileAds);

const importText = document.getElementById("importText");
importText.addEventListener("click", openNewTab);


