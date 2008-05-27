
var ap = AnkPixiv = {};

AnkPixiv.SYS_SLASH = (function () {
  try {
    var props = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
    var file = props.get("ProfD", Components.interfaces.nsIFile);
    file.append('dummy');
    return (file.path.indexOf('/') != -1) ? '/' : '\\';
  } catch (e) {
    return '/';
  }
})();

AnkPixiv.fixFilename = function (filename) {
  return filename.replace(/[\\\/:,;\*\?\"<>\|]/g, '_');
};

AnkPixiv.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);


AnkPixiv.getBoolPref = function (name, def) {
  try {
    return this.prefs.getBoolPref('extensions.ankpixiv.' + name);
  } catch (e) {
    return def;
  }
};


AnkPixiv.getCharPref = function (name, def) {
  try {
    return this.prefs.getComplexValue('extensions.ankpixiv.' + name, Components.interfaces.nsISupportsString).data;
  }
  catch (e) {
    try {
      return this.prefs.getCharPref('extensions.ankpixiv.' + name);
    } catch (e) {
      return def;
    }
  }
};


AnkPixiv.setCharPref = function (name, value) {
  var str = Components.classes["@mozilla.org/supports-string;1"]
              .createInstance(Components.interfaces.nsISupportsString);
  str.data = value;
  this.prefs.setComplexValue('extensions.ankpixiv.' + name, Components.interfaces.nsISupportsString, str);
};


AnkPixiv.currentDocument = function () {
  return window.content.document;
};


AnkPixiv.currentLocation = function () {
  return window.content.document.location.href;
};


AnkPixiv.findNodeByXPath = function (xpath) {
  var doc = this.currentDocument();
  return doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
};


AnkPixiv.getCurrentImagePath = function () {
  if (this.currentLocation().match(/mode=medium/)) {
    var elem = this.findNodeByXPath('/html/body/div/div[2]/div/div[2]/div[6]/a/img');
  } else {
    var elem = this.findNodeByXPath('/html/body/div/a/img');
  }
  return elem && elem.src.replace(/_m\./, '.');
};


AnkPixiv.showFilePicker = function (defaultFilename) {
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
  var filePicker = Components.classes['@mozilla.org/filepicker;1'].createInstance(nsIFilePicker);
  filePicker.appendFilters(nsIFilePicker.filterAll);
  filePicker.init(window, "pixiviiiiieee", nsIFilePicker.modeSave);
  filePicker.defaultString = defaultFilename;

  var prefInitDir = this.getCharPref('initialDirectory');
  if (prefInitDir) {
    var initdir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    initdir.initWithPath(prefInitDir);
    filePicker.displayDirectory = initdir;
  }
  
  return (filePicker.show() == nsIFilePicker.returnOK) && filePicker;
};


AnkPixiv.showDirectoryPicker = function (defaultPath) {
  try {
    var nsIFilePicker = Components.interfaces.nsIFilePicker;
    var filePicker = Components.classes['@mozilla.org/filepicker;1'].createInstance(nsIFilePicker);
    filePicker.init(window, "pixiviiiiieee", nsIFilePicker.modeGetFolder);
    filePicker.appendFilters(nsIFilePicker.filterAll);
  
    if (filePicker.show() == nsIFilePicker.returnOK) {
      return filePicker.file.path;
    }
  }
  catch (e) {
    alert(e);
  }
};


AnkPixiv.queryInitialDirectory = function () {
  var dir = this.showDirectoryPicker(this.getCharPref('initialDirectory'));
  if (dir) {
    var edit = document.getElementById('initial-directory-textbox');
    edit.value = dir;
    edit.focus();
    return this.setCharPref('initialDirectory', dir);
  }
};


AnkPixiv.getSaveFilePath = function (defaultFilename) {
  if (this.getBoolPref('showSaveDialog', true)) {
    return this.showFilePicker(defaultFilename);
  } else {
    var prefInitDir = this.getCharPref('initialDirectory');
    var IOService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
    var temp;
    var url = 'file://' + prefInitDir + this.SYS_SLASH + defaultFilename.replace(/\/([^\/]+$)/, '-$1');
    try { // Mozilla 1.2 ...
      var fileHandler = IOService.getProtocolHandler('file').QueryInterface(Components.interfaces.nsIFileProtocolHandler);
      temp = fileHandler.getFileFromURLSpec(url);
    }
    catch(ex) { // ... Mozilla 1.1
      try {
        temp = IOService.getFileFromURLSpec(url);
      }
      catch(ex) { // ... Mozilla 1.0.x 以前
        temp = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
        IOService.initFileFromURLSpec(temp, url);
      }
    }
    var res = IOService.newFileURI(temp);
    return {fileURL: res, file: res};
  }
};


AnkPixiv.downloadFile = function (url, referer, filename) {
  // 保存ダイアログ
  var filePicker = this.getSaveFilePath(filename);
  if (!filePicker)
    return;

  // 各種オブジェクトの生成
  var sourceURI = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService).newURI(url, null, null);
  var dlmanager = Components.classes["@mozilla.org/download-manager;1"].getService(Components.interfaces.nsIDownloadManager);
  var wbpersist = Components.classes['@mozilla.org/embedding/browser/nsWebBrowserPersist;1'].createInstance(Components.interfaces.nsIWebBrowserPersist);
  var refererURI = Components.classes["@mozilla.org/network/standard-url;1"].createInstance(Components.interfaces.nsIURI);
  refererURI.spec = referer;

  // ダウンロードマネジャに追加
  var download = dlmanager.addDownload(0, sourceURI, filePicker.fileURL, filename, null, null, null, null, wbpersist);

  // キャッシュ
  var cache = null;
  try {
    with (getWebNavigation().sessionHistory) 
      cache = getEntryAtIndex(index, false).QueryInterface(Components.interfaces.nsISHEntry).postData;
  } catch (e) {
  }
    
    
  // 保存開始
  wbpersist.progressListener = download;
  wbpersist.saveURI(sourceURI, cache, refererURI, null, null, filePicker.file);

  // 成功
  return true;
};


AnkPixiv.test = function () {
  if (!this.currentLocation().match(/\.pixiv\.net\/member_illust.php\?/))
    return false;
  var url = this.getCurrentImagePath();
  var ref = this.currentLocation().replace(/mode=medium/, 'mode=big');
  var fname = this.currentDocument().title.replace(' [pixiv]', '') + url.match(/\.\w+$/)[0];
  return this.downloadFile(url, ref, fname);
};

