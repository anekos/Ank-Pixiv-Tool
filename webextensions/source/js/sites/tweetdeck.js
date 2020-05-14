"use strict";

class AnkTweetdeck extends AnkSite {
  /**
   * コンストラクタ
   */
  constructor () {
    super();

    this.SITE_ID = 'TDK';
    this.ALT_SITE_ID = 'TWT';

    this.USE_CONTEXT_CACHE = false;

    this.SELECTORS = {
      'illust': {
        'modal': '#open-modal',
        'video_container': '.js-media-native-video',
        'photo_containers': 'article[data-key="#CHIRP_ID#"], .quoted-tweet[data-key="#CHIRP_ID#"]',
        'photos': '.js-media-image-link',
        'photo_alt': '.media-img'
      },
      'info': {
        'illust': {
          'actionsMenu': '#open-modal .tweet-action[rel="actionsMenu"]',
          'ownLink': '#open-modal .tweet-timestamp a',
          'name': '#open-modal .fullname',
          'datetime': '#open-modal .tweet-timestamp',
          'caption': '#open-modal .tweet-text'
        },
        'member': {
        }
      }
    }
  }

  /**
   *
   * @returns {boolean}
   */
  inIllustPage () {
    return !!this.getIllustId();
  }

  /**
   * ダウンロード情報の取得
   * @param mode
   * @returns {Promise.<{}>}
   */
  async getAnyContext (mode) {

    /**
     * ダウンロード情報（画像パス）の取得
     * @param modal
     * @returns {{thumbnail: (*|Array.<T>), original: Array}}
     */
    let getPathContext = (modal) => {
      // ビデオ（GIFはモーダルが開かないので対応できない）
      // FIXME APIでID.json取得→m3u8(1)取得→m3u8(2)取得→分割TS取得→結合 に修正すべき
      let video_container = modal.querySelector(this.SELECTORS.illust.video_container);
      if (video_container) {
        let src = (/video_url=(.+?)(&|$)/.exec(video_container.src) || [])[1];
        if ( ! src) {
          return;
        }

        let m = [{'src': src}];

        return {
          'thumbnail': m,
          'original': m
        };
      }

      let actionsMenu = modal.querySelector(this.SELECTORS.info.illust.actionsMenu);
      if (!actionsMenu) {
        return;
      }
      let chirpId = actionsMenu.getAttribute('data-chirp-id');
      let photo_containers = document.querySelectorAll(this.SELECTORS.illust.photo_containers.replace(/#CHIRP_ID#/g, chirpId));
      let photos = [];
      Array.prototype.find.call(photo_containers, (e) => {
          photos = Array.prototype.filter.call(e.querySelectorAll(this.SELECTORS.illust.photos), (e) => !e.parentNode.classList.contains('is-video'));
          return !!photos.length;
        }
      );
      if (!photos.length) {
        return;
      }

      let thumb = Array.prototype.map.call(photos, (e) => {
        let src = (/background-image:\s*url\("?(.+?)"?\)/.exec(e.getAttribute('style')) || [])[1];
        if (!src) {
          let img = e.querySelector(this.SELECTORS.illust.photo_alt);
          if (!img || !img.src) {
            return;
          }

          src = img.src;
        }
        return {'src': src.replace(/\?.+?(:|$)/, '$1').replace(/:small$/, ':large')};
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
     * @param modal
     * @returns {{url, id: *, title: (*|string|XML|void|string), posted: (boolean|*|Number), postedYMD: (boolean|string|*), tags: Array, caption: (*|string|XML|void|string), R18: boolean}}
     */
    let getIllustContext = (modal) => {
      try {
        let dd = new Date(parseInt(modal.querySelector(this.SELECTORS.info.illust.datetime).getAttribute('data-time'),10));
        let posted = this.getPosted(() => AnkUtils.getDateData(dd));

        let ownLink = modal.querySelector(this.SELECTORS.info.illust.ownLink);
        let caption = modal.querySelector(this.SELECTORS.info.illust.caption);

        let info = {
          'url': ownLink.href,
          'id': this.getIllustId(ownLink.url),
          'title': AnkUtils.trim(caption.textContent),
          'posted': !posted.fault && posted.timestamp,
          'postedYMD': !posted.fault && posted.ymd,
          'tags': [],
          'caption': caption && AnkUtils.trim(caption.textContent),
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
     * @param modal
     * @returns {{id: string, name: (*|string|XML|void|string), pixiv_id: *, memoized_name: null}}
     */
    let getMemberContext = (modal) => {
      try {
        let actionsMenu = modal.querySelector(this.SELECTORS.info.illust.actionsMenu);
        let name = modal.querySelector(this.SELECTORS.info.illust.name);
        let ownLink = modal.querySelector(this.SELECTORS.info.illust.ownLink);

        return {
          'id': actionsMenu.getAttribute('data-user-id'),
          'name': AnkUtils.trim(name.textContent),
          'pixiv_id': /^https?:\/\/twitter\.com\/(.+?)\/status\//.exec(ownLink.href)[1],
          'memoized_name': null
        };
      }
      catch (e) {
        logger.error(e);
      }
    };

    //

    let modal = this._getOpenedModal();
    if (!modal) {
      return null;
    }

    let context = {};

    context.path = getPathContext(modal);
    context.illust = getIllustContext(modal);
    context.member = getMemberContext(modal);

    return context;
  }

  /**
   * 開いているツイートモーダルを探す
   * @returns {Element}
   * @private
   */
  _getOpenedModal () {
    let modal = document.querySelector(this.SELECTORS.illust.modal);
    if (!modal) {
      return;
    }
    if (getComputedStyle(modal, '').getPropertyValue('display') !== 'block') {
      return;
    }

    return modal;
  }

  /**
   * イラストIDの取得
   * @param url
   * @returns {*}
   */
  getIllustId (url) {
    if (url) {
      let m = /\/status\/(\d+)$/.exec(url);
      if (m) {
        return m[1];
      }
    }

    let modal = this._getOpenedModal();
    if (modal) {
      let ownLink = modal.querySelector(this.SELECTORS.info.illust.ownLink);
      if (ownLink && ownLink.href) {
        return this.getIllustId(ownLink.href);
      }
    }
  }

  /**
   *
   */
  installFunctions () {

    let displayWhenOpened = () => {
      let modal = document.querySelector(this.SELECTORS.illust.modal);
      if (!modal) {
        return false;
      }

      new MutationObserver(() => {
        if (this.inIllustPage()) {
          this.resetMarkAndDisplay();
          this.resetCondition();
          this.displayDownloaded({'force': true}).then();
        }
        else {
          this.resetMarkAndDisplay();
          this.resetCondition();
        }
      }).observe(modal, {'attributes': true});

      return true;
    };

    Promise.all([
      AnkUtils.delayFunctionInstaller({'func': displayWhenOpened, 'retry': this.FUNC_INST_RETRY_VALUE, 'label': 'displayWhenOpened'})
    ])
      .catch((e) => logger.warn(e));
  }

}

// 開始

new AnkTweetdeck().start()
  .catch((e) => {
    console.error(e);
  });
