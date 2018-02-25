"use strict";

{

  /**
   *
   * @constructor
   */
  let AnkNijie = function () {

    AnkSite.apply(this, arguments);

    this.SITE_ID = 'NJE';

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

    const SELECTOR_ITEMS = {
      "illust": {
        "imgOvr": {"s": ["#gallery", "#dojin_left .left"]},
        "med": {
          "img": {"s": "#gallery  > #gallery_open > #img_filter > a > img"},

          "imgs": {"ALL": "#gallery  > #gallery_open > a > img"}
        },
        "djn": {
          "imgLink": {"s": "#dojin_left .left .image a"},

          "imgLinks": {"ALL": "#gallery_new #thumbnail a"}
        }
      },
      "info": {
        "illust": {
          "datetime": {"s": ["div#view-honbun > p", "div#created > p"]},
          "title": {"s": ["#view-header > #view-left > .illust_title", "#dojin_header .title"]},
          "caption": {"s": ["#view-honbun > p+p", "#dojin_text > p+p"]},
          "nuita": {"s": "#nuita"},
          "good": {"s": "#good"},

          "tags": {"ALL": "#view-tag .tag .tag_name"}
        },
        "member": {
          "memberLink": {"s": ["a.name", "div#dojin_left > div.right > p.text > a"]}
        }
      },
      "misc": {
        "downloadedDisplayParent": {"s": ["div#view-honbun", "div#infomation"]},
        "downloadedFilenameArea": {"s": ".ank-pixiv-downloaded-filename-text"},
        "nextLink": {"s": "a#nextIllust"},
        "prevLink": {"s": "a#backIllust"}
      }
    };

    let gElms = this.initSelectors({'doc': doc}, SELECTOR_ITEMS, doc);

    return gElms;
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
        'thumbnail': m,
        'original': m
      }
    };

    let getDjnPath = async () => {
      let m = [{'src': this.elements.illust.djn.imgLink.href}];
      Array.prototype.forEach.call(this.elements.illust.djn.imgLinks, (e) => {
        m.push({'src': e.href});
      });

      return {
        'thumbnail': m,
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
      let posted = this.getPosted(() => AnkUtils.decodeTextToDateData(elm.info.illust.datetime.textContent));

      let info = {
        'url': elm.doc.location.href,
        'id': this.getIllustId(elm.doc.location.href),
        'title': AnkUtils.trim(elm.info.illust.title.textContent),
        'posted': !posted.fault && posted.timestamp,
        'postedYMD': !posted.fault && posted.ymd,
        'tags': Array.prototype.map.call(elm.info.illust.tags, (e) => AnkUtils.trim(e.textContent)),
        'caption': elm.info.illust.caption && AnkUtils.trim(elm.info.illust.caption.textContent),
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
      'method': undefined
    });
  };

  /**
   * いいね！する
   */
  AnkNijie.prototype.setNice = function () {
    if (!this.elements.info.illust.good) {
      return;
    }

    this.elements.info.illust.good.click();
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

    // 抜いた・いいねしたら自動ダウンロード
    let niceEventFunc = () => {
      if (!this.prefs.site.downloadWhenNice) {
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
      AnkUtils.delayFunctionInstaller({'func': middleClickEventFunc, 'retry': RETRY_VALUE, 'label': 'middleClickEventFunc'}),
      AnkUtils.delayFunctionInstaller({'func': delayDisplaying, 'retry': RETRY_VALUE, 'label': 'delayDisplaying'}),
      AnkUtils.delayFunctionInstaller({'func': delayMarking, 'retry': RETRY_VALUE, 'label': 'delayMarking'}),
      AnkUtils.delayFunctionInstaller({'func': niceEventFunc, 'retry': RETRY_VALUE, 'label': 'niceEventFunc'})
    ])
      .catch((e) => logger.warn(e));
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
      AnkUtils.delayFunctionInstaller({'func': delayMarking, 'retry': RETRY_VALUE, 'label': 'delayMarking'})
    ])
      .catch((e) => logger.warn(e));
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
