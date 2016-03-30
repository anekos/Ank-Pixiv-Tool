"use strict";

{

  let SITES = [
    { id: 'PXV', values: {name: 'pixiv', folder: 'Pixiv', enabled: true, useAutoDownload: true, useViewer: true, experimental: false} },
    { id: 'TWT', values: {name: 'Twitter', folder: 'Twitter', enabled: true, useAutoDownload: true, useViewer: true, experimental: false} }
  ];

  let DEFAULTS = {
    "showSaveDialog": true,
    "downloadWhenRate": false,
    "downloadRate": 10,
    "downloadWhenClickMiddle": false,
    "initialDirectory": "AnkPixiv",
    "downloadOriginalSize": true,
    "unpackUgoiraZip": false,
    "downloadNovelSource": false,
    "saveMeta": true,
    "saveMetaWithPath": false,
    "saveHistory": true,
    "saveIllustInfo": false,
    "confirmExistingDownload": true,
    "confirmExistingDownloadWhenAuto": true,
    "overwriteExistingDownload": false,
    "showIllustRemains": true,
    "showImageRemains": true,
    "showCompletePopup": false,
    "cleanDownloadBar": true,
    "displayDownloaded": true,
    "downloadedAnimationStyle": 1,
    "markDownloaded": true,
    "markUpdated": true,
    "shortTagsMaxLength": 8,
    "forceCheckMangaImagesAll": false,
    "defaultFilename": "AnkPixiv/?site-name?/?memoized-name?/?illust-year?-?illust-month?-?illust-day? ?title?",
    "alternateFilename": "AnkPixiv/?site-name?/?memoized-name?/?illust-year?-?illust-month?-?illust-day? ?title? (?illust-id?)",
    "mangaImagesSaveToFolder": true,
    "mangaImagesSaveToZip": false,
    "ignoreWrongDatetimeFormat": false,
    "warnWrongDatetimeFormat": true,
    "largeOnMiddle": true,
    "largeImageSize": 0,
    "dontResizeIfSmall": true,
    "maxPanelOpacity": 100,
    "minPanelOpacity": 0,
    "panelSize": 0,
    "loopPage": false,
    "swapArrowButton": false,
    "useFacingView": true,
    "useLoadProgress": true,
    "useImagePrefetch": true,
    "viewOriginalSize": true,
    "openComment": false,
    "openCaption": false,
    "allowThirdPartyCookie": false,
    "logLevel": 3,
    "useExperimentalModule": false,
    "outputEpubLimit": 4,
    "xhrTimeout": 30000,
    "recoverTimer": 60000,
    "openCaptionDelay": 1000,
    "siteModules": [],
  };

  SITES.forEach(function (s) {
    var id = s.id;
    DEFAULTS.siteModules.push(id);
    for (var k in s.values) {
      if (s.values.hasOwnProperty(k)) {
        DEFAULTS['siteModule_'+id+'_'+k] = s.values[k];
      }
    }
  });

  var AnkPrefs = new AnkUtils.Preference(DEFAULTS);

}
