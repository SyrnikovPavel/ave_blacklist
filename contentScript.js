let regexp = /user\/(\S*)\//
let buttons_class = "iva-item-aside-GOesg"
let actions_class = "iva-item-actions-rumkV"
let user_info_div_class = "iva-item-sellerInfo-_q_Uw"
let user_info_href_class = "style-link-STE_U"
let adds_class = "index-root-KVurS"
let hide_bool = true

let item_selector = '[data-marker="item"]'

/*
TODO

REWRITE functions

HIDE/SHOW ADD

*/


// STORAGE

function migrateData() {
    chrome.storage.sync.get("users_blacklist", function(result) {
        let oldBlacklist = result.users_blacklist || [];
        let newBlacklist = {};

        oldBlacklist.forEach(function(userId) {
            newBlacklist[userId + '_blacklist_user'] = true;
        });

        chrome.storage.sync.set(newBlacklist, function() {
            console.log("Migrated users_blacklist data to new format");
        });


    });

    chrome.storage.sync.get("adds_blacklist", function(result) {
        let oldBlacklist = result.users_blacklist || [];
        let newBlacklist = {};

        oldBlacklist.forEach(function(userId) {
            newBlacklist[userId + '_blacklist_ad'] = true;
        });

        chrome.storage.sync.set(newBlacklist, function() {
            console.log("Migrated adds_blacklist data to new format");
        });

    });
}

migrateData();


function addUserToBlacklist(user_id) {
    let search_id = user_id + '_blacklist_user';
    chrome.storage.sync.get(search_id, function(result) {
        if (result[search_id]) {
            console.log(`${search_id} is already in blacklist`);
        } else {
            let data = {};
            data[search_id] = true;
            chrome.storage.sync.set(data, function() {
                console.log(`Added ${search_id} to blacklist`);
            });
        }
    });
}

function addADToBlacklist(ad_id) {
    let search_id = ad_id + '_blacklist_ad';
    chrome.storage.sync.get(search_id, function(result) {
        if (result[search_id]) {
            console.log(`${search_id} is already in blacklist`);
        } else {
            let data = {};
            data[search_id] = true;
            chrome.storage.sync.set(data, function() {
                console.log(`Added ${search_id} to blacklist`);
            });
        }
    });
}

function removeFromBlacklist(username) {
    let search_id = username + '_blacklist_user';
    chrome.storage.sync.get(search_id, function(result) {
        if (result[search_id]) {
            chrome.storage.sync.remove(search_id, function() {
                console.log(`Removed ${search_id} from blacklist`);
            });
        } else {
            console.log(`${search_id} is not in blacklist`);
        }
    });
}

function removeADFromBlacklist(ad_id) {
    let search_id = ad_id + '_blacklist_ad';
    chrome.storage.sync.get(search_id, function(result) {
        if (result[search_id]) {
            chrome.storage.sync.remove(search_id, function() {
                console.log(`Removed ${search_id} from ad blacklist`);
            });
        } else {
            console.log(`${search_id} is not in ad blacklist`);
        }
    });
}

function checkUserInBlacklist(user_id, callback) {
    let search_id = user_id + '_blacklist_user';
    chrome.storage.sync.get(search_id, function(result) {
        callback(result[search_id] ? true : false);
    });
}

function checkADInBlacklist(ad_id, callback) {
    let search_id = ad_id + '_blacklist_ad';
    chrome.storage.sync.get(search_id, function(result) {
        callback(result[search_id] ? true : false);
    });
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
        if (btn_text === "Заблок. польз.") {
            addUserToBlacklist(user_id);
            let only_btn = btn.getElementsByClassName("to_blacklist")[0]
            only_btn.innerText = "Разблок. польз."
            only_btn.classList.remove("to_blacklist")
            only_btn.classList.add("from_blacklist")
            hideAddsByUserId(user_id);
        } else {
            removeFromBlacklist(user_id);
            let only_btn = btn.getElementsByClassName("from_blacklist")[0]
            only_btn.innerText = "Заблок. польз."
            only_btn.classList.remove("from_blacklist")
            only_btn.classList.add("to_blacklist")
            showAddsByUserId(user_id)
        }
    }
}

function listenerBlacklistADBtn(addID, element){
    let btns = element.getElementsByClassName("avito_blacklist_add")
    if (btns.length > 0 ){
        let btn = btns[0]
        let btn_text = btn.innerText
        if (btn_text === "Заблок. объяв.") {
            addADToBlacklist(addID);
            let only_btn = btn.getElementsByClassName("to_blacklist")[0]
            only_btn.innerText = "Разблок. объяв."
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
            only_btn.innerText = "Заблок. объяв."
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

                chrome.storage.sync.get(addId + '_blacklist_ad', function(result) {
                    let in_blacklist = result[user_id + "_blacklist_ad"] || false;

                    if (in_blacklist === false) {

                        element.classList.remove("avito_element")
                        element.classList.remove("hided_element")

                        let hide_btn = document.getElementsByClassName("hided_elements")[0]
                        hide_btn.before(element);
                    }
                })

            }
        }
    })
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


    chrome.storage.sync.get(userId + "_blacklist_user", function(result) {

        let in_blacklist = result[userId + "_blacklist_user"] || false;

        const userBtn = buttons.querySelector(".avito_blacklist_user");
        if (!userBtn) {
            const text = in_blacklist ? "Разблок. польз." : "Заблок. польз.";
            const classBtn = in_blacklist ? "from_blacklist" : "to_blacklist";
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
        }

    });


    chrome.storage.sync.get(addId + "_blacklist_ad", function(result) {

        let in_blacklist = result[addId + "_blacklist_ad"] || false;

        const addBtn = buttons.querySelector(".avito_blacklist_add");
        if (!addBtn) {
            const text = in_blacklist ? "Разблок. объяв." : "Заблок. объяв.";
            const classBtn = in_blacklist ? "from_blacklist" : "to_blacklist";
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
        }
    })


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

    //console.log("createHieBtn");

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

        chrome.storage.sync.get(userId + "_blacklist_user", function(result) {

            let in_blacklist = result[userId + "_blacklist_user"] || false;

            if (in_blacklist === true) {
                hideAddsByUserId(userId)
            } else {
                showAddsByUserId(userId)
                chrome.storage.sync.get(addId + "_blacklist_ad", function(result) {

                    let in_blacklist = result[addId + "_blacklist_ad"] || false;
                    changeADStatus(in_blacklist, element);
                })
            }
        })



        /*
        chrome.storage.sync.get([user_id], function(result) {
            let userDataBlacklist = result[user_id]
            if (userDataBlacklist !== undefined) {
                hideAddsByUserId(user_id)
            } else {
                showAddsByUserId(user_id)
            }
        })
         */

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
    if (btns.length > 0 ){
        //console.log("Кнопки есть")
        return true
    } else {
        //console.log("Кнопки нет")
        return false
    }
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


document.addEventListener("DOMContentLoaded", () => {
    //console.log("DOM готов!")
    main();
});

const interval = setInterval(function() {

    if (!checkIfUserButtonsHave()){
        main()

    }
}, 5000);
