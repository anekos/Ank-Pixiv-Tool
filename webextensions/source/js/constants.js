"use strict";

const IS_FIREFOX = ((ua)=>{return ua && ua.indexOf("Firefox") != -1})(navigator.userAgent);
const IS_WINDOWS = ((ua)=>{return ua && ua.indexOf("Win") != -1})(navigator.platform);

const EXTENSION_ID = chrome.runtime.getURL('').replace(/\/$/, '');

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
  "saveTagsWithTranslation": false,
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
  "maxFilenameLength": 100,
  "siteModules": {
    //"PXV":{"enabled": true, "experimental": false, "useAutoDownload": true, "useDisplayDownloaded": true, "useMarkDownloaded": true, "useViewer": true, "name": "Pixiv", "folder": "Pixiv"},
    "PXV":{"enabled": true, "experimental": false, "useDisplayDownloaded": true, "useMarkDownloaded": true, "useViewer": true, "name": "Pixiv", "folder": "Pixiv"},
    "PFB":{"enabled": false, "experimental": true, "useDisplayDownloaded": true, "name": "Pixiv Fanbox", "folder": "Pixiv Fanbox"},
    "NJE":{"enabled": true, "experimental": false, "useAutoDownload": true, "useDisplayDownloaded": true, "useMarkDownloaded": true, "useViewer": true, "name": "Nijie", "folder": "Nijie"},
    "NCS":{"enabled": true, "experimental": false, "useAutoDownload": true, "useDisplayDownloaded": true, "useMarkDownloaded": true, "useViewer": true, "name": "Nicosei", "folder": "Nicosei"},
    "TNM":{"enabled": true, "experimental": false, "useAutoDownload": true, "useDisplayDownloaded": true, "useMarkDownloaded": true, "useViewer": true, "name": "Tinami", "folder": "Tinami"},
    "dART":{"enabled": true, "experimental": false, "useAutoDownload": true, "useDisplayDownloaded": true, "useMarkDownloaded": true, "name": "DeviantArt", "folder": "DeviantArt"},
    "TWT":{"enabled": true, "experimental": false, "useDisplayDownloaded": true, "name": "Twitter", "folder": "Twitter", "authToken": ""},
    "TDK":{"enabled": true, "experimental": false, "useDisplayDownloaded": true, "name": "Tweetdeck", "folder": "Twitter"}
  },
  "selector_overrode": null,
  "version": chrome.runtime.getManifest().version
};

const IMPORT_UNITS = 1000;
const EXPORT_UNITS = 1000;

