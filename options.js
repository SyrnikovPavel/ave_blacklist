function exportDatabase() {
    chrome.storage.sync.get(null, function(items) {
        const serializedData = JSON.stringify(items, null, 2);
        const blob = new Blob([serializedData], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
            url: url,
            filename: "avito_blacklist_database.json"
        });
    });
}

function exportDatabaseBlacklistUsers() {
    chrome.storage.sync.get(null, function(items) {
        console.log(items);
        let users = [];
        for (let [item, value] of Object.entries(items)) {
            if (item.includes('_blacklist_user')){
                if (value){
                    users.push(item.replace('_blacklist_user', ''))
                }
            }
        }
        const serializedData = JSON.stringify(users, null, 2);
        const blob = new Blob([serializedData], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
            url: url,
            filename: "avito_blacklist_users_database.json"
        });
    });
}

function exportDatabaseBlacklistAds() {
    chrome.storage.sync.get(null, function(items) {
        console.log(items);
        let ads = [];
        for (let [item, value] of Object.entries(items)) {
            if (item.includes('_blacklist_ad')){
                if (value){
                    ads.push(item.replace('_blacklist_ad', ''))
                }
            }
        }
        const serializedData = JSON.stringify(ads, null, 2);
        const blob = new Blob([serializedData], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
            url: url,
            filename: "avito_blacklist_ads_database.json"
        });
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

                chrome.storage.sync.clear(function() {
                    console.log('Chrome storage cleared.');
                    chrome.storage.sync.set(data, function () {
                        console.log('Imported from file:', data);
                    });
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

                chrome.storage.sync.get(null, function(result) {
                    const existingDatabase = result || {};

                    for (let datarow in existingDatabase) {
                        if (datarow.includes("_blacklist_user")){
                            delete existingDatabase[datarow];
                        }
                    }

                    for (const userID of newUserIDs) {
                        existingDatabase[userID + "_blacklist_user"] = true;
                    }

                    chrome.storage.sync.clear(function() {
                        console.log('Chrome storage cleared.');
                        chrome.storage.sync.set(existingDatabase, function() {
                            console.log('Database updated.');
                        });
                    });
                });

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

                chrome.storage.sync.get(null, function(result) {

                    const existingDatabase = result || {};

                    for (let datarow in existingDatabase) {
                        if (datarow.includes("_blacklist_ad")){
                            delete existingDatabase[datarow];
                        }
                    }

                    for (const adID of newAdIDs) {
                        existingDatabase[adID + "_blacklist_ad"] = true;
                    }

                    chrome.storage.sync.clear(function() {
                        console.log('Chrome storage cleared.');
                        chrome.storage.sync.set(existingDatabase, function() {
                            console.log('Database updated.');
                        });
                    });
                });

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


