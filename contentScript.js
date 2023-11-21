let regexp = /user\/(\S*)\//
let buttons_class = "iva-item-aside-GOesg"
let actions_class = "iva-item-actions-rumkV"
let user_info_div_class = "iva-item-sellerInfo-_q_Uw"
let user_info_href_class = "style-link-STE_U"
let adds_class = "index-root-KVurS"
let hide_bool = true

let buttons_in_user_page_class = 'Sidebar-root-h24MJ'
let badge_bar_id = 'badgebar_v2'

let item_selector = '[data-marker="item"]'



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
                const keys = Object.keys( items );
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

async function checkIfUserInBlacklist(user_id) {
    try {
        const blacklist_users = await syncGet("blacklist_users");
        let search_id = user_id + '_blacklist_user';
        return blacklist_users.includes(search_id);
    } catch (error) {
        console.error(error);
        return false;
    }
}

async function checkIfAdInBlacklist(ad_id) {
    try {
        const blacklist_ads = await syncGet("blacklist_ads");
        let search_id = ad_id + '_blacklist_user';
        return blacklist_ads.includes(search_id);
    } catch (error) {
        console.error(error);
        return false;
    }
}


async function migrateData() {
    // TODO: Sync func here

    chrome.storage.sync.get(null, async function(result) {
        let oldBlacklist = result || [];
        let newBlacklistUsers = await syncGet("blacklist_users") || [];
        let newBlacklistAds = await syncGet("blacklist_ads") || [];


        Object.keys(oldBlacklist).forEach(function(search_id) {
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

            chrome.storage.sync.clear(function () {
                console.log('Chrome storage cleared.');
                syncStore('blacklist_users', newBlacklistUsers);
                syncStore('blacklist_ads', newBlacklistAds)
            });
        });

    });
}

/*migrateData();*/

let blacklist_users = [];
let blacklist_ads = [];

async function load_arrays() {
    blacklist_users = await syncGet("blacklist_users");
    blacklist_ads = await syncGet("blacklist_ads");
}

load_arrays();


function addUserToBlacklist(user_id) {

    let search_id = user_id + '_blacklist_user';
    let in_blacklist = blacklist_users.includes(search_id);
    if (!in_blacklist){
        blacklist_users.push(search_id);
        syncStore('blacklist_users', blacklist_users);
    }
}

function addADToBlacklist(ad_id) {
    let search_id = ad_id + '_blacklist_ad';
    let in_blacklist = blacklist_ads.includes(search_id);
    if (!in_blacklist){
        blacklist_ads.push(search_id)
        syncStore('blacklist_ads', blacklist_ads);
    }
}

function removeFromBlacklist(username) {
    let search_id = username + '_blacklist_user';
    let in_blacklist = blacklist_users.includes(search_id);
    if (in_blacklist){
        blacklist_users = blacklist_users.filter(userId => userId !== search_id);
        syncStore('blacklist_users', blacklist_users);
    }
}

function removeADFromBlacklist(ad_id) {
    let search_id = ad_id + '_blacklist_ad';
    let in_blacklist = blacklist_ads.includes(search_id);
    if (in_blacklist){
        blacklist_ads = blacklist_ads.filter(adId => adId !== search_id);
        syncStore('blacklist_ads', blacklist_ads);
    }
}


function getADS(){
    return document.querySelectorAll(item_selector)
}


function getData(div){
    let hrefs = div.getElementsByTagName('a')
    if (hrefs.length > 0){
        let href_element = hrefs[hrefs.length - 1]
        let href = href_element.href
        let user_id = href.match(regexp)[1]
        let user_name = 'NONAME'
        if (href_element.getElementsByTagName("p").length > 0){
            user_name = href_element.getElementsByTagName("p")[0].textContent
        }
        return {"user_id": user_id, "user_name": user_name, "user_url": href}
    }

}


