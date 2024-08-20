//browser compatibility
if (typeof browser === "undefined") {
  var browser = chrome;
}

browser.runtime.onInstalled.addListener(function (object) {
  if (object.reason === browser.runtime.OnInstalledReason.INSTALL) {
    let externalUrl = "https://docs.google.com/document/d/1-c-i8uzRbrpEL9QxFl5TW9ONoFoN2DRWlC7c0RnrBlQ/edit?usp=sharing";
    browser.tabs.create({ url: externalUrl }, function () {
      console.log("New tab launched with instruction.html");
    });
  } else {
    /*
        let externalUrl = "https://docs.google.com/document/d/1ao2aAuFiYrRQjB4Fd7gWIbNaLJagpeJjKkOaN-sH9gI/edit?usp=sharing";
        browser.tabs.create({ url: externalUrl }, function (tab) {
            console.log("New tab launched with update_instruction.html")
        });
        */
  }
});
