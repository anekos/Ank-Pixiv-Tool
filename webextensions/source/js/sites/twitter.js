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
          "tweet": {"s": "#permalink-overlay .permalink-tweet"}
        },
        "gallary": {
          "ovr": {"s": ".Gallery.with-tweet"},
          "tweet": {"s": ".Gallery.with-tweet .tweet"}
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
      }
    };

    let gElms = this.initSelectors({'doc': doc}, SELECTOR_ITEMS, doc);

    return gElms;
  };

  /**
   *
   * @returns {boolean}
   */
  AnkSite.prototype.inIllustPage = function () {
    return true;
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

    let tweet = ['gallary', 'tweet'].map((k) => {
      let e = elm.illust[k];
      if (e.ovr && getComputedStyle(e.ovr).getPropertyValue('display') == 'block') {
        return e;
      }
    }).filter((e) => !!e)[0];

    if (!tweet) {
      return;
    }

    let elmTweet = this.getElements(tweet.tweet);

    return AnkSite.prototype.getContext.call(this, elmTweet, true);
  };

  /**
   *
   * @param opts
   */
  AnkTwitter.prototype.displayDownloaded = function (opts) {};

  /**
   *
   * @param opts
   * @param siteSpecs
   */
  AnkTwitter.prototype.markDownloaded = function (opts, siteSpecs) {};

  // 開始

  new AnkTwitter().start()
    .catch((e) => {
      console.error(e);
    });

}
