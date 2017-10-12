"use strict";

{

  /**
   *
   * @constructor
   */
  let AnkTweetdeck = function () {

    AnkSite.apply(this, arguments);

    this.SITE_ID = 'TDK';
    this.ALT_SITE_ID = 'TWT';

  };

  /**
   *
   * @type {AnkSite}
   */
  AnkTweetdeck.prototype = Object.create(AnkSite.prototype, {
    constructor: {
      'value': AnkTweetdeck,
      'enumerable': false
    }
  });

  /**
   * 利用するクエリのまとめ
   * @param doc
   */
  AnkTweetdeck.prototype.getElements = function (doc) {

    let query = (q) => {
      return doc.querySelector(q);
    };

    let queryAll = (q) => {
      return doc.querySelectorAll(q);
    };

    return {
      'illust': {
        get modal () {
          return query('#open-modal');
        }
      },
      'info': {
        'illust': {
          get actionsMenu () {
            return query('#open-modal .tweet-action[rel="actionsMenu"]');
          },
          get ownLink () {
            return query('#open-modal .tweet-timestamp a');
          },
          get name () {
            return query('#open-modal .fullname');
          },
          get datetime () {
            return query('#open-modal .tweet-timestamp');
          },
          get caption () {
            return query('#open-modal .tweet-text');
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
  AnkTweetdeck.prototype.getPathContext = async function (elm) {
    let photos = elm.doc.querySelector('article[data-key="'+elm.info.illust.actionsMenu.getAttribute('data-chirp-id')+'"]').querySelectorAll('.js-media-image-link');
    if (photos.length > 0) {
      let m = Array.prototype.map.call(photos, (e) => {
        let src = (/background-image:url\("?(.+?)"?\)/.exec(e.getAttribute('style')) || [])[1];
        src = src && src.replace(/:small$/, ':large');
        return {'src': this.prefs.downloadOriginalSize ? src.replace(/(?::large)?$/, ':orig') : src};
      });

      if (m.length > 0) {
        return {
          'original': m
        };
      }
    }
  };

  /**
   * ダウンロード情報（イラスト情報）の取得
   * @param elm
   * @returns {{url: string, id, title, posted: (boolean|Number|*), postedYMD: (boolean|*), size: {width, height}, tags: *, tools: *, caption: *, R18: boolean}}
   * @returns {{url: (string|*), id: string, title: (*|string|XML|void), posted: (boolean|Number|*), postedYMD: (boolean|string|*), tags: Array, caption: (*|string|XML|void), R18: boolean}}
   */
  AnkTweetdeck.prototype.getIllustContext = function (elm) {
    try {
      let dd = new Date(parseInt(elm.info.illust.datetime.getAttribute('data-time'),10));
      let posted = this.getPosted(() => AnkUtils.getDateData(dd));

      let info = {
        'url': elm.info.illust.ownLink.href,
        'id': elm.info.illust.actionsMenu.getAttribute('data-chirp-id'),
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
  AnkTweetdeck.prototype.getMemberContext = function(elm) {
    try {
      return {
        'id': elm.info.illust.actionsMenu.getAttribute('data-user-id'),
        'name': elm.info.illust.name.textContent,
        'pixiv_id': /^https?:\/\/twitter\.com\/(.+?)\//.exec(elm.info.illust.ownLink.href)[1],
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
  AnkTweetdeck.prototype.getContext = async function (elm, force) {

    let modal = elm.illust.modal;
    if (!modal || getComputedStyle(modal).getPropertyValue('display') != 'block') {
      return;
    }

    return AnkSite.prototype.getContext.call(this, elm, true);
  };

  /**
   *
   * @param opts
   */
  AnkTweetdeck.prototype.displayDownloaded = function (opts) {};

  /**
   *
   * @param opts
   * @param siteSpecs
   */
  AnkTweetdeck.prototype.markDownloaded = function (opts, siteSpecs) {};

  // 開始

  new AnkTweetdeck().start()
    .catch((e) => {
      console.error(e);
    });

}
