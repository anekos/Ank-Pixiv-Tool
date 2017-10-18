"use strict";

{

  /**
   *
   * @constructor
   */
  let AnkTwitter = function () {

    AnkSite.apply(this, arguments);

    this.SITE_ID = 'TWT';

  };

  /**
   *
   * @type {AnkSite}
   */
  AnkTwitter.prototype = Object.create(AnkSite.prototype, {
    constructor: {
      'value': AnkTwitter,
      'enumerable': false
    }
  });

  /**
   * 利用するクエリのまとめ
   * @param doc
   */
  AnkTwitter.prototype.getElements = function (doc) {

    const SELECTOR_ITEMS = {
      "illust": {
        "tweet": {
          "ovr": {"s": "#permalink-overlay"},
          "tweet": {"s": "#permalink-overlay .permalink-tweet"},
          "content": {"s": "#permalink-overlay .PermalinkOverlay-content"}
        },
        "gallary": {
          "ovr": {"s": ".Gallery.with-tweet"},
          "tweet": {"s": ".Gallery.with-tweet .tweet"},
          "content": {"s": ".Gallery.with-tweet .Gallery-content"}
        },
        "video": {"s": ".AdaptiveMedia-container .AdaptiveMedia-videoContainer video"},

        "photos": {"ALL": ".AdaptiveMedia-container .AdaptiveMedia-photoContainer img"}
      },
      "info": {
        "illust": {
          "ownLink": {"s": ".time .tweet-timestamp"},
          "datetime": {"s": ".time  .tweet-timestamp ._timestamp"},
          "caption": {"s": ".tweet-text"}
        },
        "member": {
        }
      },
      "misc": {
        "downloadedDisplayParent": {"s": ".stream-item-footer"}
      }
    };

    let gElms = this.initSelectors({'doc': doc}, SELECTOR_ITEMS, doc);

    return gElms;
  };

  /**
   *
   * @returns {*}
   */
  AnkTwitter.prototype.getOpenedModal = function () {
    const KS = ['gallary', 'tweet'];
    for (let i=0; i<KS.length; i++) {
      let e = this.elements.illust[KS[i]];
      if (e.ovr && getComputedStyle(e.ovr, '').getPropertyValue('display') === 'block') {
        return e;
      }
    }
  };

  /**
   *
   * @returns {boolean}
   */
  AnkTwitter.prototype.inIllustPage = function () {
    return !!this.getOpenedModal();
  };

  /**
   * ダウンロード情報（画像パス）の取得
   * @param elm
   * @returns {Promise}
   */
  AnkTwitter.prototype.getPathContext = async function (elm) {
    let getPhotoPath = async () => {
      let m = Array.prototype.map.call(elm.illust.photos, (e) => {
        return {'src': this.prefs.downloadOriginalSize ? e.src.replace(/(?::large)?$/, ':orig') : e.src};
      });

      return {
        'original': m
      };
    };

    let getVideoPath = async () => {
      let src = elm.illust.video.src;
      if (/^https?:\/\//.test(src)) {
        return {
          'original': [{'src': src}]
        };
      }

      // ストリーム再生の動画(.m3u8/blob)には未対応
    };

    if (elm.illust.photos && elm.illust.photos.length > 0) {
      return getPhotoPath();
    }
    if (elm.illust.video) {
      return getVideoPath();
    }
  };

  /**
   * ダウンロード情報（イラスト情報）の取得
   * @param elm
   * @returns {{url: string, id, title, posted: (boolean|Number|*), postedYMD: (boolean|*), size: {width, height}, tags: *, tools: *, caption: *, R18: boolean}}
   */
  AnkTwitter.prototype.getIllustContext = function (elm) {
    try {
      let dd = new Date(parseInt(elm.info.illust.datetime.getAttribute('data-time-ms'),10));
      let posted = this.getPosted(() => AnkUtils.getDateData(dd));

      let info = {
        'url': elm.info.illust.ownLink.href,
        'id': elm.doc.getAttribute('data-tweet-id'),
        'title': AnkUtils.trim(elm.info.illust.caption.textContent),
        'posted': !posted.fault && posted.timestamp,
        'postedYMD': !posted.fault && posted.ymd,
        'tags': [],
        'caption': AnkUtils.trim(elm.info.illust.caption.textContent),
        'R18': false
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
  AnkTwitter.prototype.getMemberContext = function(elm) {
    try {
      return {
        'id': elm.doc.getAttribute('data-user-id'),
        'name': elm.doc.getAttribute('data-name'),
        'pixiv_id': elm.doc.getAttribute('data-screen-name'),
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
  AnkTwitter.prototype.getContext = async function (elm, force) {

    let modal = this.getOpenedModal();
    if (!modal) {
      return;
    }

    let elmTweet = this.getElements(modal.tweet);

    return AnkSite.prototype.getContext.call(this, elmTweet, true);
  };

  /**
   *
   * @param opts
   * @returns {boolean}
   */
  AnkTwitter.prototype.displayDownloaded = function (opts) {
    if (!this.prefs.site.displayDownloaded) {
      return true;
    }

    let elmTweet = opts.elm;
    if (!elmTweet) {
      let modal = this.getOpenedModal();
      if (!modal) {
        return false;
      }
      elmTweet = this.getElements(modal.tweet);
    }

    let appendTo = elmTweet.misc.downloadedDisplayParent;
    if (!appendTo) {
      return false;
    }

    if (opts.inProgress) {
      this.insertDownloadedDisplay(appendTo, opts);
      return true;
    }

    if (this.executed.displayDownloaded && (opts && !opts.force)) {
      // 二度実行しない（強制時を除く）
      return true;
    }

    let illustContext = this.getIllustContext(elmTweet);
    if (!illustContext) {
      return false;
    }

    this.insertDownloadedDisplay(appendTo, {'id': illustContext.id, 'R18': illustContext.R18, 'updated': illustContext.updated});

    this.executed.displayDownloaded = true;

    return true;
  };

  /**
   *
   * @param opts
   * @param siteSpecs
   */
  AnkTwitter.prototype.markDownloaded = function (opts, siteSpecs) {};

  /**
   *
   */
  AnkTwitter.prototype.installFunctions = function () {

    //
    let displayWhenGallaryOpened = () => {
      let content = this.elements.illust.gallary.content;
      if (!content) {
        return false;
      }

      new MutationObserver(() => {
        let modal = this.getOpenedModal();
        if (modal && modal.tweet) {
          this.displayDownloaded({'elm': this.getElements(modal.tweet), 'force': true});
        }
      }).observe(content, {'attributes': true});

      return true;
    };

    //
    let displayWhenTweetOpened = () => {
      let content = this.elements.illust.tweet.content;
      if (!content) {
        return false;
      }

      new MutationObserver((o) => {
        o.forEach((e) => {
          if (e.target.classList.contains('permalink-tweet')) {
            if (getComputedStyle(e.target, '').getPropertyValue('display') === 'block') {
              this.displayDownloaded({'elm': this.getElements(e.target), 'force': true});
            }
          }
        });
      }).observe(content, {'attributes': true, 'subtree': true});

      return true;
    };

    // 「保存済み」を表示する
    let delayDisplaying = () => {
      let modal = this.getOpenedModal();
      if (!modal || !modal.tweet) {
        return false;
      }

      return this.displayDownloaded({'elm': this.getElements(modal.tweet), 'force': true});
    };

    Promise.all([
      this.delayFunctionInstaller({'func': displayWhenGallaryOpened, 'retry': this.FUNC_INST_RETRY_VALUE, 'label': 'displayWhenGallaryOpened'}),
      this.delayFunctionInstaller({'func': displayWhenTweetOpened, 'retry': this.FUNC_INST_RETRY_VALUE, 'label': 'displayWhenTweetOpened'}),
      this.delayFunctionInstaller({'func': delayDisplaying, 'retry': this.FUNC_INST_RETRY_VALUE, 'label': 'delayDisplaying'}),
    ])
      .catch((e) => logger.warn(e));
  };

  // 開始

  new AnkTwitter().start()
    .catch((e) => {
      console.error(e);
    });

}
