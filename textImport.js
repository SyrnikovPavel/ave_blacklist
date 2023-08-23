function importFromTextUsers() {

    let text = document.getElementById("users").value.replace(/{/g, '').replace(/}/g, '').replace(/_blacklist_ad/g, '').replace(/_blacklist_user/g, '').replace(/true/g, '').replace(/:/g, '').replace(/\[/g, '').replace(/]/g, '').replace(/"/g, '').replace(/'/g, "").replace(/\n/g, ",").replace(/ /g, "");

    let newUserIDs = []
    for (let id of text.split(',')) {
        if (id !== '') {
            if (id.length >= 30){
                newUserIDs.push(id)
            }
        }
    }

    chrome.storage.sync.get(null, function (result) {
        const existingDatabase = result || {};

        for (let datarow in existingDatabase) {
            if (datarow.includes("_blacklist_user")) {
                delete existingDatabase[datarow];
            }
        }

        for (const userID of newUserIDs) {
            existingDatabase[userID + "_blacklist_user"] = true;
        }

        chrome.storage.sync.clear(function () {
            console.log('Chrome storage cleared.');
            chrome.storage.sync.set(existingDatabase, function () {
                console.log('Database updated.');
            });
        });
    });

}

const importUser = document.getElementById("importUser");
importUser.addEventListener("click", importFromTextUsers);

function importFromTextAds() {

    let text = document.getElementById("ads").value.replace(/{/g, '').replace(/}/g, '').replace(/_blacklist_ad/g, '').replace(/_blacklist_user/g, '').replace(/true/g, '').replace(/:/g, '').replace(/\[/g, '').replace(/]/g, '').replace(/"/g, '').replace(/'/g, "").replace(/\n/g, ",").replace(/ /g, "");

    let newAdIDs = []
    for (let id of text.split(',')) {
        if (id !== '') {
            if (id.length < 30) {
                newAdIDs.push(id)
            }
        }
    }

    chrome.storage.sync.get(null, function (result) {
        const existingDatabase = result || {};

        for (let datarow in existingDatabase) {
            if (datarow.includes("_blacklist_ad")) {
                delete existingDatabase[datarow];
            }
        }

        for (const adID of newAdIDs) {
            existingDatabase[adID + "_blacklist_ad"] = true;
        }

        chrome.storage.sync.clear(function () {
            console.log('Chrome storage cleared.');
            chrome.storage.sync.set(existingDatabase, function () {
                console.log('Database updated.');
            });
        });
    });

}

const importAd = document.getElementById("importAd");
importAd.addEventListener("click", importFromTextAds);