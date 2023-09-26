/*chrome.runtime.onInstalled.addListener(function (object) {

    if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {

        let externalUrl = "https://docs.google.com/document/d/1-c-i8uzRbrpEL9QxFl5TW9ONoFoN2DRWlC7c0RnrBlQ/edit?usp=sharing";
        chrome.tabs.create({ url: externalUrl }, function (tab) {
            console.log("New tab launched with instruction.html");
        });

    } else {

        let externalUrl = "https://docs.google.com/document/d/1YUzZC5kDdXqXo0QI-zatldoJXGm6UQIZ8HfLCyHhSqc/edit?usp=sharing";
        chrome.tabs.create({ url: externalUrl }, function (tab) {
            console.log("New tab launched with update_instruction.html")
        });

    }
});*/