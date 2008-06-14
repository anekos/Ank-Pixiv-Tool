
try {

  var AnkUtils = {

    SYS_SLASH: (function () {
      try {
        var props = Components.classes["@mozilla.org/file/directory_service;1"].
                      getService(Components.interfaces.nsIProperties);
        var file = props.get("ProfD", Components.interfaces.nsIFile);
        file.append('dummy');
        return (file.path.indexOf('/') != -1) ? '/' : '\\';
      } catch (e) {
        return '/';
      }
    })(),


    getVersion:  function (id) {
      const ext = Components.classes["@mozilla.org/extensions/manager;1"]
                    .getService(Components.interfaces.nsIExtensionManager)
                    .getItemForID(id);
      return ext.version;
    },


    get currentDocument function () {
      return window.content.document;
    },



    /********************************************************************************
    * 文字列関数
    ********************************************************************************/

    /*
     * fixFilename
     *    filename: ファイル名
     *    return:   ファイル名
     * ファイル名として使えない文字を除去する。
     */
    fixFilename: function (filename) {
      return filename.replace(/[\\\/:,;\*\?\"\<\>\|]/g, '_');
    },


    /*
     * trim
     * 文字列の前後の空白系を取り除く
     */
    trim: function (str) {
      return str.replace(/^\s*|\s*$/g, '');
    },


    /*
     * join
     *    list:   リスト
     *    deli:   区切り文字
     */
    join: function (list, deli) {
      if (!deli)
        deli = ',';
      var result = "";
      for (var i = 0; i < list.length; i++) {
        result += list[i].toString();
        if (i < (list.length - 1))
          result += deli;
      }
      return result;
    },


    padCharToLeft: function (str, len, c) {
      str = str.toString();
      if (str.length >= len)
        return str;
      for (var i = str.length; i < len; i++)
        str = c + str;
      return str;
    },


    toSQLDateTimeString: function (datetime) {
      if (!datetime)
        datetime = new Date();
      var $ = this;
      var zeroPad = (function (v,l) { return $.padCharToLeft(v, l, '0'); });
      var dy = zeroPad(datetime.getFullYear(), 4);
      var dm = zeroPad(datetime.getMonth(),    2);
      var dd = zeroPad(datetime.getDate(),     2);
      var th = zeroPad(datetime.getHours(),    2);
      var tm = zeroPad(datetime.getMinutes(),  2);
      var ts = zeroPad(datetime.getSeconds(),  2);
      return dy + '/' + dm + '/' + dd + ' ' + th + ':' + tm + ':' + ts;
    },


    getLocale: function (path) {
      const STR_BUNDLE_SVC = AnkUtils.ccgs('@mozilla.org/intl/stringbundle;1',
                                           Components.interfaces.nsIStringBundleService);
      var stringBundle = STR_BUNDLE_SVC.createBundle(path);
      return function (key, replacements) {
        try {
          if (!replacements) {
            return stringBundle.GetStringFromName(key);
          } else {
            return stringBundle.formatStringFromName(key, replacements, replacements.length);
          }
        } catch (e) {
          return key;
        }
      };
    },


    errorToString: function (error) {
      try {
       return "[" + error.name + "]\n" +
              "  message: " + error.message + "\n" +
              "  filename: " + error.fileName + "\n" +
              "  linenumber: " + error.lineNumber + "\n" +
              "  stack: " + error.stack + "\n";
      } catch (e) {
        return error.toString();
      }
    },


    dumpError: function (error) {
      var msg = "\n<<ANK<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n";
      msg += this.errorToString(error) ;
      msg += ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n";
      dump(msg);
      return msg;
    },


    dump: function (msgs) {
      var msg = "\n<<ANK<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n";
      for (var i = 0; i < msgs.length; i++) {
        msg += "  " + msgs[i] + "\n";
      }
      msg += ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n";
      dump(msg);
      return msg;
    },


    /********************************************************************************
    * 色々
    ********************************************************************************/

    popupAlert: function (iconPath, title, text, buttonEnabled, a, b) {
      const ALERT_SVC = AnkUtils.ccgs("@mozilla.org/alerts-service;1",
                                      Components.interfaces.nsIAlertsService);
      return ALERT_SVC.showAlertNotification.apply(ALERT_SVC, arguments);
    },


    simplePopupAlert: function (title, text) {
      return this.popupAlert("", title, text, false, null, null);
    },

    
    openTab: function (url, ref) {
      if ('delayedOpenTab' in window)
        window.delayedOpenTab(url, ref);
      else
        window.getBrowser().addTab(url, ref);
    },


    loadURI: function (url) {
      if (window.loadURI)
        window.loadURI(url);
    },


    loadJavaScript: function (doc, path) {
      var elem = doc.createElement('script');
      elem.setAttribute('type', 'text/javascript');
      elem.setAttribute('src', path);
      var head = doc.getElementsByTagName('head')[0];
      if (head) {
        head.appendChild(elem);
        return elem;
      } else {
        return;
      }
    },

    loadStyleSheet: function (doc, path) {
      var elem = doc.createElement('link');
      elem.setAttribute('type', 'text/css');
      elem.setAttribute('rel', 'stylesheet');
      elem.setAttribute('media', 'screen');
      elem.setAttribute('href', path);
      var head = doc.getElementsByTagName('head')[0];
      if (head) {
        head.appendChild(elem);
        return elem;
      } else {
        return;
      }
    },
    

    /********************************************************************************
    * 手抜き用関数
    ********************************************************************************/

    /*
     * ccgs
     *    klass:
     *    service:
     * Components.classes[klass].getService(service)
     */
    ccgs: function (klass, service) {
      return Components.classes[klass].getService(service);
    },


    /*
     * ccci 
     *    klass:
     *    _interface:
     * Components.classes[klass].createInstance(interface)
     */
    ccci: function (klass, _interface) {
      return Components.classes[klass].createInstance(_interface);
    },



    /********************************************************************************
    * DOM関数
    ********************************************************************************/

    /*
     * findNodeByXPath
     *    xpath:
     *    return: node
     */
    findNodeByXPath: function (xpath) {
      var doc = this.currentDocument;
      return doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    },


    /*
     * findNodesByXPath
     *    xpath:
     *    return: nodes
     */
    findNodesByXPath: function (xpath) {
      var doc = this.currentDocument;
      return doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
    },

  };



  /********************************************************************************
    設定用
  ********************************************************************************/

  var AnkPref = function (prefix) {
    this.prefix = prefix + (prefix.match(/\.$/) ? '' : '.');
    return this;
  };

  AnkPref.prototype = {
    /*
     * prefs
     *    nsIPrefBranch
     */
    prefs: Components.classes["@mozilla.org/preferences-service;1"].
             getService(Components.interfaces.nsIPrefBranch),


    /* 
     * get
     *    name:   項目名
     *    def:    デフォルト値
     *    return: 項目の値
     * 設定値を取得
     */
    get: function (name, def) {
      try {
      var name = this.prefix + name;
      var type = this.prefs.getPrefType(name);
      const nsIPrefBranch = Components.interfaces.nsIPrefBranch;
        switch (type) {
          case nsIPrefBranch.PREF_STRING:
            try {
              return this.prefs.getComplexValue(name, Components.interfaces.nsISupportsString).data;
            }
            catch (e) {
              this.prefs.getCharPref(name);
            }
            break;
          case nsIPrefBranch.PREF_INT:
            return this.prefs.getIntPref(name);
            break;
          case nsIPrefBranch.PREF_BOOL:
            return this.prefs.getBoolPref(name);
          default:
            return def;
        }
      } catch (e) {
        return def;
      }
    },


    /*
     * set
     *    name:   項目名
     *    value:  設定する値
     *    type:   型(省略可)
     *    return: ?
     */
    set: function (name, value, type) {
      var name = this.prefix + name;
      switch (type || typeof value) {
        case 'string':
          var str = this.ccci('@mozilla.org/supports-string;1', Components.interfaces.nsISupportsString);
          str.data = value;
          return this.prefs.setComplexValue(name, Components.interfaces.nsISupportsString, str);
        case 'boolean':
          return this.prefs.setBoolPref(name, value);
        case 'number':
          return this.prefs.setIntPref(name, value);
        default:
          alert('unknown pref type');
      }
    },
  };



  /********************************************************************************
    設定用
  ********************************************************************************/

  /* デバッグの設定を読み取る */
  (function () {
    var pref = new AnkPref('extensions.ankutils');
    AnkUtils.DEBUG = pref.get('debugMode', false);
  })();



} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