function listenerBlacklistBtn(userData, element){
    let user_id = userData.user_id
    let btns = element.getElementsByClassName("avito_blacklist_user")
    if (btns.length > 0 ){
        let btn = btns[0]
        let btn_text = btn.innerText
        if (btn_text === "Скрыть польз.") {
            addUserToBlacklist(user_id);
            let only_btn = btn.getElementsByClassName("to_blacklist")[0]
            only_btn.innerText = "Показать польз."
            only_btn.classList.remove("to_blacklist")
            only_btn.classList.add("from_blacklist")
            hideAddsByUserId(user_id);
        } else {
            removeFromBlacklist(user_id);
            let only_btn = btn.getElementsByClassName("from_blacklist")[0]
            console.log(only_btn)
            only_btn.innerText = "Скрыть польз."
            only_btn.classList.remove("from_blacklist")
            only_btn.classList.add("to_blacklist")
            console.log(only_btn)
            showAddsByUserId(user_id)
        }
    }
}

function listenerBlacklistADBtn(addID, element){
    let btns = element.getElementsByClassName("avito_blacklist_add")
    if (btns.length > 0 ){
        let btn = btns[0]
        let btn_text = btn.innerText
        if (btn_text === "Скрыть объяв.") {
            addADToBlacklist(addID);
            let only_btn = btn.getElementsByClassName("to_blacklist")[0]
            only_btn.innerText = "Показать объяв."
            only_btn.classList.remove("to_blacklist")
            only_btn.classList.add("from_blacklist")

            element.classList.add("avito_element")

            if (hide_bool) {
                element.classList.add("hided_element")
            } else {
                element.classList.remove("hided_element")
            }

            let hide_btn = document.getElementsByClassName("hided_elements")[0]
            hide_btn.after(element);

        } else {
            removeADFromBlacklist(addID);
            let only_btn = btn.getElementsByClassName("from_blacklist")[0]
            only_btn.innerText = "Скрыть объяв."
            only_btn.classList.remove("from_blacklist")
            only_btn.classList.add("to_blacklist")

            element.classList.remove("avito_element")
            element.classList.remove("hided_element")

            let hide_btn = document.getElementsByClassName("hided_elements")[0]
            hide_btn.before(element);
        }
    }
}


function changeADStatus(in_blacklist, element){
    if (in_blacklist === true) {
        element.classList.add("avito_element")
        if (hide_bool) {
            element.classList.add("hided_element")
        } else {
            element.classList.remove("hided_element")
        }
        let hide_btn = document.getElementsByClassName("hided_elements")[0]
        hide_btn.after(element);

    } else {
        element.classList.remove("avito_element")
        element.classList.remove("hided_element")
        let hide_btn = document.getElementsByClassName("hided_elements")[0]
        hide_btn.before(element);
    }
}

function hideAddsByUserId(user_id){
    createHideBtn()
    let adds = document.querySelectorAll('[data-marker="item"]');
    adds.forEach((element) => {
        const addId = element.getAttribute("data-item-id");
        let divs = element.getElementsByClassName(user_info_div_class)
        if (divs.length > 0) {
            let userData = getData(divs[0])
            let user_id_current = userData.user_id
            if (user_id === user_id_current){

                element.classList.add("avito_element")

                if (hide_bool) {
                    element.classList.add("hided_element")
                } else {
                    element.classList.remove("hided_element")
                }

                let hide_btn = document.getElementsByClassName("hided_elements")[0]
                hide_btn.after(element);

                let search_id = addId + '_blacklist_ad';
                let in_blacklist = blacklist_ads.includes(search_id);

                const buttons = element.getElementsByClassName(actions_class)[0] || element.getElementsByClassName(buttons_class)[0];
                defineBtnTitleUser(buttons, true, userData, element);
                defineBtnTitleAd(buttons, in_blacklist, addId, element);
            }
        }
    })
}

