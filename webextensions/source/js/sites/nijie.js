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
   * @param doc
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
   * イラストIDの取得
   * @param loc
   * @returns {*}
   */
  AnkNijie.prototype.getIllustId = function (loc) {
    return (/^https?:\/\/nijie\.info\/view\.php\?id=(\d+)/.exec(loc) || [])[1];
  };

  /**
   * サムネイルにダウンロード済みマークを付ける
   * @param opts
   * @param siteSpecs
   * @returns {*}
   */
  AnkNijie.prototype.markDownloaded = function (opts, siteSpecs) {

    const MARKING_TARGETS = [
      { 'q':'.nijie > .picture > .nijiedao > a', 'n':3 },         // 通常の一覧
      { 'q':'.nijie > .nijiedao > a', 'n':2 },                    // "同人"の一覧
      { 'q':'.nijie-bookmark > .picture> .nijiedao > a', 'n':3 }, // "ブックマーク"の一覧
      { 'q':'#okazu_list > a', 'n':-1},                           // おかず
      { 'q':'#carouselInner-view > ul > li > a', 'n':1 }          // "あなたにオススメのイラスト"
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
  AnkNijie.prototype.onFocusHandler = function () {
    if (this.inIllustPage()) {
      this.displayDownloaded({'force': true});
    }
    this.markDownloaded({'force': true});
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
    if (this.prefs.site.downloadWhenRate) {
      this.downloadCurrentImage({'autoDownload': true});
    }
  };

  /**
   * 機能のインストール（イラストページ用）
   */
  AnkNijie.prototype.installIllustPageFunction = function (RETRY_VALUE) {
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
