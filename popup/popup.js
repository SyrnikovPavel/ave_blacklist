// browser compatibility
if (typeof browser === "undefined") {
  var browser = chrome;
}

const NOTES_USERS_KEY = "notesUsers";
const NOTES_OFFERS_KEY = "notesOffers";
const NOTES_MAX_LENGTH = 2000;

const autoPaginationToggle = document.getElementById("autoPaginationToggle");
const cityFilterToggle = document.getElementById("cityFilterToggle");
const hideReservedToggle = document.getElementById("hideReservedToggle");
const hideInstallmentsToggle = document.getElementById("hideInstallmentsToggle");
const notesUsersTab = document.getElementById("notesUsersTab");
const notesOffersTab = document.getElementById("notesOffersTab");
const notesList = document.getElementById("notesList");

let activeNotesTab = "users";
let notesUsersCache = {};
let notesOffersCache = {};

function hasNumber(myString) {
  return /\d/.test(myString);
}

function syncStore(key, objectToStore) {
  var jsonstr = JSON.stringify(objectToStore);
  var i = 0;
  var storageObj = {};

  while (jsonstr.length > 0) {
    var index = key + "_" + i++;
    const maxLength = browser.storage.local.QUOTA_BYTES_PER_ITEM - index.length - 2;
    var valueLength = Math.min(jsonstr.length, maxLength);
    var segment = jsonstr.substr(0, valueLength);
    for (let j = 0; j < browser.storage.local.QUOTA_BYTES_PER_ITEM; j++) {
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
  return browser.storage.local.set(storageObj);
}

function syncGet(key) {
  return new Promise((resolve) => {
    browser.storage.local.get(null, function (items) {
      const keyArr = [];
      for (let item of Object.keys(items)) {
        if (item.includes(key) && hasNumber(item)) {
          keyArr.push(item);
        }
      }
      browser.storage.local.get(keyArr, (chunkItems) => {
        const keys = Object.keys(chunkItems);
        const length = keys.length;
        let results = "";
        if (length > 0) {
          const sepPos = keys[0].lastIndexOf("_");
          const prefix = keys[0].substring(0, sepPos);
          for (let x = 0; x < length; x++) {
            results += chunkItems[`${prefix}_${x}`];
          }
          results = results
            .replaceAll("[", "")
            .replaceAll("]", ",")
            .replaceAll(" ", "")
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

async function clearChunkedStorageByPrefix(prefix) {
  const allItems = await browser.storage.local.get(null);
  const keysToRemove = Object.keys(allItems).filter((key) => {
    if (!key.startsWith(`${prefix}_`)) return false;
    return hasNumber(key);
  });
  if (keysToRemove.length > 0) {
    await browser.storage.local.remove(keysToRemove);
  }
}

function normalizeUserBlacklistId(userId) {
  return String(userId).replace("_blacklist_user", "").trim();
}

function normalizeOfferBlacklistId(offerId) {
  return String(offerId).replace("_blacklist_ad", "").trim();
}

function sanitizeNotesMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const normalized = {};
  for (const [id, note] of Object.entries(value)) {
    if (!note || typeof note !== "object") continue;
    const text = typeof note.text === "string" ? note.text.slice(0, NOTES_MAX_LENGTH) : "";
    if (!text.trim()) continue;
    normalized[id] = {
      text,
      updatedAt: typeof note.updatedAt === "string" ? note.updatedAt : null,
      displayName: typeof note.displayName === "string" ? note.displayName : undefined,
      title: typeof note.title === "string" ? note.title : undefined,
      url: typeof note.url === "string" ? note.url : undefined,
    };
  }
  return normalized;
}

function mergeNotesByUpdatedAt(currentNotes, importedNotes) {
  const merged = { ...sanitizeNotesMap(currentNotes) };
  const sanitizedImported = sanitizeNotesMap(importedNotes);

  for (const [entityId, importedNote] of Object.entries(sanitizedImported)) {
    const existing = merged[entityId];
    if (!existing) {
      merged[entityId] = importedNote;
      continue;
    }

    const importedTime = Date.parse(importedNote.updatedAt || "");
    const existingTime = Date.parse(existing.updatedAt || "");
    if (!Number.isNaN(importedTime) && !Number.isNaN(existingTime)) {
      if (importedTime >= existingTime) {
        merged[entityId] = importedNote;
      }
      continue;
    }

    if (!Number.isNaN(importedTime)) {
      merged[entityId] = importedNote;
    }
  }

  return merged;
}

async function loadNotesCaches() {
  const storage = await browser.storage.local.get([NOTES_USERS_KEY, NOTES_OFFERS_KEY]);
  notesUsersCache = sanitizeNotesMap(storage[NOTES_USERS_KEY]);
  notesOffersCache = sanitizeNotesMap(storage[NOTES_OFFERS_KEY]);
}

function formatDate(dateIso) {
  if (!dateIso) return "Без даты";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "Без даты";
  return date.toLocaleString("ru-RU");
}

function getNoteEntries() {
  const source = activeNotesTab === "users" ? notesUsersCache : notesOffersCache;
  return Object.entries(source).sort((a, b) => {
    const aTime = Date.parse(a[1].updatedAt || "");
    const bTime = Date.parse(b[1].updatedAt || "");
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return bTime - aTime;
  });
}

async function savePopupNote(entityType, entityId, noteText) {
  const text = String(noteText || "").slice(0, NOTES_MAX_LENGTH);
  const key = entityType === "user" ? NOTES_USERS_KEY : NOTES_OFFERS_KEY;
  const cache = entityType === "user" ? { ...notesUsersCache } : { ...notesOffersCache };

  if (!text.trim()) {
    delete cache[entityId];
  } else {
    const prev = cache[entityId] || {};
    cache[entityId] = {
      ...prev,
      text,
      updatedAt: new Date().toISOString(),
    };
  }

  await browser.storage.local.set({ [key]: cache });
  if (entityType === "user") {
    notesUsersCache = cache;
  } else {
    notesOffersCache = cache;
  }
}

function renderNotesList() {
  notesList.innerHTML = "";
  const entries = getNoteEntries();

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "note-empty";
    empty.textContent = "Заметок пока нет";
    notesList.appendChild(empty);
    return;
  }

  for (const [entityId, note] of entries) {
    const wrapper = document.createElement("div");
    wrapper.className = "note-item";

    const title = document.createElement("p");
    title.className = "note-item-title";
    if (activeNotesTab === "users") {
      title.textContent = note.displayName || `Продавец ${entityId}`;
    } else {
      title.textContent = note.title || `Объявление ${entityId}`;
    }

    const meta = document.createElement("p");
    meta.className = "note-item-meta";
    meta.textContent = `Обновлено: ${formatDate(note.updatedAt)}`;

    const textarea = document.createElement("textarea");
    textarea.className = "note-item-textarea";
    textarea.value = note.text || "";
    textarea.maxLength = NOTES_MAX_LENGTH;

    const actions = document.createElement("div");
    actions.className = "note-item-actions";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Сохранить";
    saveButton.addEventListener("click", async () => {
      await savePopupNote(activeNotesTab === "users" ? "user" : "offer", entityId, textarea.value);
      await loadNotesCaches();
      renderNotesList();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "note-delete-btn";
    deleteButton.textContent = "Удалить";
    deleteButton.addEventListener("click", async () => {
      await savePopupNote(activeNotesTab === "users" ? "user" : "offer", entityId, "");
      await loadNotesCaches();
      renderNotesList();
    });

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.textContent = "Открыть";
    openButton.addEventListener("click", () => {
      if (activeNotesTab === "users") {
        browser.tabs.create({ url: `https://www.avito.ru/user/${entityId}/profile` });
        return;
      }
      if (note.url) {
        browser.tabs.create({ url: note.url });
        return;
      }
      browser.tabs.create({ url: `https://www.avito.ru/all?q=${entityId}` });
    });

    actions.appendChild(saveButton);
    actions.appendChild(deleteButton);
    actions.appendChild(openButton);

    wrapper.appendChild(title);
    wrapper.appendChild(meta);
    wrapper.appendChild(textarea);
    wrapper.appendChild(actions);
    notesList.appendChild(wrapper);
  }
}

function setActiveNotesTab(nextTab) {
  activeNotesTab = nextTab;
  notesUsersTab.classList.toggle("notes-tab-btn-active", nextTab === "users");
  notesOffersTab.classList.toggle("notes-tab-btn-active", nextTab === "offers");
  renderNotesList();
}

async function exportDatabase() {
  const blacklistUsersRaw = await syncGet("blacklistUsers");
  const blacklistOffersRaw = await syncGet("blacklistOffers");
  const storage = await browser.storage.local.get([NOTES_USERS_KEY, NOTES_OFFERS_KEY]);
  const notesUsers = sanitizeNotesMap(storage[NOTES_USERS_KEY]);
  const notesOffers = sanitizeNotesMap(storage[NOTES_OFFERS_KEY]);

  const payload = {
    version: 2,
    blacklistUsers: blacklistUsersRaw.map(normalizeUserBlacklistId).filter(Boolean),
    blacklistOffers: blacklistOffersRaw.map(normalizeOfferBlacklistId).filter(Boolean),
    notesUsers,
    notesOffers,
  };

  const serializedData = JSON.stringify(payload, null, 2);
  const blob = new Blob([serializedData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  browser.downloads.download({
    url,
    filename: "avito_blacklist_database.json",
  });
}

async function exportDatabaseBlacklistUsers() {
  const blacklistUsersRaw = await syncGet("blacklistUsers");
  const users = blacklistUsersRaw.map(normalizeUserBlacklistId).filter(Boolean);
  const serializedData = JSON.stringify(users, null, 2);
  const blob = new Blob([serializedData], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  browser.downloads.download({
    url,
    filename: "avito_blacklist_users_database.json",
  });
}

async function exportDatabaseBlacklistOffers() {
  const blacklistOffersRaw = await syncGet("blacklistOffers");
  const offers = blacklistOffersRaw.map(normalizeOfferBlacklistId).filter(Boolean);
  const serializedData = JSON.stringify(offers, null, 2);
  const blob = new Blob([serializedData], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  browser.downloads.download({
    url,
    filename: "avito_blacklist_offers_database.json",
  });
}

function openNewTab() {
  browser.tabs.create({ url: browser.runtime.getURL("popup/import_from_text.html") });
}

function readJsonFromInput(fileInputId) {
  const input = document.getElementById(fileInputId);
  input.value = "";
  input.click();

  return new Promise((resolve, reject) => {
    const onChange = (event) => {
      input.removeEventListener("change", onChange);
      const file = event.target.files?.[0];
      if (!file) {
        reject(new Error("Файл не выбран"));
        return;
      }
      const reader = new FileReader();
      reader.readAsText(file, "UTF-8");
      reader.onload = (readerEvent) => {
        try {
          resolve(JSON.parse(readerEvent.target.result));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    };
    input.addEventListener("change", onChange);
  });
}

function toBlacklistUsersWithSuffix(userIds) {
  return userIds
    .map((userId) => normalizeUserBlacklistId(userId))
    .filter(Boolean)
    .map((userId) => `${userId}_blacklist_user`);
}

function toBlacklistOffersWithSuffix(offerIds) {
  return offerIds
    .map((offerId) => normalizeOfferBlacklistId(offerId))
    .filter(Boolean)
    .map((offerId) => `${offerId}_blacklist_ad`);
}

function parseLegacyDatabase(data) {
  const users = [];
  const offers = [];
  Object.keys(data).forEach((key) => {
    if (key.includes("_blacklist_user")) users.push(key);
    if (key.includes("_blacklist_ad")) offers.push(key);
  });
  return { users, offers };
}

async function saveBlacklistArrays(usersWithSuffix, offersWithSuffix) {
  await clearChunkedStorageByPrefix("blacklistUsers");
  await clearChunkedStorageByPrefix("blacklistOffers");
  await syncStore("blacklistUsers", usersWithSuffix);
  await syncStore("blacklistOffers", offersWithSuffix);
}

async function importFromJSONFile() {
  try {
    const data = await readJsonFromInput("fileInput");

    if (data && typeof data === "object" && data.version === 2) {
      const usersWithSuffix = toBlacklistUsersWithSuffix(Array.isArray(data.blacklistUsers) ? data.blacklistUsers : []);
      const offersWithSuffix = toBlacklistOffersWithSuffix(Array.isArray(data.blacklistOffers) ? data.blacklistOffers : []);
      await saveBlacklistArrays(usersWithSuffix, offersWithSuffix);

      const existing = await browser.storage.local.get([NOTES_USERS_KEY, NOTES_OFFERS_KEY]);
      const mergedUsers = mergeNotesByUpdatedAt(existing[NOTES_USERS_KEY], data.notesUsers || {});
      const mergedOffers = mergeNotesByUpdatedAt(existing[NOTES_OFFERS_KEY], data.notesOffers || {});
      await browser.storage.local.set({
        [NOTES_USERS_KEY]: mergedUsers,
        [NOTES_OFFERS_KEY]: mergedOffers,
      });
      await loadNotesCaches();
      renderNotesList();
      return;
    }

    const legacy = parseLegacyDatabase(data || {});
    await saveBlacklistArrays(legacy.users, legacy.offers);
  } catch (error) {
    console.error("Failed to import database:", error);
  }
}

async function importFromJSONFileUsers() {
  try {
    const newUserIds = await readJsonFromInput("fileInputUsers");
    const usersWithSuffix = toBlacklistUsersWithSuffix(Array.isArray(newUserIds) ? newUserIds : []);
    await clearChunkedStorageByPrefix("blacklistUsers");
    await syncStore("blacklistUsers", usersWithSuffix);
  } catch (error) {
    console.error("Failed to parse users JSON:", error);
  }
}

async function importFromJSONFileOffers() {
  try {
    const newOfferIds = await readJsonFromInput("fileInputOffers");
    const offersWithSuffix = toBlacklistOffersWithSuffix(Array.isArray(newOfferIds) ? newOfferIds : []);
    await clearChunkedStorageByPrefix("blacklistOffers");
    await syncStore("blacklistOffers", offersWithSuffix);
  } catch (error) {
    console.error("Failed to parse offers JSON:", error);
  }
}

async function clearDatabase() {
  await clearChunkedStorageByPrefix("blacklistUsers");
  await clearChunkedStorageByPrefix("blacklistOffers");
  await syncStore("blacklistUsers", []);
  await syncStore("blacklistOffers", []);
}

async function clearNotes() {
  await browser.storage.local.set({
    [NOTES_USERS_KEY]: {},
    [NOTES_OFFERS_KEY]: {},
  });
  await loadNotesCaches();
  renderNotesList();
}

function sendToggleMessage(action, isEnabled) {
  browser.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs?.[0]?.id) return;
    browser.tabs.sendMessage(tabs[0].id, { action, isEnabled });
  });
}

async function initializePopup() {
  const toggleState = await browser.storage.local.get([
    "isPaginationEnabled",
    "isCityFilterEnabled",
    "isHideReservedEnabled",
    "isHideInstallmentsEnabled",
  ]);
  autoPaginationToggle.checked = toggleState.isPaginationEnabled !== false;
  cityFilterToggle.checked = toggleState.isCityFilterEnabled || false;
  hideReservedToggle.checked = toggleState.isHideReservedEnabled || false;
  hideInstallmentsToggle.checked = toggleState.isHideInstallmentsEnabled !== false;

  await loadNotesCaches();
  setActiveNotesTab("users");
}

autoPaginationToggle.addEventListener("change", function () {
  const isEnabled = this.checked;
  browser.storage.local.set({ isPaginationEnabled: isEnabled });
  sendToggleMessage("updatePaginationState", isEnabled);
});

cityFilterToggle.addEventListener("change", function () {
  const isEnabled = this.checked;
  browser.storage.local.set({ isCityFilterEnabled: isEnabled });
  sendToggleMessage("updateCityFilterState", isEnabled);
});

hideReservedToggle.addEventListener("change", function () {
  const isEnabled = this.checked;
  browser.storage.local.set({ isHideReservedEnabled: isEnabled });
  sendToggleMessage("updateHideReservedState", isEnabled);
});

hideInstallmentsToggle.addEventListener("change", function () {
  const isEnabled = this.checked;
  browser.storage.local.set({ isHideInstallmentsEnabled: isEnabled });
  sendToggleMessage("updateHideInstallmentsState", isEnabled);
});

notesUsersTab.addEventListener("click", () => setActiveNotesTab("users"));
notesOffersTab.addEventListener("click", () => setActiveNotesTab("offers"));

document.getElementById("exportButton").addEventListener("click", exportDatabase);
document.getElementById("exportUsersButton").addEventListener("click", exportDatabaseBlacklistUsers);
document.getElementById("exportOffersButton").addEventListener("click", exportDatabaseBlacklistOffers);
document.getElementById("importButton").addEventListener("click", importFromJSONFile);
document.getElementById("importButtonUsers").addEventListener("click", importFromJSONFileUsers);
document.getElementById("importButtonOffers").addEventListener("click", importFromJSONFileOffers);
document.getElementById("importText").addEventListener("click", openNewTab);

document.getElementById("clearButton").addEventListener("click", async () => {
  if (!confirm("Будут очищены только черные списки. Продолжить?")) return;
  await clearDatabase();
});

document.getElementById("clearNotesButton").addEventListener("click", async () => {
  if (!confirm("Заметки будут удалены без возможности восстановления. Продолжить?")) return;
  await clearNotes();
});

browser.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[NOTES_USERS_KEY] || changes[NOTES_OFFERS_KEY]) {
    await loadNotesCaches();
    renderNotesList();
  }
});

initializePopup();