function showAddsByUserId(user_id){


    createHideBtn()

    let adds = document.querySelectorAll('[data-marker="item"]');
    adds.forEach((element) => {
        const addId = element.getAttribute("data-item-id");

        let divs = element.getElementsByClassName(user_info_div_class)
        if (divs.length > 0) {
            let userData = getData(divs[0])
            let user_id_current = userData.user_id
            if (user_id === user_id_current){

                let hide_btn = document.getElementsByClassName("hided_elements")[0]
                hide_btn.before(element);

                let search_id = addId + '_blacklist_ad';
                let in_blacklist = blacklist_ads.includes(search_id);

                element.classList.remove("avito_element")
                element.classList.remove("hided_element")

                const buttons = element.getElementsByClassName(actions_class)[0] || element.getElementsByClassName(buttons_class)[0];
                defineBtnTitleUser(buttons, false, userData, element);
                defineBtnTitleAd(buttons, in_blacklist, addId, element);

            }
        }
    })
}

function defineBtnTitleUser(buttons, in_blacklist, userData, element){
    // функция проверяет наличие кнопки и добавляет/меняет название кнопки пользователя

    const userBtn = buttons.querySelector(".avito_blacklist_user");
    const text = in_blacklist ? "Показать польз." : "Скрыть польз.";
    const classBtn = in_blacklist ? "from_blacklist" : "to_blacklist";


    if (!userBtn) {

        const html = `
                <div class="avito_blacklist_user">
                  <div class="messenger-button-root-X8WGM messenger-button-root_fullwidth-AeoEu messenger-button-root_header-cMTcq">
                    <button class="button-button-CmK9a button-size-s-r9SeD button-default-_Uj_C width-width-12-_MkqF" aria-busy="false">
                      <span class="button-textBox-_SF60">
                        <div class="${classBtn}">${text}</div>
                      </span>
                    </button>
                  </div>
                </div>
              `;
        buttons.insertAdjacentHTML("beforeend", html);
        const userBtn = buttons.querySelector(".avito_blacklist_user");
        userBtn.addEventListener("click", () => {
            listenerBlacklistBtn(userData, element);
        });
    } else {


        if (userBtn.querySelector(".from_blacklist") !== null){
            let user_button = userBtn.querySelector(".from_blacklist")
            user_button.className = classBtn;
            user_button.textContent = text;
        }

        if (userBtn.querySelector(".to_blacklist") !== null){
            let user_button = userBtn.querySelector(".to_blacklist")
            user_button.className = classBtn;
            user_button.textContent = text;
        }
    }
}

function defineBtnTitleAd(buttons, in_blacklist, addId, element){
    // функция проверяет наличие кнопки и добавляет/меняет название кнопки объявление
    const addBtn = buttons.querySelector(".avito_blacklist_add");
    const text = in_blacklist ? "Показать объяв." : "Скрыть объяв.";
    const classBtn = in_blacklist ? "from_blacklist" : "to_blacklist";

    if (!addBtn) {
        const html = `
                    <div class="avito_blacklist_add">
                      <div class="messenger-button-root-X8WGM messenger-button-root_fullwidth-AeoEu messenger-button-root_header-cMTcq">
                        <button class="button-button-CmK9a button-size-s-r9SeD button-default-_Uj_C width-width-12-_MkqF" aria-busy="false">
                          <span class="button-textBox-_SF60">
                            <div class="${classBtn}">${text}</div>
                          </span>
                        </button>
                      </div>
                    </div>
                  `;
        buttons.insertAdjacentHTML("beforeend", html);
        const addBtn = buttons.querySelector(".avito_blacklist_add");
        addBtn.addEventListener("click", () => {
            listenerBlacklistADBtn(addId, element);
        });
    } else {
        if (addBtn.querySelector(".from_blacklist")){
            let ad_btn = addBtn.querySelector(".from_blacklist")
            ad_btn.className = classBtn;
            ad_btn.textContent = text;
        }

        if (addBtn.querySelector(".to_blacklist")){
            let ad_btn = addBtn.querySelector(".to_blacklist")
            ad_btn.className = classBtn;
            ad_btn.textContent = text;
        }
    }
}


