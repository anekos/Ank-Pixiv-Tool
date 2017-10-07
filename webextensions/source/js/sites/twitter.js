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

    let query = (q) => {
      return doc.querySelector(q);
    };

    let queryAll = (q) => {
      return doc.querySelectorAll(q);
    };

    return {
      'illust': {
        'tweet': {
          get ovr () {
            return query('#permalink-overlay');
          },
          get tweet () {
            return query('#permalink-overlay .permalink-tweet');
          }
        },
        'gallary': {
          get ovr () {
            return query('.Gallery.with-tweet');
          },
          get tweet () {
            return query('.Gallery.with-tweet .tweet');
          }
        },
        get photos () {
          return queryAll('.AdaptiveMedia-container .AdaptiveMedia-photoContainer img');
        },
        get video () {
          return query('.AdaptiveMedia-container .AdaptiveMedia-videoContainer video');
        }
      },
      'info': {
        'illust': {
          get ownLink () {
            return query('.time .tweet-timestamp');
          },
          get datetime () {
            return query('.time  .tweet-timestamp ._timestamp');
          },
          get caption () {
            return query('.tweet-text');
          }
        },
        'member': {
        }
      },
      'misc': {
      },
      'thumbnails': {
      },
      'doc': doc
    };
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
      let posted = this.getPosted(() => AnkUtils.getDecodedDateTime(dd));

      let info = {
        'url': elm.info.illust.ownLink.href,
        'id': elm.doc.getAttribute('data-tweet-id'),
        'title': AnkUtils.trim(elm.info.illust.caption.innerText),
        'posted': !posted.fault && posted.timestamp,
        'postedYMD': !posted.fault && posted.ymd,
        'tags': [],
        'caption': AnkUtils.trim(elm.info.illust.caption.innerText),
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
   * ダウンロードの実行
   * @param opts
   */
  AnkTwitter.prototype.downloadCurrentImage = function (opts) {

    (async () => {

      opts = opts || {};

      let context = await this.getContext(this.elements);
      if (!context) {
        // コンテキストが集まらない（ダウンロード可能な状態になっていない）
        let msg = chrome.i18n.getMessage('msg_notReady');
        logger.warn(new Error(msg));
        return;
      }

      if (!context.downloadable) {
        // 作品情報が見つからない
        let msg = chrome.i18n.getMessage('msg_cannotFindImages');
        logger.error(new Error(msg));
        alert(msg);
        return;
      }

      let status = await this.requestGetDownloadStatus(context.info.illust.id, true);

      let member = await this.requestGetMemberInfo(context.info.member.id, context.info.member.name);
      context.info.member.memoized_name = member.name;

      this.executeDownload({'status': status, 'context': context, 'autoDownload': opts.autoDownload});
    })().catch((e) => logger.error(e));
  };

  // 開始

  new AnkTwitter().start()
    .catch((e) => {
      console.error(e);
    });

}
