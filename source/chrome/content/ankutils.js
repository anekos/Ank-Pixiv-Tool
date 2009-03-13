
try {

  AnkUtils = {

    SYS_SLASH: (function () {
      try {
        let props = Components.classes["@mozilla.org/file/directory_service;1"]
                      .getService(Components.interfaces.nsIProperties);
        let file = props.get("ProfD", Components.interfaces.nsIFile);
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


    get currentDocument ()
      window.content.document,



    /********************************************************************************
    * 文字列関数
    ********************************************************************************/

    /*
     * HTMLの実体参照を修正 TODO
     */
    decodeHtmlSpChars: function (s) {
      return s.replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#(\d+);/g, function (_, n) String.fromCharCode(parseInt(n, 10)));
    },


    /*
     * fixFilename
     *    filename: ファイル名
     *    return:   ファイル名
     * ファイル名として使えない文字を除去する。
     */
    fixFilename: function (filename, trPattern) {
      const badChars = /[\\\/:;\*\?\"\<\>\|\#]/g;
      if (trPattern) {
        return filename.replace(badChars, function (c) (trPattern[c] || '_'));
      }
      return filename.replace(badChars, '_');
    },


    /*
     * extractFilename
     *    filepath
     */
    extractFilename: function (filepath) {
      try {
        return filepath.match(/\/([^\/]+)$/)[1] || filepath;
      } catch (e) {
        return filepath;
      }
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
      let result = "";
      for (let i = 0; i < list.length; i++) {
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
      for (let i = str.length; i < len; i++)
        str = c + str;
      return str;
    },


    toSQLDateTimeString: function (datetime) {
      if (!datetime)
        datetime = new Date();
      let $ = this;
      let zeroPad = function(s, n) {
        return s.toString().replace(new RegExp('^(.{0,'+(n-1)+'})$'),
                         function(s) { return zeroPad('0'+s, n); });
      };
      let dy = zeroPad(datetime.getFullYear(),      4);
      let dm = zeroPad(datetime.getMonth() + 1,     2);
      let dd = zeroPad(datetime.getDate(),          2);
      let th = zeroPad(datetime.getHours(),         2);
      let tm = zeroPad(datetime.getMinutes(),       2);
      let ts = zeroPad(datetime.getSeconds(),       2);
      let ms = zeroPad(datetime.getMilliseconds(),  3);
      return dy + '-' + dm + '-' + dd + ' ' + th + ':' + tm + ':' + ts + '.' + ms;
    },


    getLocale: function (path) {
      const STR_BUNDLE_SVC = AnkUtils.ccgs('@mozilla.org/intl/stringbundle;1',
                                           Components.interfaces.nsIStringBundleService);
      let stringBundle = STR_BUNDLE_SVC.createBundle(path);
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
      let msg = "\n<<ANK<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n";
      msg += this.errorToString(error) ;
      msg += ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n";
      dump(msg);
      return msg;
    },


    dump: function () {
      if (arguments.length <= 1) {
        let msg = "\n<<ANK " + arguments[0] + " >>\n";
        dump(msg);
        return msg;
      } else {
        let msg = "\n<<ANK<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n";
        for (let i = 0; i < arguments.length; i++) {
          msg += "  " + arguments[i] + "\n";
        }
        msg += ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n";
        dump(msg);
        return msg;
      }
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
      if ('delayedOpenTab' in window) {
        window.delayedOpenTab(url, ref);
      } else {
        window.getBrowser().addTab(url, ref);
      }
    },


    loadURI: function (url) {
      if (window.loadURI)
        window.loadURI(url);
    },


    loadJavaScript: function (doc, path) {
      let elem = doc.createElement('script');
      elem.setAttribute('type', 'text/javascript');
      elem.setAttribute('src', path);
      let head = doc.getElementsByTagName('head')[0];
      if (head) {
        head.appendChild(elem);
        return elem;
      }
    },

    loadStyleSheet: function (doc, path) {
      let elem = doc.createElement('link');
      elem.setAttribute('type', 'text/css');
      elem.setAttribute('rel', 'stylesheet');
      elem.setAttribute('media', 'screen');
      elem.setAttribute('href', path);
      let head = doc.getElementsByTagName('head')[0];
      if (head) {
        head.appendChild(elem);
        return elem;
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
    ccgs: function (klass, service)
      Components.classes[klass].getService(service),


    /*
     * ccci
     *    klass:
     *    _interface:
     * Components.classes[klass].createInstance(interface)
     */
    ccci: function (klass, _interface)
      Components.classes[klass].createInstance(_interface),



    /********************************************************************************
    * DOM関数
    ********************************************************************************/

    /*
     * findNodeByXPath
     *    xpath:
     *    return: node
     */
    findNodeByXPath: function (xpath)
      let (doc = this.currentDocument)
        doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue,


    /*
     * findNodesByXPath
     *    xpath:
     *    return: nodes
     */
    findNodesByXPath: function (xpath)
      let (doc = this.currentDocument)
        doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null),

  };



  /********************************************************************************
    設定用
  ********************************************************************************/

  AnkPref = function (prefix) {
    if (prefix) {
      this.prefix = prefix + (prefix.match(/\.$/) ? '' : '.');
    } else {
      this.prefix = "";
    }
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
        name = this.prefix + name;
        let type = this.prefs.getPrefType(name);
        const nsIPrefBranch = Components.interfaces.nsIPrefBranch;
        switch (type) {
          case nsIPrefBranch.PREF_STRING:
            try {
              return this.prefs.getComplexValue(name, Components.interfaces.nsISupportsString).data;
            }
            catch (e) {
              return this.prefs.getCharPref(name);
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
      name = this.prefix + name;
      switch (type || typeof value) {
        case 'string':
          let str = AnkUtils.ccci('@mozilla.org/supports-string;1', Components.interfaces.nsISupportsString);
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
  {
    let pref = new AnkPref('extensions.ankutils');
    AnkUtils.DEBUG = pref.get('debugMode', false);
  }



} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