function addButton(element, userData){

    // Функция добавляет кнопку убрать в ЧС пользователя или объявление
    // на вход принимает element - элемент объявления и userData
    // {
    //     "user_id": "4f66524b6acd662aec506586e9930306",
    //     "user_name": "Саруханян Рузанна Егишовна",
    //     "user_url": "https://www.avito.ru/user/4f66524b6acd662aec506586e9930306/profile?src=search_seller_info",
    //     "add_id": "2473778779"
    // }


    const addId = element.getAttribute("data-item-id");
    const userId = userData.user_id;
    const buttons = element.getElementsByClassName(actions_class)[0] || element.getElementsByClassName(buttons_class)[0];

    defineBtnTitleUser(buttons, blacklist_users.includes(userId + '_blacklist_user'), userData, element);
    defineBtnTitleAd(buttons, blacklist_ads.includes(addId + '_blacklist_ad'), addId, element);


}

function removeButton(buttons) {

    // Функция удаляет кнопки блокировки/разблокировки пользователя

    if (buttons[0].getElementsByClassName("avito_blacklist_user").length > 0 ){
        buttons[0].getElementsByClassName("avito_blacklist_user")[0].remove();
    }
    if (buttons[0].getElementsByClassName("avito_blacklist_add").length > 0 ){
        buttons[0].getElementsByClassName("avito_blacklist_add")[0].remove();
    }
}

function createHideBtn(){

    // Функция добавляет элемент в конец списка, под который прячутся все скрытые объявления
    

    if (document.getElementsByClassName("hided_elements").length === 0){
        let hided_element = "<h4 class=\"hided_elements\">Показать заблокированные объявления</h4>"

        let adds_div = document.getElementsByClassName(adds_class)[0]
        if (document.getElementsByClassName(adds_class).length > 0){
            adds_div.insertAdjacentHTML("beforeend", hided_element);
            let hide_btn = document.getElementsByClassName("hided_elements")[0]

            hide_btn.addEventListener("click", () => {
                let adds_avito = document.getElementsByClassName("avito_element");
                if (hide_bool) {
                    hide_bool = false
                    for (const element of adds_avito) {
                        element.classList.remove("hided_element")
                    }
                    hide_btn.innerHTML = "Скрыть заблокированные объявления"
                } else {
                    hide_bool = true
                    for (const element of adds_avito) {
                        element.classList.add("hided_element")
                    }
                    hide_btn.innerHTML = "Показать заблокированные объявления"

                }

            })
        }

    }

}

function addUserButtonsAndListeners(element){
    
    const addId = element.getAttribute("data-item-id");

    let divs = element.getElementsByClassName(user_info_div_class)
    if (divs.length > 0) {
        let userData = getData(divs[0])
        userData.add_id = addId
        let userId = userData.user_id

        // TODO: Sync func here - rewrite checking user in blacklist

        if (blacklist_users.includes(userId + '_blacklist_user') ) {
            hideAddsByUserId(userId)
        } else {
            showAddsByUserId(userId)
            changeADStatus(blacklist_ads.includes(addId + '_blacklist_ad'), element);
        }

        let action_btns = element.getElementsByClassName(actions_class)
        if (action_btns.length > 0) {
            addButton(element, userData)
        }

    }
    if (element.getElementsByTagName('div').length > 0){
        element.getElementsByTagName('div')[0].addEventListener("mouseenter", () => {
            let divs = element.getElementsByClassName(user_info_div_class)
            if (divs.length > 0) {
                let userData = getData(divs[0])
                addButton(element, userData)

            }
        })
        element.getElementsByTagName('div')[0].addEventListener("mouseleave", () => {
            let divs = element.getElementsByClassName(user_info_div_class)
            if (divs.length > 0) {

                let buttons = element.getElementsByClassName(buttons_class)
                removeButton(buttons)

            }
        })
    }



}

function checkIfUserButtonsHave(){

    console.log("Проверка на наличие кнопок")
    let btns = document.getElementsByClassName("avito_blacklist_user")
    return btns.length > 0
}

