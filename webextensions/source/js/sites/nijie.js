"use strict";

{

  /**
   *
   * @constructor
   */
  let AnkNijie = function () {

    AnkSite.apply(this, arguments);

    this.SITE_ID = 'NJE';

    this.FUNC_INST_RETRY_VALUE = {
      'max': 30,
      'wait': 1000
    };

    this.collectedContext = null;

    this.executed = {
      'displayDownloaded': false,
      'markDownloaded': false
    };

  };

  /**
   *
   * @type {AnkSite}
   */
  AnkNijie.prototype = Object.create(AnkSite.prototype, {
    constructor: {
      'value': AnkNijie,
      'enumerable': false
    }
  });

  /**
   * 利用するクエリのまとめ
   * @param doc
   */
  AnkNijie.prototype.getElements = function (doc) {

    let query = (q) => {
      return doc.querySelector(q);
    };

    let queryAll = (q) => {
      return doc.querySelectorAll(q);
    };

    return {
      'illust': {
        get imgOvr () {
          return query('#gallery') || query('#dojin_left .left');
        },
        'med': {
          get img () {
            return query('#gallery  > #gallery_open > #img_filter > a > img');
          },
          get imgs () {
            return queryAll('#gallery  > #gallery_open > a > img');
          }
        },
        'djn': {
          get imgLink () {
            return query('#dojin_left .left .image a');
          },
          get imgLinks () {
            return queryAll('#gallery_new #thumbnail a');
          }
        }
      },
      'info': {
        'illust': {
          get datetime () {
            return query('div#view-honbun > p') || query('div#created > p');
          },
          get title () {
            return query('#view-header > #view-left > .illust_title') || query('#dojin_header .title');
          },
          get caption () {
            return queryAll('#view-honbun > p')[1] || queryAll('#dojin_text > p')[1];
          },
          get nuita () {
            return query('#nuita');
          },
          get good () {
            return query('#good');
          },
          get tags () {
            return queryAll('#view-tag .tag');
          }
        },
        'member': {
          get memberLink () {
            return query('a.name') || query('div#dojin_left > div.right > p.text > a');
          }
        }
      },
      'misc': {
        get downloadedDisplayParent () {
          return query('div#view-honbun') || query('div#infomation');
        },
        get downloadedFilenameArea () {
          return query('.ank-pixiv-downloaded-filename-text');
        },
        get nextLink() {
          return query('a#nextIllust');
        },
        get prevLink() {
          return query('a#backIllust');
        }
      },
      'thumbnails': {
      },
      'doc': doc
    };
  };

  /**
   *
   * @param dco
   * @returns {boolean}
   */
  AnkNijie.prototype.inIllustPage = function (doc) {
    doc = doc || document;
    return !!this.getIllustId(doc.location.href);
  };

  /**
   * ダウンロード情報（画像パス）の取得
   * @param elm
   * @returns {Promise}
   */
  AnkNijie.prototype.getPathContext = async function (elm) {
    let getMedPath = async () => {
      let m = [{'src': this.elements.illust.med.img.src}];
      Array.prototype.forEach.call(this.elements.illust.med.imgs, (e) => {
        m.push({'src': e.src.replace(/(\.nijie\.info\/).+?\/(nijie_picture\/)/, "$1$2")});
      });

      return {
        'original': m
      }
    };

    let getDjnPath = async () => {
      let m = [{'src': this.elements.illust.djn.imgLink.href}];
      Array.prototype.forEach.call(this.elements.illust.djn.imgLinks, (e) => {
        m.push({'src': e.href});
      });

      return {
        'original': m
      }
    };

    if (elm.illust.med.img) {
      return getMedPath();
    }
    if (elm.illust.djn.imgLink) {
      return getDjnPath();
    }
  };

  /**
   * ダウンロード情報（イラスト情報）の取得
   * @param elm
   * @returns {{url: string, id, title, posted: (boolean|Number|*), postedYMD: (boolean|*), size: {width, height}, tags: *, tools: *, caption: *, R18: boolean}}
   */
  AnkNijie.prototype.getIllustContext = function (elm) {
    try {
      let posted = this.getPosted(() => AnkUtils.decodeDateTimeText(elm.info.illust.datetime.textContent));

      let info = {
        'url': elm.doc.location.href,
        'id': this.getIllustId(elm.doc.location.href),
        'title': AnkUtils.trim(elm.info.illust.title.textContent),
        'posted': !posted.fault && posted.timestamp,
        'postedYMD': !posted.fault && posted.ymd,
        'tags': Array.prototype.map.call(elm.info.illust.tags, (e) => AnkUtils.trim(e.textContent)),
        'caption': elm.info.illust.caption && AnkUtils.trim(elm.info.illust.caption.innerText),
        'R18': true
      };

      return info;
    }
    catch (e) {
      logger.error(e);
    }
  };

  /**
   * ダウンロード情報（メンバー情報）の取得
   * @param elm
   * @returns {{id: *, pixiv_id: *, name, memoized_name: null}}
   */
  AnkNijie.prototype.getMemberContext = function(elm) {
    try {
      return {
        'id': /\/members\.php\?id=(.+?)(?:&|$)/.exec(elm.info.member.memberLink.href)[1],
        'name': AnkUtils.trim(elm.info.member.memberLink.textContent),
        'pixiv_id': null,
        'memoized_name': null
      };
    }
    catch (e) {
      logger.error(e);
    }
  };

  /**
   * ダウンロード情報をまとめる
   * @param elm
   * @param force
   * @returns {Promise.<*>}
   */
  AnkNijie.prototype.getContext = async function (elm, force) {

    if (!force && (this.collectedContext && this.collectedContext.downloadable)) {
      // 既にダウンロード可能な情報を取得済みならそのまま返す
      return this.collectedContext;
    }

    return Promise.all([
      this.getPathContext(elm),
      this.getIllustContext(elm),
      this.getMemberContext(elm)
    ]).then((result) => {
      let context = {
        'downloadable': !!result[0] && !!result[1] && !!result[2],
        'service_id': this.SITE_ID,
        'siteName': this.sitePrefs.folder,
        'path': result[0],
        'info': {
          'illust': result[1],
          'member': result[2]
        }
      };

      logger.info('CONTEXT: ', context);

      return context;
    });
  };

  /**
   * イラストIDの取得
   * @param loc
   * @returns {*}
   */
  AnkNijie.prototype.getIllustId = function (loc) {
    return (/^https?:\/\/nijie\.info\/view\.php\?id=(\d+)/.exec(loc) || [])[1];
  };

  /**
   *　イラストページにダウンロード済みの表示をする
   * @param opts
   * @returns {boolean}
   */
  AnkNijie.prototype.displayDownloaded = function (opts) {
    if (!this.prefs.displayDownloaded) {
      return true;
    }

    opts = opts || {};

    if (this.executed.displayDownloaded && !opts.force) {
      // 二度実行しない（強制時を除く）
      return true;
    }

    let appendTo = this.elements.misc.downloadedDisplayParent;
    if (!appendTo) {
      return false;
    }

    let illustContext = this.getIllustContext(this.elements);
    if (!illustContext) {
      return false;
    }

    this.insertDownloadedDisplay(appendTo, {'id': illustContext.id, 'R18': illustContext.R18, 'updated': illustContext.updated});

    this.executed.displayDownloaded = true;

    return true;
  };

  /**
   * サムネイルにダウンロード済みマークを付ける
   * @param node
   * @param opts
   * @returns {boolean}
   */
  AnkNijie.prototype.markDownloaded = function (opts) {
    if (!this.prefs.markDownloaded) {
      return true;
    }

    opts = opts || {};

    if (this.executed.markDownloaded && !opts.force) {
      // 二度実行しない（強制時を除く）
      return true;
    }

    const MARKING_TARGETS = [
      { 'q':'.nijie > .picture > .nijiedao > a', 'n':3 },         // 通常の一覧
      { 'q':'.nijie > .nijiedao > a', 'n':2 },                    // "同人"の一覧
      { 'q':'.nijie-bookmark > .picture> .nijiedao > a', 'n':3 }, // "ブックマーク"の一覧
      { 'q':'#okazu_list > a', 'n':-1},                           // おかず
      { 'q':'#carouselInner-view > ul > li > a', 'n':1 }          // "あなたにオススメのイラスト"
    ];

    let node = opts.node || this.elements.doc;

    this.insertDownloadedMark(node, {
      'illust_id': opts.illust_id,
      'getId': (href) => {
        return this.getIllustId(href);
      },
      'getLastUpdate': undefined,
      'targets': MARKING_TARGETS,
      'overlay': false,
      'pinpoint': !!opts.node,
      'ignorePref': false
    });

    this.executed.markDownloaded = true;

    return true;
  };

  /**
   * focusイベントのハンドラ
   */
  AnkNijie.prototype.onFocusHandler = function () {
    if (this.inIllustPage()) {
      this.displayDownloaded({'force': true});
    }
    this.markDownloaded({'force': true});
  };

  /**
   * ダウンロードの実行
   * @param opts
   */
  AnkNijie.prototype.downloadCurrentImage = function (opts) {
    if (!this.inIllustPage()) {
      return;
    }

    (async () => {

      opts = opts || {};

      this.collectedContext = await this.getContext(this.elements);
      if (!this.collectedContext) {
        // コンテキストが集まらない（ダウンロード可能な状態になっていない）
        let msg = chrome.i18n.getMessage('msg_notReady');
        logger.warn(new Error(msg));
        return;
      }

      if (!this.collectedContext.downloadable) {
        // 作品情報が見つからない
        let msg = chrome.i18n.getMessage('msg_cannotFindImages');
        logger.error(new Error(msg));
        alert(msg);
        return;
      }

      let status = await this.requestGetDownloadStatus(this.collectedContext.info.illust.id, true);

      let member = await this.requestGetMemberInfo(this.collectedContext.info.member.id, this.collectedContext.info.member.name);
      this.collectedContext.info.member.memoized_name = member.name;

      //chrome.runtime.sendMessage({'type': 'AnkNijie.Download.addContext', 'context': this.collectedContext}, (o) => logger.info(o));
      this.executeDownload({'status': status, 'context': this.collectedContext});
    })();
  };

  /**
   * Viewerの操作
   */
  AnkNijie.prototype.openViewer = function (opts) {
    (async () => {
      this.collectedContext = await this.getContext(this.elements);
      if (!this.collectedContext) {
        logger.error(new Error('viewer not ready'));
        return;
      }

      AnkViewer.open({'doc': this.elements.doc, 'prefs': this.prefs, 'path': this.collectedContext.path});
    })();
  };

  /**
   * 評価の実行
   */
  AnkNijie.prototype.setRate = function (pt) {
    if (!this.elements.info.illust.good) {
      return;
    }

    this.elements.info.illust.good.click();

    // 自動ダウンロード（評価時）
    if (this.prefs.downloadWhenRate) {
      this.downloadCurrentImage({'autoDownload': true});
    }
  };

  /**
   * 機能のインストール（イラストページ用）
   */
  AnkNijie.prototype.installIllustPageFunction = function (RETRY_VALUE) {
    // 中画像クリック関連
    let middleClickEventFunc = () => {
      // FIXME imgOvrの方になった場合は、medImgより広い領域がクリック可能となるが、ページ側の jQuery.on('click')を無効化できないため止む無し
      let addMiddleClickEventListener = (imgOvr) => {
        let mcHandler = (e) => {
          let useEvent = this.prefs.largeOnMiddle || this.prefs.downloadWhenClickMiddle;
          let useCapture = this.prefs.largeOnMiddle;
          if (!useEvent) {
            return;
          }

          if (this.prefs.largeOnMiddle) {
            this.openViewer();
          }

          if (this.prefs.downloadWhenClickMiddle) {
            // 自動ダウンロード（中画像クリック時）
            this.downloadCurrentImage({'autoDownload': true});
          }

          if (useCapture) {
            e.preventDefault();
            e.stopPropagation();
          }
        };

        imgOvr.addEventListener('click', mcHandler, true);
      };

      //

      // オーバーレイ
      let imgOvr = this.elements.illust.imgOvr;
      if (!imgOvr) {
        return;
      }

      let result = (() => {
        // イラスト
        let img = this.elements.illust.med.img || this.elements.illust.djn.imgLink;
        if (img) {
          addMiddleClickEventListener(imgOvr);
          return true;
        }
      })();

      return result;
    };

    // 「保存済み」を表示する
    let delayDisplaying = () => {
      if (this.elements.doc.readyState !== "complete") {
        return false;
      }

      return this.displayDownloaded();
    };

    // イメレスのサムネイルにダウンロード済みマークを表示する
    let delayMarking = () => {
      if (this.elements.doc.readyState !== "complete") {
        return false;
      }

      return this.markDownloaded();
    };

    // 評価したら自動ダウンロード
    let ratingEventFunc = () => {
      if (!this.prefs.downloadWhenRate) {
        return true;
      }

      let btns = ['nuita', 'good'].map((e) => this.elements.info.illust[e]);
      if (!btns[0] || !btns[1]) {
        return;
      }

      btns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.downloadCurrentImage({'autoDownload': true});
        }, false);
      });

      return true;
    };

    //

    Promise.all([
      this.delayFunctionInstaller({'func': middleClickEventFunc, 'retry': RETRY_VALUE, 'label': 'middleClickEventFunc'}),
      this.delayFunctionInstaller({'func': delayDisplaying, 'retry': RETRY_VALUE, 'label': 'delayDisplaying'}),
      this.delayFunctionInstaller({'func': delayMarking, 'retry': RETRY_VALUE, 'label': 'delayMarking'}),
      this.delayFunctionInstaller({'func': ratingEventFunc, 'retry': RETRY_VALUE, 'label': 'ratingEventFunc'})
    ])
      .catch((e) => logger.error(e));
  };

  /**
   * 機能のインストール（リストページ用）
   */
  AnkNijie.prototype.installListPageFunction = function (RETRY_VALUE) {

    // サムネイルにダウンロード済みマークを表示する
    let delayMarking = () => {
      if (this.elements.doc.readyState !== "complete") {
        return false;
      }

      return this.markDownloaded();
    };

    Promise.all([
      this.delayFunctionInstaller({'func': delayMarking, 'retry': RETRY_VALUE, 'label': 'delayMarking'})
    ])
      .catch((e) => logger.error(e));
  };

  /**
   * 機能のインストールのまとめ
   */
  AnkNijie.prototype.installFunctions = function () {
    if (this.inIllustPage()) {
      this.installIllustPageFunction(this.FUNC_INST_RETRY_VALUE);
      return;
    }

    this.installListPageFunction(this.FUNC_INST_RETRY_VALUE);
  };

  // 開始

  new AnkNijie().start()
    .catch((e) => {
      console.error(e);
    });

}