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

    this.USE_CONTEXT_CACHE = false;

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

    const SELECTOR_ITEMS = {
      "illust": {
        "modal": {"s": "#open-modal"},
        "photos": null
      },
      "info": {
        "illust": {
          "actionsMenu": {"s": "#open-modal .tweet-action[rel=\"actionsMenu\"]"},
          "ownLink": {"s": "#open-modal .tweet-timestamp a"},
          "name": {"s": "#open-modal .fullname"},
          "datetime": {"s": "#open-modal .tweet-timestamp"},
          "caption": {"s": "#open-modal .tweet-text"}
        },
        "member": {
        }
      },
      "misc": {
        "downloadedDisplayParent": {"s": "#open-modal .tweet"}
      }
    };

    let gElms = this.initSelectors({'doc': doc}, SELECTOR_ITEMS, doc);

    Object.defineProperty(gElms.illust, 'photos', {
      'get': function () {
        let photos = [];
        let chirpId = gElms.info.illust.actionsMenu.getAttribute('data-chirp-id');
        Array.prototype.find.call(
          gElms.doc.querySelectorAll('article[data-key="'+chirpId+'"], .quoted-tweet[data-key="'+chirpId+'"]'),
          (e) => {
            photos = Array.prototype.filter.call(e.querySelectorAll('.js-media-image-link'), (e) => !e.parentNode.classList.contains('is-video'));
            return !!photos.length;
          }
        );
        return photos;
      }
    });

    return gElms;
  };

  /**
   *
   * @returns {boolean}
   */
  AnkTweetdeck.prototype.inIllustPage = function () {
    let modal = this.elements.illust.modal;
    if (modal) {
      return getComputedStyle(modal, '').getPropertyValue('display') === 'block';
    }
  };

  /**
   * ダウンロード情報（画像パス）の取得
   * @param elm
   * @returns {Promise}
   */
  AnkTweetdeck.prototype.getPathContext = async function (elm) {
    let photos = elm.illust.photos;
    if (!photos || photos.length == 0) {
      return;
    }

    let thumb = Array.prototype.map.call(photos, (e) => {
      let src = (/background-image:\s*url\("?(.+?)"?\)/.exec(e.getAttribute('style')) || [])[1];
      if (src) {
        return {'src': src.replace(/:small$/, ':large')};
      }
      let img = e.querySelector('.media-img');
      if (img && img.src) {
        return {'src': img.src.replace(/:small$/, ':large')};
      }
    })
      .filter(e => !!e);

    if (thumb.length < photos.length) {
      return;
    }

    let orig = thumb.map((e) => {
      return {'src': e.src.replace(/(?::large)?$/, ':orig')};
    });

    return {
      'thumbnail': thumb,
      'original': orig
    };
  };

  /**
   * ダウンロード情報（イラスト情報）の取得
   * @param elm
   * @returns {Promise.<{url: (string|*), id: *, title: (*|string|XML|void), posted: (boolean|*|Number), postedYMD: (boolean|string|*), tags: Array, caption: (*|string|XML|void), R18: boolean}>}
   */
  AnkTweetdeck.prototype.getIllustContext = async function (elm) {
    try {
      let dd = new Date(parseInt(elm.info.illust.datetime.getAttribute('data-time'),10));
      let posted = this.getPosted(() => AnkUtils.getDateData(dd));

      let info = {
        'url': elm.info.illust.ownLink.href,
        'id': /\/status\/(\d+)$/.exec(elm.info.illust.ownLink.href)[1],
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
   * @returns {Promise.<{id: string, name: (*|string|XML|void), pixiv_id: *, memoized_name: null}>}
   */
  AnkTweetdeck.prototype.getMemberContext = async function(elm) {
    try {
      return {
        'id': elm.info.illust.actionsMenu.getAttribute('data-user-id'),
        'name': AnkUtils.trim(elm.info.illust.name.textContent),
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
   * @returns {Promise.<*>}
   */
  AnkTweetdeck.prototype.getContext = async function (elm) {
    if (!this.inIllustPage()) {
      return;
    }

    return AnkSite.prototype.getContext.call(this, elm);
  };

  /**
   *
   * @param opts
   * @param siteSpecs
   */
  AnkTweetdeck.prototype.markDownloaded = function (opts, siteSpecs) {};

  /**
   *
   */
  AnkTweetdeck.prototype.installFunctions = function () {

    let displayWhenOpened = () => {
      let modal = this.elements.illust.modal;
      if (!modal) {
        return false;
      }

      new MutationObserver(() => {
        if (this.inIllustPage()) {
          this.displayDownloaded({'force': true});
        }
      }).observe(modal, {'attributes': true});

      return true;
    };

    Promise.all([
      AnkUtils.delayFunctionInstaller({'func': displayWhenOpened, 'retry': this.FUNC_INST_RETRY_VALUE, 'label': 'displayWhenOpened'})
    ])
      .catch((e) => logger.warn(e));
  };

  // 開始

  new AnkTweetdeck().start()
    .catch((e) => {
      console.error(e);
    });

}
