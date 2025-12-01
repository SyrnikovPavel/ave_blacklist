//browser compatibility
if (typeof browser === "undefined") {
  var browser = chrome;
}

browser.runtime.onInstalled.addListener(function (object) {
  if (object.reason === browser.runtime.OnInstalledReason.INSTALL) {
    let externalUrl = "https://ave.syrnikovpavel.ru/static/instruction/";
    browser.tabs.create({ url: externalUrl }, function () {
      console.log("New tab launched with instruction.html");
    });
  } else if (object.reason === browser.runtime.OnInstalledReason.UPDATE) {
    // Получаем текущую версию расширения
    const currentVersion = browser.runtime.getManifest().version;
    
    let externalUrl;
    if (currentVersion === "1.0.11") {
      externalUrl = "https://ave.syrnikovpavel.ru/static/1.0.11/";
    } else if (currentVersion === "1.0.10") {
      externalUrl = "https://ave.syrnikovpavel.ru/static/1.0.10/";
    } else {
      externalUrl = "https://ave.syrnikovpavel.ru/static/1.0.9.1/";
    }
    
    browser.tabs.create({ url: externalUrl }, function (tab) {
      console.log("New tab launched with update_instruction.html for version " + currentVersion);
    });
  }
});
