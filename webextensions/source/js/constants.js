"use strict";

const IS_FIREFOX = ((ua)=>{return ua && ua.indexOf("Firefox") != -1})(navigator.userAgent);

const OPTION_DEFAULT ={
  "downloadWhenNice": false,
  "downloadWhenClickMiddle": false,
  "downloadOriginalSize": true,
  "saveMeta": true,
  "saveMetaWithPath": true,
  "saveHistory": true,
  "saveHistoryWithDetails": false,
  "confirmExistingDownload": true,
  "overwriteExistingDownload": false,
  "showIllustRemains": true,
  "hideDownloadShelf": false,
  "cleanDownloadBar": true,
  "displayDownloaded": true,
  "downloadedAnimationStyle": 1,
  "markDownloaded": true,
  "shortTagsMaxLength": 8,
  "forceCheckMangaImagesAll": false,
  "defaultFilename": "AnkPixiv/?site-name?/(?member-id?) ?memoized-name?/?illust-year?-?illust-month?-?illust-day? (?illust-id?) ?title?",
  "mangaImagesSaveToFolder": true,
  "ignoreWrongDatetimeFormat": false,
  "warnWrongDatetimeFormat": true,
  "largeOnMiddle": true,
  "largeImageSize": 0,
  "dontResizeIfSmall": false,
  "adjustFacingImageHeight": true,
  "maxPanelOpacity": 10,
  "minPanelOpacity": 0,
  "panelSize": 0,
  "loopPage": false,
  "swapArrowButton": false,
  "useFacingView": true,
  "useLoadProgress": true,
  "useImagePrefetch": false,
  "imagePrefetchSize": 5,
  "viewOriginalSize": true,
  "openCaption": false,
  "xhrFromBackgroundPage": true,
  "logLevel": 3,
  "useExperimentalModule": false,
  "xhrTimeout": 30000,
  "downloadTimeout": 60000,
  "openCaptionDelay": 1000,
  "historyCacheSize": 200,
  "siteModules": {
    "PXV":{"enabled": true, "experimental": false, "useAutoDownload": true, "useDisplayDownloaded": true, "useMarkDownloaded": true, "useViewer": true, "name": "Pixiv", "folder": "Pixiv", "_mod_selector": {}},
    "NJE":{"enabled": true, "experimental": false, "useAutoDownload": true, "useDisplayDownloaded": true, "useMarkDownloaded": true, "useViewer": true, "name": "Nijie", "folder": "Nijie", "_mod_selector": {}},
    "NCS":{"enabled": true, "experimental": false, "useAutoDownload": true, "useDisplayDownloaded": true, "useMarkDownloaded": true, "useViewer": true, "name": "Nicosei", "folder": "Nicosei", "_mod_selector": {}},
    "TNM":{"enabled": true, "experimental": false, "useAutoDownload": true, "useDisplayDownloaded": true, "useMarkDownloaded": true, "useViewer": true, "name": "Tinami", "folder": "Tinami", "_mod_selector": {}},
    "dART":{"enabled": true, "experimental": false, "useAutoDownload": true, "useDisplayDownloaded": true, "useMarkDownloaded": true, "name": "DeviantArt", "folder": "DeviantArt", "_mod_selector": {}},
    "TWT":{"enabled": true, "experimental": false, "useDisplayDownloaded": true, "name": "Twitter", "folder": "Twitter", "_mod_selector": {}},
    "TDK":{"enabled": true, "experimental": false, "useDisplayDownloaded": true, "name": "Tweetdeck", "folder": "Twitter", "_mod_selector": {}}
  },
  "selector_overrode": null,
  "version": chrome.runtime.getManifest().version
};

const IMPORT_UNITS = 1000;
const EXPORT_UNITS = 1000;

