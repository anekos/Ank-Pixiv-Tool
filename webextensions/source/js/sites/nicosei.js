"use strict";

{

  /**
   *
   * @constructor
   */
  let AnkNicosei = function () {

    AnkSite.apply(this, arguments);

    this.SITE_ID = 'NCS';

    this.FUNC_INST_RETRY_VALUE = {
      'max': 30,
      'wait': 1000
    };

  };

  /**
   *
   * @type {AnkSite}
   */
  AnkNicosei.prototype = Object.create(AnkSite.prototype, {
    constructor: {
      'value': AnkNicosei,
      'enumerable': false
    }
  });

  /**
   * 利用するクエリのまとめ
   * @param doc
   */
  AnkNicosei.prototype.getElements = function (doc) {

    let query = (q) => {
      return doc.querySelector(q);
    };

    let queryAll = (q) => {
      return doc.querySelectorAll(q);
    };

    return {
      'illust': {
        get imgOvr () {
          return query('.illust_wrapper');
        },
        'med': {
          get imgLink () {
            return query('#illust_link');
          }
        }
      },
      'info': {
        'illust': {
          get datetime () {
            return query('#content #detail .created');
          },
          get title () {
            return query('#content #detail .title');
          },
          get R18 () {
            return query('#content #detail .kind a[href="/shunga/"]');
          },
          get caption () {
            return query('#content #detail .discription');
          },
          get clip () {
            return query('.add_clip_button');
          },
          get tags () {
            return queryAll('#content #detail .illust_tag.static .tag .text');
          }
        },
        'member': {
          get memberLink () {
            return query('#content #detail .user_link > a');
          }
        }
      },
      'misc': {
        get downloadedDisplayParent () {
          return query('#content #detail .other_info');
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
   * @param doc
   * @returns {boolean}
   */
  AnkNicosei.prototype.inIllustPage = function (doc) {
    doc = doc || document;
    return !!this.getIllustId(doc.location.href);
  };

  /**
   * ダウンロード情報（画像パス）の取得
   * @param elm
   * @returns {Promise}
   */
  AnkNicosei.prototype.getPathContext = async function (elm) {
    let getMedPath = async () => {
      let largePage = this.elements.illust.med.imgLink.href;
      logger.info('ORIGINAL IMAGE PAGE:', largePage);
      let resp = await remote.get({
        'url': largePage,
        'responseType': 'document',
        'timeout': this.prefs.xhrTimeout
      });

      let img = resp.document.querySelector('.illust_view_big');
      if (img) {
        return {
          'original': [{'src': [new URL(resp.responseURL).origin, img.getAttribute('data-src')].join('')}]
        };
      }
    };

    if (elm.illust.med.imgLink) {
      return getMedPath();
    }
  };

  /**
   * ダウンロード情報（イラスト情報）の取得
   * @param elm
   * @returns {{url: string, id, title, posted: (boolean|Number|*), postedYMD: (boolean|*), size: {width, height}, tags: *, tools: *, caption: *, R18: boolean}}
   */
  AnkNicosei.prototype.getIllustContext = function (elm) {
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
        'R18': !!elm.info.illust.R18
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
  AnkNicosei.prototype.getMemberContext = function(elm) {
    try {
      return {
        'id': /\/user\/illust\/(.+?)(?:$|\?)/.exec(elm.info.member.memberLink.href)[1],
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
   * イラストIDの取得
   * @param loc
   * @returns {*}
   */
  AnkNicosei.prototype.getIllustId = function (loc) {
    return (/^https?:\/\/seiga\.nicovideo\.jp\/seiga\/(im\d+)/.exec(loc) || [])[1];
  };

  /**
   * サムネイルにダウンロード済みマークを付ける
   * @param opts
   * @param siteSpecs
   * @returns {*}
   */
  AnkNicosei.prototype.markDownloaded = function (opts, siteSpecs) {

    const MARKING_TARGETS = [
      { 'q':'.list_item > a', 'n':0 },                         // ○○さんのイラスト
      { 'q':'.illust_thumb > div > a', 'n':2 },                // マイページ
      { 'q':'.list_item_cutout > a', 'n':1 },                  // イラストページ（他のイラスト・関連イラストなど）
      { 'q':'.ranking_image > div > a', 'n':2 },               // イラストランキング
      { 'q':'.center_img > a', 'n':1 }                         // 検索結果・春画ページ（他のイラスト・関連イラストなど）
    ];

    return AnkSite.prototype.markDownloaded.call(this, opts, {
      'queries': MARKING_TARGETS,
      'getId': (href) => {
        return this.getIllustId(href);
      },
      'getLastUpdate': undefined,
      'overlay': false
    });
  };

  /**
   * focusイベントのハンドラ
   */
  AnkNicosei.prototype.onFocusHandler = function () {
    if (this.inIllustPage()) {
      this.displayDownloaded({'force': true});
    }
    this.markDownloaded({'force': true});
  };

  /**
   * 評価の実行
   */
  AnkNicosei.prototype.setRate = function (pt) {
    if (!this.elements.info.illust.good) {
      return;
    }

    this.elements.info.illust.good.click();

    // 自動ダウンロード（評価時）
    if (this.prefs.site.downloadWhenRate) {
      this.downloadCurrentImage({'autoDownload': true});
    }
  };

  /**
   * 機能のインストール（イラストページ用）
   */
  AnkNicosei.prototype.installIllustPageFunction = function (RETRY_VALUE) {
    // 中画像クリック関連
    let middleClickEventFunc = () => {
      let addMiddleClickEventListener = (imgOvr) => {
        let mcHandler = (e) => {
          let useEvent = this.prefs.site.largeOnMiddle || this.prefs.site.downloadWhenClickMiddle;
          let useCapture = this.prefs.site.largeOnMiddle;
          if (!useEvent) {
            return;
          }

          if (this.prefs.site.largeOnMiddle) {
            this.openViewer();
          }

          if (this.prefs.site.downloadWhenClickMiddle) {
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
        let img = this.elements.illust.med.imgLink;
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
      if (!this.prefs.site.downloadWhenRate) {
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
  AnkNicosei.prototype.installListPageFunction = function (RETRY_VALUE) {

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
  AnkNicosei.prototype.installFunctions = function () {
    if (this.inIllustPage()) {
      this.installIllustPageFunction(this.FUNC_INST_RETRY_VALUE);
      return;
    }

    this.installListPageFunction(this.FUNC_INST_RETRY_VALUE);
  };

  // 開始

  new AnkNicosei().start()
    .catch((e) => {
      console.error(e);
    });

}
