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
        'tree': '.js-detail-content .js-tweet-detail > article[data-key]',
        'video_container': '.js-media-native-video',
        'photo_containers': 'article[data-key="#CHIRP_ID#"], .quoted-tweet[data-key="#CHIRP_ID#"]',
        'photos': '.js-media-image-link',
        'photo_alt': '.media-img'
      },
      'info': {
        'illust': {
          'actionsMenu': '.tweet-action[rel="actionsMenu"]',
          'ownLink': '.tweet-timestamp a',
          'name': '.fullname',
          'datetime': '.tweet-timestamp',
          'caption': '.tweet-text'
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
     * ダウンロード情報（動画パス）の取得
     * @param modal
     * @returns {{thumbnail: (*|Array.<T>), original: Array}}
     */
    let getVideoPathContext = (modal) => {
      // ビデオ（GIFはモーダルが開かないので対応できない）
      // FIXME APIでID.json取得→m3u8(1)取得→m3u8(2)取得→分割TS取得→結合 に修正すべき
      let video_container = modal.querySelector(this.SELECTORS.illust.video_container);
      if (!video_container) {
        return;
      }

      let src = /^https?:\/\/.*/.test(video_container.src) && video_container.src;
      if (!src) {
        src = (/video_url=(.+?)(&|$)/.exec(video_container.src) || [])[1];
        if (!src) {
          return;
        }
      }

      let m = [{'src': src}];

      return {
        'thumbnail': m,
        'original': m
      };
    };

    /**
     * ダウンロード情報（画像パス）の取得
     * @param node
     * @returns {{thumbnail: (*|Array.<T>), original: Array}}
     */
    let getPathContext = (node) => {
      let photos = Array.prototype.filter.call(node.querySelectorAll(this.SELECTORS.illust.photos), (e) => !e.parentNode.classList.contains('is-video'));
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
        let ext = /\.([a-z]{3,4})\?/.exec(src);
        if (ext) {
          src = src.replace(/([?&]format=).+?(&|$)/, '$1'+ext[1]+'$2');
        }
        return {'src': src.replace(/([?&]name=).+?(&|$)/, '$1large$2')};
      })
        .filter(e => !!e);

      if (thumb.length < photos.length) {
        return;
      }

      let orig = thumb.map((e) => {
        return {'src': e.src.replace(/(?:=large)/, '=orig')};
      });

      return {
        'thumbnail': thumb,
        'original': orig
      };
    };

    /**
     * ダウンロード情報（イラスト情報）の取得
     * @param node
     * @returns {{url, id: *, title: (*|string|XML|void|string), posted: (boolean|*|Number), postedYMD: (boolean|string|*), tags: Array, caption: (Element|*|string|XML|void|string), R18: boolean}}
     */
    let getIllustContext = (node) => {
      try {
        let dd = new Date(parseInt(node.querySelector(this.SELECTORS.info.illust.datetime).getAttribute('data-time'),10));
        let posted = this.getPosted(() => AnkUtils.getDateData(dd));

        let ownLink = node.querySelector(this.SELECTORS.info.illust.ownLink);
        let caption = node.querySelector(this.SELECTORS.info.illust.caption);
        let caption_text = ((node) => {
          // リンクの省略表記を戻す
          let t = '';
          if (node) {
            t = AnkUtils.trim(node.textContent);
            Array.prototype.map.call(node.querySelectorAll('a[data-full-url]'), (e, i) => {
              // FIXME 誤判定の可能性はある
              t = t.replace(e.textContent, '###URL-'+i+'###');
              return e.getAttribute('data-full-url');
            }).forEach((e, i) => {
              t = t.replace('###URL-'+i+'###', e);
            });
          }
          return t;
        })(caption);

        let info = {
          'url': ownLink.href,
          'id': this.getIllustId(ownLink.url),
          'title': caption_text,
          'posted': !posted.fault && posted.timestamp,
          'postedYMD': !posted.fault && posted.ymd,
          'tags': Array.prototype.map.call(caption.querySelectorAll('a[rel="hashtag"] .link-complex-target'), (e)=>e.textContent),
          'caption': caption_text,
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
     * @param node
     * @returns {{id: string, name: (*|string|XML|void|string), pixiv_id: *, memoized_name: null}}
     */
    let getMemberContext = (node) => {
      try {
        let actionsMenu = node.querySelector(this.SELECTORS.info.illust.actionsMenu);
        let name = node.querySelector(this.SELECTORS.info.illust.name);
        let ownLink = node.querySelector(this.SELECTORS.info.illust.ownLink);

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
    if (modal) {
      // モーダルが開いている
      let context = {};

      let tw = this._getTweetItem(modal);

      // ビデオはモーダルウィンドウから、画像は元ツイートからパスを取得する
      context.path = getVideoPathContext(modal);
      if ( ! context.path) {
        context.path = getPathContext(tw);
      }
      context.illust = getIllustContext(modal);
      context.member = getMemberContext(modal);

      return context;
    }
    else {
      // ツリーが開いている (GIFのための暫定対応)
    }

    return null;
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
   * ツイート本体を探す
   * @param node
   * @returns {NodeList}
   * @private
   */
  _getTweetItem (node) {
    let actionsMenu = node.querySelector(this.SELECTORS.info.illust.actionsMenu);
    if (!actionsMenu) {
      return;
    }
    let chirpId = actionsMenu.getAttribute('data-chirp-id');
    let photo_containers = document.querySelectorAll(this.SELECTORS.illust.photo_containers.replace(/#CHIRP_ID#/g, chirpId));
    return Array.prototype.find.call(photo_containers, (e) => {
        return e.querySelectorAll('.media-image-container, .media-preview-container').length;
      }
    );
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