function checkIfUserButtonsHaveUserPage(){

    console.log("Проверка на наличие кнопок на страницу пользователя")
    let btns = document.getElementsByClassName('blacklist_user_page')
    return btns.length > 0
}

function getDataFromAdd(element){

    let id = element.getAttribute('data-item-id');
    let name;
    let price;
    let current_datetime = new Date().toLocaleString('ru-RU', {year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'});

    let names = element.querySelectorAll('[itemprop="name"]');
    if (names.length > 0){
        name = names[0].textContent;
    }

    let prices = element.querySelectorAll('[itemprop="price"]');
    if (prices.length > 0){
        price = prices[0].getAttribute('content');
    }

    return {
        'id': id,
        'name': name,
        'price': price,
        'datetime': current_datetime
    }
}

function getDataFromDetailAdd(){

    let id;
    let lat;
    let lon;
    let name;
    let address;
    let description;
    let user;

    let divs_for_id = document.querySelectorAll('div[class="style-item-map-wrapper-ElFsX style-expanded-x335n"]');
    if (divs_for_id.length > 0){
        id = divs_for_id[0].getAttribute('data-item-id');
        lat = divs_for_id[0].getAttribute('data-map-lat');
        lon = divs_for_id[0].getAttribute('data-map-lon');
    }

    let divs_for_name = document.querySelectorAll('span[itemprop="name"]');
    if (divs_for_name.length > 0){
        name = divs_for_name[0].textContent;
    }

    let divs_for_location = document.querySelectorAll('div[itemprop="address"]');
    if (divs_for_location.length > 0){
        address = divs_for_location[0].textContent;
    }

    let divs_for_description = document.querySelectorAll('div[itemprop="description"]');
    if (divs_for_description.length > 0){
        description = divs_for_description[0].textContent;
    }

    let divs_for_seller = document.querySelectorAll('div[data-marker="item-view/seller-info"]');
    if (divs_for_seller.length > 0){
        let div_seller = divs_for_seller[0];
        let href;
        let user_id;
        let user_name;

        let hrefs = div_seller.querySelectorAll('a[data-marker="seller-link/link"]');
        if (hrefs.length > 0){
            href = hrefs[0].getAttribute('href')
            user_id = href.match(regexp)[1];
            user_name = hrefs[0].querySelectorAll('span')[0].textContent;
        }

        let amount_adds = '0';
        let amount_adds_divs = document.querySelectorAll('div[class="subscription-buttons-row-VT27g"]')
        if (amount_adds_divs.length >0){
            amount_adds = amount_adds_divs[0].textContent.replace(' объявлений пользователя', '').replace(' объявления пользователя', '');
        }

        user = {
            "id": user_id,
            "url": href,
            "name": user_name,
            "amount_adds": amount_adds
        }

    }






    console.log({
        "id": id,
        "location":{
            "lat": lat,
            "lon": lon,
            "address": address
        },
        "name": name,
        "description": description,
        "user": user
    })
}


function main(){

    createHideBtn()

    //console.log("Добавлены кнопки к объявлениям")

    let adds = getADS();

    adds.forEach((element) => {
        addUserButtonsAndListeners(element);
    })

    //getDataFromDetailAdd()
}

function getElementByXpath(path) {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

function draw_UI_in_user_page(){

    let user_id;

    if (window.location.toString().includes('www.avito.ru/user/')){
        user_id = window.location.toString().split('/')[4]
    } else {
        user_id = window.location.toString().split('sellerId')[1].replace('=', '')
    }

    if (user_id === undefined){
        user_id = getElementByXpath("/html/body/script[1]/text()").data.split('sellerId')[1].split('%22%3A%22')[1].split('%22%2C%22')[0]
    }

    let search_id = user_id + '_blacklist_user';

    let buttons = document.getElementsByClassName(buttons_in_user_page_class)[0]

    let button_show = "<section id=\"blacklist_info\" class=\"blacklist_user_page\"><div class=\"SubscribeInfo-subscribe-nkSmH\"><button type=\"button\" data-marker=\"remove_from_blacklist\" class=\"styles-module-root-C_ES7 styles-module-root_size_m-_IdhI styles-module-root_preset_secondary-_C3UZ styles-module-root_fullWidth-YF4yL\"><span class=\"styles-module-wrapper-zmlhz\"><span class=\"styles-module-text-_0LXs styles-module-text_size_m-i7N8V\">Показать пользователя</span></span></button></div></section>"
    let button_hide = "<section id=\"blacklist_info\" class=\"blacklist_user_page\"><div class=\"SubscribeInfo-subscribe-nkSmH\"><button type=\"button\" data-marker=\"add_in_blacklist\" class=\"styles-module-root-C_ES7 styles-module-root_size_m-_IdhI styles-module-root_preset_secondary-_C3UZ styles-module-root_fullWidth-YF4yL\"><span class=\"styles-module-wrapper-zmlhz\"><span class=\"styles-module-text-_0LXs styles-module-text_size_m-i7N8V\">Скрыть пользователя</span></span></button></div></section>"

    if (blacklist_users.includes(search_id)){

        let badge_bar = document.getElementById(badge_bar_id);
        let html_bl = "<div class=\"ProfileBadge-root-bcR8G ProfileBadge-cloud-vOPD1 ProfileBadge-activatable-_4_K8 bad_badge\" style=\"--badge-font-color:#000000;--badge-bgcolor:#f8cbcb;--badge-hover-bgcolor:#fd8181\" data-marker=\"badge-102\"><div class=\"ProfileBadge-aside-_0Ky7\"><div class=\"ProfileBadge-icon-wrap-p9n7e\"><img class=\"ProfileBadge-icon-iUIed\" src=\"https://60.img.avito.st/image/1/1.3v4G9ra3qI-xVyBFNvWR3zpUcBW0UXYXeFQ.ZdJ7TPsRy16QtmiICqWohuc48kE3jvh8_F9UOOyoODw\" alt=\"badge icon\" data-marker=\"badge-image-102\"></div></div><div class=\"ProfileBadge-content-o2hDn\"><div class=\"ProfileBadge-title-_Z4By\" data-marker=\"badge-title-102\">Пользователь в ЧС</div><div class=\"ProfileBadge-description-_lbMb\" data-marker=\"badge-description-102\"></div></div></div>"
        badge_bar.insertAdjacentHTML("afterbegin", html_bl);
        buttons.insertAdjacentHTML("beforeend", button_show);

        let hide_btn = document.getElementsByClassName("blacklist_user_page")[0]

        // убрать пользователя из ЧС
        hide_btn.addEventListener("click", () => {
            removeFromBlacklist(user_id)
            document.getElementsByClassName("bad_badge")[0].remove();
            hide_btn.remove();
        })

        console.log("Пользователь в ЧС")
    } else {
        buttons.insertAdjacentHTML("beforeend", button_hide);

        let hide_btn = document.getElementsByClassName("blacklist_user_page")[0]

        // доабвить пользователя из ЧС
        hide_btn.addEventListener("click", () => {
            addUserToBlacklist(user_id)
            hide_btn.remove();
        })
        console.log("Пользователь не в ЧС")
    }
}

function router() {
    const current_url = window.location.toString();
    if (current_url.includes('www.avito.ru/user/') || current_url.includes('sellerId')){

        load_arrays();

        document.addEventListener("DOMContentLoaded", () => {
            draw_UI_in_user_page()
        });

        const interval = setInterval(function() {
            if (!checkIfUserButtonsHaveUserPage()){
                draw_UI_in_user_page();
            }
        }, 500);


    } else {
        console.log("search page")

        document.addEventListener("DOMContentLoaded", () => {
            //console.log("DOM готов!")
            main();
        });

        const interval = setInterval(function() {

            if (!checkIfUserButtonsHave()){
                main()

            }
        }, 5000);
    }
}

router()
