"use strict";

{

  /**
   *
   * @constructor
   */
  let AnkPixiv = function () {

    AnkSite.apply(this, arguments);

    this.SITE_ID = 'PXV';

  };

  /**
   *
   * @type {AnkSite}
   */
  AnkPixiv.prototype = Object.create(AnkSite.prototype, {
    constructor: {
      'value': AnkPixiv,
      'enumerable': false
    }
  });

  /**
   * 利用するクエリのまとめ
   * @param doc
   */
  AnkPixiv.prototype.getElements = function (doc) {

    const SELECTOR_ITEMS = {
      "illust": {
        "imgOvr": {"s": ".works_display, ._1tR0cJT"},
        "med": {
          "img": {"s": ".works_display > ._layout-thumbnail > img, ._1tR0cJT ._2r_DywD"},
          "bigImg": {"s": ".original-image, ._1tR0cJT ._1-h8Se6.r_Q2Jin"}
        },
        "mng": {
          "img": {"s": ".works_display > ._work > ._layout-thumbnail > img, ._1tR0cJT ._2r_DywD"},
          "largeLink": {"s": ".works_display > a, ._1tR0cJT ._1-h8Se6"},
          "pages": {"s": "._2uvBc97"}
        },
        "ugo": {
          "img": {"s": ".works_display > ._ugoku-illust-player-container canvas"},
          "pause": {"s": ".kbpwWEq"}
        }
      },
      "mngIdx": {
        "errorMessage": {"s": [".errorArea" ,".errortxt"]},

        "scripts": {"ALL": "script"},
        "images": {"ALL": ".manga > .item-container > img"},
        "largeLinks": {"ALL": ".manga > .item-container > a"}
      },
      "info": {
        "illust": {
          "datetime": {"s": ".work-info .meta > li, ._3VLfD7p"},
          "size": {"s": ".work-info .meta > li+li"},
          "tools": {"s": ".work-info .tools"},
          "seriesTitle": {"s": "._1XvRWok"},
          "title": {"s": ".work-info .title, .TTmQ_bQ"},
          "R18": {"s": '.work-info .r-18, .work-info .r-18g, ._2wuGX9T > a[href*="R-18"]'},
          "caption": {"s": ".work-info .caption, ._2awgH_j .EG8MDwA p"},
          "nice": {"s": ".work-info .js-nice-button, .Ki5EGTG"},
          "update": {"s": ".bookmark_modal_thumbnail"},

          "tags": {"ALL": ".work-tags .tags > .tag > .text, ._1tTPwGC"}
        },
        "member": {
          "memberLink": {"s": ".profile .user-name, .JdrBYtD ._3RqJTSD"},
          "feedLink": {"s": '.column-header .tabs a[href^="/stacc/"]'}
        }
      },
      "misc": {
        "content": {"s": "._290uSJE"},
        "openCantion": {"s": ".ui-expander-container > .ui-expander-target > .expand, ._1MskjZd"},
        "downloadedDisplayParent": {"s": ".score, ._3VLfD7p"},
        "recommendList": {"s": "#illust-recommend ._image-items"},
        "feedList": {"s": ["#stacc_timeline", "#stacc_center_timeline"]},
        "rankingList": {"s": ".ranking-items"},
        "discovery": {"s": "#js-mount-point-discovery"},
        "allContents": {"s": '._3kixzeH div[role="rowgroup"]'}, // 'thumbnailAll': '_3kixzeH'
        "recommendContents": {"s": "._3NOStiW > aside:last-child"},
        "downloadedFilenameArea": {"s": ".ank-pixiv-downloaded-filename-text"},
        "nextLink": {"s": ".before > a, ._382QOVK._s3YizR"}, // 'link': '_382QOVK', 'next': '_s3YizR'
        "prevLink": {"s": ".after > a, ._382QOVK._22qFJA0"}   // 'link': '_382QOVK', 'prev': '_22qFJA0'
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
  AnkPixiv.prototype.inIllustPage = function (doc) {
    doc = doc || document;
    return !!this.getIllustId(doc.location.href);
  };

  /**
   * ダウンロード情報（画像パス）の取得
   * @param elm
   * @returns {Promise}
   */
  AnkPixiv.prototype.getPathContext = async function (elm) {
    let getMedPath = async () => {
      return {
        'thumbnail': [{'src': elm.illust.med.img.src, 'referrer': elm.doc.location.href}],
        'original': [{'src': elm.illust.med.bigImg.getAttribute('data-src') || elm.illust.med.bigImg.getAttribute('href'), 'referrer': elm.doc.location.href}]
      };
    };

    let getMngPath = async () => {
      // 単ページ漫画
      let single_page_manga_path = (indexDoc, referrer) => {
        if (!/(?:\?|&)mode=big(?:&|$)/.test(indexDoc.URL)) {
          return;
        }

        let img = indexDoc.querySelector('img');
        if (!img) {
          return;
        }

        return {
          original: [{'src': img.src, 'referrer': referrer}]
        };
      };

      // ブック
      let book_path = (indexDoc, indexElm, referrer) => {
        if (!indexDoc.documentElement.classList.contains('_book-viewer')) {
          return;
        }

        const RE_THUMB = /pixiv\.context\.images\[\d+]\s*=\s*"(.+?)"/;
        const RE_ORIG = /pixiv\.context\.originalImages\[\d+]\s*=\s*"(.+?)"/;

        let thumbnail = [];
        let original = [];

        Array.prototype.forEach.call(indexElm.mngIdx.scripts, function (e) {
          let mThumb = RE_THUMB.exec(e.text);
          if (mThumb) {
            thumbnail.push({'src': mThumb[1].replace(/\\(.)/g, '$1'), 'referrer': referrer});
          }
          let mOrig = RE_ORIG.exec(e.text);
          if (mOrig) {
            original.push({'src': mOrig[1].replace(/\\(.)/g, '$1'), 'referrer': referrer});
          }
        });

        // 見開き方向の判定
        let left2right = !!indexDoc.documentElement.classList.contains('ltr');

        // 見開きを考慮したページ数のカウントと画像の並べ替え
        let swapLR = (a, i) => {
          let tmp = a[i-1];
          a[i-1] = a[i];
          a[i] = tmp;
        };

        for (let i=0; i<thumbnail.length; i++) {
          let p = i + 1;
          let odd = p % 2;
          thumbnail[i].facingNo = original[i].facingNo = (p - odd) / 2 + 1;

          // 見開きの向きに合わせて画像の順番を入れ替える
          if (i > 0 && (left2right && odd)) {
            swapLR(thumbnail, i);
            swapLR(original, i);
          }
        }

        return {
          'original': original,
          'thumbnail': thumbnail
        };
      };

      // マンガ
      let manga_path = async (indexDoc, indexElm, referrer) => {
        if (indexDoc.documentElement.classList.contains('_book-viewer')) {
          return;
        }

        const MAX_PAGE = 1000;

        let thumbnail = [];
        let original = [];

        Array.prototype.some.call(indexElm.mngIdx.images, (v, i) => {
          if (i > MAX_PAGE) {
            return true;
          }

          thumbnail.push({'src': v.getAttribute('data-src'), 'referrer': referrer});
        });

        // オリジナル画像
        const RE_BIG = /(_p\d+)\./;
        const REPLACE_BIG = '_big$1.';
        const RE_MASTER = /^(https?:\/\/[^/]+).*?\/img-master\/(.+?)_master\d+(\.\w+)$/;
        const REPLACE_MASTER = '$1/img-original/$2$3';

        // 個々の画像用に存在するページのURLをreferer用に生成
        let refs = (() => {
          let url = this.elements.doc.getElementsByTagName('a')[0];
          let base = url.protocol+'//'+url.host;
          return Array.prototype.map.call(indexElm.mngIdx.largeLinks, (a) => base + a.getAttribute('href'));
        })();

        for (let i = 0; i < refs.length && i < thumbnail.length; i++) {
          logger.info('ORIGINAL IMAGE PAGE: '+refs[i]+', '+indexURL);
          let respBig = await remote.get({
            url: refs[i],
            //headers: [{name:'Referer', value:indexPage}],
            responseType: 'document',
            timeout: this.prefs.xhrTimeout
          });

          let docBig = respBig.document;
          let elmBig = this.getElements(docBig);

          // サーバエラーのトラップ
          if (!docBig || elmBig.mngIdx.errorMessage) {
            //return Promise.reject(new Error(chrome.i18n.getMessage('msg_serverError')));
            return;
          }

          let src = docBig.querySelector('img').src;

          if (this.prefs.forceCheckMangaImagesAll) {
            original.push({'src': src, 'referrer': refs[i]});
            continue;
          }

          let thumb_src = thumbnail[0].src;

          // 最初の一枚以外は拡張子チェックを行わないモード
          if (thumb_src == src) {
            logger.info('MANGA IMAGE: plane mode');
            original = thumbnail;
          }
          else if (thumb_src.replace(RE_MASTER, REPLACE_MASTER).replace(/\.\w+$/, '') == src.replace(/\.\w+$/, '')) {
            let replaceExt = /(\.\w+)$/.exec(src)[1];
            logger.info('MANGA IMAGE: master mode ... ', thumb_src, '->', thumb_src.replace(RE_MASTER, REPLACE_MASTER).replace(/\.\w+$/, replaceExt));
            original = thumbnail.map((v, j) => {
              return {'src': v.src.replace(RE_MASTER, REPLACE_MASTER).replace(/\.\w+$/, replaceExt), 'referrer': refs[j]};
            });
          }
          else if (thumb_src.replace(RE_BIG, REPLACE_BIG) == src) {
            logger.info('MANGA IMAGE: big mode ... ', thumb_src, '->', thumb_src.replace(RE_BIG, REPLACE_BIG));
            original = thumbnail.map((v, j) => {
              return {'src': v.src.replace(RE_BIG, REPLACE_BIG), 'referrer': refs[j]};
            });
          }
          else {
            logger.warn('MANGA IMAGE: UNKNOWN MODE ... ', thumb_src, '->', src);
          }

          break;
        }

        return {
          'original': original,
          'thumbnail': thumbnail
        };
      };

      // マンガインデックスページを参照して画像URLリストを取得する
      let indexURL = elm.illust.mng.largeLink.href;
      let referrer = elm.doc.location.href;
      logger.info('MANGA INDEX PAGE:', indexURL, referrer);

      let respIndex = await remote.get({
        'url': indexURL,
        'responseType': 'document',
        'timeout': this.prefs.xhrTimeout
      });

      let docIndex = respIndex.document;
      let elmIndex = this.getElements(docIndex);

      // サーバエラーのトラップ
      if (!docIndex || elmIndex.mngIdx.errorMessage) {
        return Promise.reject(new Error(chrome.i18n.getMessage('msg_serverError')));
      }

      // マンガ形式だけど単ページイラストの場合
      let single_path = single_page_manga_path(docIndex, referrer);
      if (single_path) {
        return single_path;
      }

      // ブック形式 or マンガ形式
      let multi_path = book_path(docIndex, elmIndex, referrer) || await manga_path(docIndex, elmIndex, referrer);
      if (!multi_path || multi_path.thumbnail.length == 0) {
        return Promise.reject(new Error(chrome.i18n.getMessage('msg_cannotFindImages')));
      }

      if (multi_path.thumbnail[0].hasOwnProperty('facing')) {
        // 見開きがある場合
        logger.info("Facing Page Check:", "(thumb)",  multi_path.thumbnail.length, "(orig)", multi_path.original.length, "pics in",  multi_path.thumbnail[multi_path.thumbnail.length - 1].facingNo,  "pages");
      }
      else {
        // 見開きがない場合
        logger.info("Page Check:", "(thumb)",  multi_path.thumbnail.length, "(orig)", multi_path.original.length, "pics");
      }

      return multi_path;
    };

    let getUgoPath = async () => {
      let script = `
        ((c) => {
          let f = (u) => {
            if (u && u.src && u.frames) {
              return [{
                'src': u.src,
                'frames': u.frames.map((o) => {return {'f':o.file, 'd':o.delay}}),
                'referrer': document.location.href
              }];
            }
          };

          return {
            'thumbnail': f(c.ugokuIllustData),
            'original': f(c.ugokuIllustFullscreenData)
          }
        })(pixiv.context)`;

      let id = 'ank-pixiv-script-ugoinfo';
      let name = 'AnkPixiv.UgoInfo';

      return AnkUtils.executeSiteScript(id, name, script);
    };

    let getMangaPath = async () => {
      try {
        let loc = elm.doc.location.href;
        let illustId = this.getIllustId(loc);

        let illust_resp = await remote.get({
          'url': 'https://www.pixiv.net/ajax/illust/'+illustId,
          'responseType': 'json',
          'timeout': this.prefs.xhrTimeout
        });

        let pages_resp = await remote.get({
          'url': 'https://www.pixiv.net/ajax/illust/'+illustId+'/pages',
          'responseType': 'json',
          'timeout': this.prefs.xhrTimeout
        });

        let illust_json = illust_resp.json.body;
        let pages_json = pages_resp.json.body;

        let thumbnail = pages_json.map((e) => { return {'src': e.urls.regular, 'referrer': loc}});
        let original = pages_json.map((e) => { return {'src': e.urls.original, 'referrer': loc}});

        if (illust_json.illustType != 1) {
          let sp_book_style = illust_json.contestBanners && parseInt(illust_json.contestBanners.illust_book_style, 10);
          if (sp_book_style == 1 || sp_book_style == 2) {
            // 特殊な値を返してくるタイプのブックスタイルマンガ (ex. 46271807 ～ 事務局の作品でしか見かけないが？)
            illust_json.illustType = 1;
            illust_json.restrict = sp_book_style == 1 && 2 || 1;
          }
          else if (illust_json.pageCount <= 1) {
            // マンガじゃないかも
            logger.error('not manga: illustType =', illust_json.illustType);
            return Promise.reject();
          }
        }

        if (!illust_json.restrict) {
          // イラストマンガ
          return {
            'original': original.length == 1 ? original[0] : original,
            'thumbnail': thumbnail.length == 1 ? thumbnail[0] : thumbnail
          };
        }
        else {
          // ブックスタイルマンガ - ブックスタイルマンガは作品数が少ないので考慮漏れがあるかもしれない

          let swapLR = (a, i) => {
            let tmp = a[i-1];
            a[i-1] = a[i];
            a[i] = tmp;
          };

          // 見開き方向の判定
          let left2right = illust_json.restrict == 1;

          // 見開きを考慮したページ数のカウントと画像の並べ替え
          for (let i=0; i<thumbnail.length; i++) {
            let p = i + 1;
            let odd = p % 2;
            thumbnail[i].facingNo = original[i].facingNo = (p - odd) / 2 + 1;

            // 見開きの向きに合わせて画像の順番を入れ替える
            if (i > 0 && (left2right && odd)) {
              swapLR(thumbnail, i);
              swapLR(original, i);
            }
          }

          return {
            'original': original,
            'thumbnail': thumbnail
          };
        }
      }
      catch (e) {
        logger.error(e);
      }
    };

    let getUgoiraPath = async () => {
      try {
        let f = (s, u, r) => {
          return [{
            'src': s,
            'frames': u.map((o) => {return {'f':o.file, 'd':o.delay}}),
            'referrer': r
          }];
        };

        let loc = elm.doc.location.href;
        let illustId = this.getIllustId(loc);

        let resp = await remote.get({
          'url': 'https://www.pixiv.net/ajax/illust/'+illustId+'/ugoira_meta',
          'responseType': 'json',
          'timeout': this.prefs.xhrTimeout
        });

        return {
          'thumbnail': f(resp.json.body.src, resp.json.body.frames, loc),
          'original': f(resp.json.body.originalSrc, resp.json.body.frames, loc)
        };
      }
      catch (e) {
        logger.error(e);
      }
    };

    //

    // 新デザイン
    if (elm.illust.mng.pages) {
      return getMangaPath();
    }
    if (elm.illust.ugo.pause) {
      return getUgoiraPath();
    }

    // 旧デザイン
    if (elm.illust.med.img) {
      return getMedPath();
    }
    if (elm.illust.mng.img) {
      return getMngPath();
    }
    if (elm.illust.ugo.img) {
      return getUgoPath();
    }
  };

  /**
   * ダウンロード情報（イラスト情報）の取得
   * @param elm
   * @returns {Promise.<{url: string, id: *, title: (SELECTOR_ITEMS.info.illust.title|{s}|*|*|string|XML|void|string), posted: (boolean|*|Number), postedYMD: (boolean|string|*), size: {width, height}, tags: *, tools: (SELECTOR_ITEMS.info.illust.tools|{s}|*|string|XML|void|string), caption: (SELECTOR_ITEMS.info.illust.caption|{s}|*|*|string|XML|void|string), R18: boolean}>}
   */
  AnkPixiv.prototype.getIllustContext = async function (elm) {
    try {
      let posted = this.getPosted(() => AnkUtils.decodeTextToDateData(elm.info.illust.datetime.textContent));

      let tags = Array.prototype.map.call(elm.info.illust.tags, (e) => {
        let tag = AnkUtils.trim(e.textContent);
        let eTrans = e.querySelector('.illust-tag-translation');
        if (eTrans) {
          let trans = AnkUtils.trim(eTrans.textContent);
          if (trans.length > 0) {
            tag = AnkUtils.trim(tag.slice(0, -trans.length));
            if (this.prefs.saveTagsWithTranslation) {
              tag += '('+trans+')';
            }
          }
        }
        return tag;
      });

      let info = {
        'url': elm.doc.location.href,
        'id': this.getIllustId(elm.doc.location.href),
        'title': elm.info.illust.title && AnkUtils.trim(elm.info.illust.title.textContent) || '',
        'posted': !posted.fault && posted.timestamp,
        'postedYMD': !posted.fault && posted.ymd,
        'size': ((sz) => {
          let m = /(\d+)\xD7(\d+)/.exec(sz);
          if (m) {
            return {
              'width': m[1],
              'height': m[2]
            };
          }
          return sz || '';
        })(elm.info.illust.size && elm.info.illust.size.textContent),
        'tags': tags,
        'tools': elm.info.illust.tools && AnkUtils.trim(elm.info.illust.tools.textContent) || '',
        'caption': elm.info.illust.caption && AnkUtils.trim(AnkUtils.getTextContent(elm.info.illust.caption)) || '',
        'R18': !!elm.info.illust.R18
      };

      ((u) => {
        let t = u && this.getLastUpdate(u.getAttribute('data-src'));
        if (t) {
          let d = AnkUtils.getDateData(new Date(t), false);
          if (d.timestamp > posted.timestamp) {
            // 更新があった場合
            info.updated = d.timestamp;
            info.updatedYMD = d.ymd;
          }
        }
      })(elm.info.illust.update);

      ((e) => {
        let m = e && /\/(\d+)$/.exec(e.href);
        if (m) {
          info.seriesId = m[1];
          info.seriesTitle = AnkUtils.trim(elm.info.illust.seriesTitle.textContent);
        }
      })(elm.info.illust.seriesTitle);

      return info;
    }
    catch (e) {
      logger.error(e);
    }
  };

  /**
   * ダウンロード情報（メンバー情報）の取得
   * @param elm
   * @returns {Promise.<{id: *, pixiv_id: (SELECTOR_ITEMS.info.member.feedLink|{s}|*|string), name: (*|string|XML|void), memoized_name: null}>}
   */
  AnkPixiv.prototype.getMemberContext = async function(elm) {
    try {
      let memberId = /\/member\.php\?id=(.+?)(?:&|$)/.exec(elm.info.member.memberLink.href)[1];

      /* - body.background が存在しないユーザが居るので保留 -
      let resp = await remote.get({
        'url': 'https://www.pixiv.net/ajax/user/'+memberId,
        'responseType': 'json',
        'timeout': this.prefs.xhrTimeout
      });

      return {
        'id': memberId,
        'pixiv_id': resp.json.body.background.extra.user_account,
        'name': resp.json.body.name,
        'memoized_name': null
      };
      */

      let pixivId = await (async (feedLink) => {
        if (!feedLink) {
          let memDoc = await remote.get({
            'url': 'https://www.pixiv.net/member.php?id='+memberId,
            //headers: [{name:'Referer', value:indexPage}],
            'responseType': 'document',
            'timeout': this.prefs.xhrTimeout
          });
          feedLink = memDoc.document.querySelector('#wrapper a[href*="/stacc/"]');
        }
        return /\/stacc\/([^?\/]+)/.exec(feedLink.href)[1];
      })(elm.info.member.feedLink);

      return {
        'id': memberId,
        'pixiv_id': pixivId,
        'name': AnkUtils.trim(elm.info.member.memberLink.textContent),
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
  AnkPixiv.prototype.getIllustId = function (loc) {
    if (/\/member_illust\.php\?/.test(loc) && /(?:&|\?)mode=medium(?:&|$)/.test(loc)) {
      return (/(?:&|\?)illust_id=(\d+)(?:&|$)/.exec(loc) || [])[1];
    }
  };

  /**
   * 最終更新日時の取得
   * @param loc
   * @returns {Array|{index: number, input: string}|number}
   */
  AnkPixiv.prototype.getLastUpdate = function (loc) {
    let m = /\/(20\d\d\/\d\d\/\d\d)\/(\d\d\/\d\d)\/\d\d\//.exec(loc);
    return m && new Date(m[1]+' '+m[2].replace(/\//g, ':')).getTime();
  };

  /**
   * サムネイルにダウンロード済みマークを付ける
   * @param opts
   * @param siteSpecs
   * @returns {*}
   */
  AnkPixiv.prototype.markDownloaded = function (opts, siteSpecs) {
    const MARKING_TARGETS = [
      {'q': '.image-item > .work', 'n': 1},               // 作品一覧、ブックマーク
      {'q': '.rank-detail a._work', 'n': 2},              // ホーム（ランキング）
      {'q': '.ranking-item a._work', 'n': 2},             // ランキング
      {'q': '.worksListOthersImg > ul > li > a', 'n': 1}, // プロファイル（ブックマーク、イメージレスポンス）
      {'q': '.worksImageresponseImg > a', 'n': 2},        // イラストページ（イメージレスポンス）
      {'q': 'li > a.response-in-work', 'n': 1},           // イラストページ（イメージレスポンス）
      {'q': '.search_a2_result > ul > li > a', 'n': 1},   // イメージレスポンス
      {'q': '.stacc_ref_illust_img > a', 'n': 3},         // フィード（お気に入りに追加したイラスト）
      {'q': '.stacc_ref_user_illust_img > a', 'n': 1},    // フィード（お気に入りに追加したユーザ内のイラスト）
      {'q': '.hotimage > a.work', 'n': 1},                // タグページ（週間ベスト）
      {'q': '.image-item > a:nth-child(1)', 'n': 1},      // タグページ（全期間＆新着）
      {'q': 'figure > div > a', 'n': 2},                  // ディスカバリー、タグページ
      {'q': '.sibling-items > .after > a', 'n': 1},       // 前の作品
      {'q': '.sibling-items > .before > a', 'n': 1},      // 次の作品
      // 以下新UI対応
      {'q': '.aw29wyY .kbZjQ32', 'n': -1, 'c': 'P1uthkK', 'm': 'border'},     // 関連作品
      {'q': '._3kixzeH ._382QOVK', 'n': -1, 'c': '_30HYOf4', 'm': 'border'},   // サムネイルリスト
      {'q': '._2qiYXlt ._382QOVK', 'n': -1, 'c': '_30HYOf4', 'm': 'border'}    // 前の作品、次の作品
    ];

    return AnkSite.prototype.markDownloaded.call(this, opts, {
      'queries': MARKING_TARGETS,
      'getId': (href) => {
        return this.getIllustId(href);
      },
      'getLastUpdate': (e) => {
        let g = e.querySelector('img');
        let s = g && g.src || e.getAttribute('style');
        return s && this.getLastUpdate(s);
      },
      'method': undefined
    });
  };

  /**
   * いいね！する
   */
  AnkPixiv.prototype.setNice = function () {
    if (this.elements.info.illust.nice.classList.contains('rated')) {
      logger.info('already rated');
      return;
    }

    this.elements.info.illust.nice.click();
  };

  /**
   * 機能のインストール（イラストページ用）
   */
  AnkPixiv.prototype.installIllustPageFunction = function (RETRY_VALUE) {
    // 中画像クリック関連
    let middleClickEventFunc = () => {
      // imgOvrの方になった場合は、medImgより広い領域がクリック可能となるが、ページ側の jQuery.on('click')を無効化できないため止む無し
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
        // うごイラ
        if (this.elements.illust.ugo.img) {
          return true;
        }

        // マンガ
        if (this.elements.illust.mng.img) {
          let largeLink = this.elements.illust.mng.largeLink;
          if (largeLink) {
            addMiddleClickEventListener(imgOvr);
            return true;
          }
        }

        // イラスト
        if (this.elements.illust.med.img) {
          let bigImg = this.elements.illust.med.bigImg;
          if (bigImg) {
            addMiddleClickEventListener(imgOvr);
            return true;
          }
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

    // キャプションを自動で開く
    let openCaption = () => {
      if (!this.prefs.openCaption) {
        return true;
      }

      let caption = this.elements.misc.openCantion;
      if (!caption) {
        return;
      }

      setTimeout(() => {
        if (getComputedStyle(caption).getPropertyValue('display').indexOf('block') != -1) {
          caption.click();
        }
      }, this.prefs.openCaptionDelay);

      return true;
    };

    // 評価したら自動ダウンロード
    let niceEventFunc = () => {
      if (!this.prefs.site.downloadWhenNice) {
        return true;
      }

      let nice = this.elements.info.illust.nice;
      if (!nice) {
        return;
      }

      let rated = nice.classList.contains('rated') || nice.classList.contains('_2iDv0r8');
      if (rated) {
        return true;
      }

      nice.addEventListener('click', () => {
        let rated = nice.classList.contains('rated') || nice.classList.contains('_2iDv0r8');
        if (rated) {
          return;
        }

        this.downloadCurrentImage({'autoDownload': true});
      }, false);

      return true;
    };

    // ajaxによるコンテンツの入れ替えを検出する
    let detectContentChange = () => {
      if (this.elements.doc.readyState !== "complete") {
        return false;   // リトライしてほしい
      }

      let content = this.elements.misc.content;
      if (!content) {
        return false;   // リトライしてほしい
      }

      // miniBrowseの中身が書き換わるのを検出する
      let moBrowse = new MutationObserver(() => {
        logger.debug('content changed.');
        this.restart();
        this.forceDisplayAndMarkDownloaded();
      });

      moBrowse.observe(content, {'childList': true});

      return true;
    };

    // 作品リストが自動伸長したらダウンロード済みマークを追加する
    let thumbnailListExpansion = () => {
      let observe = (elm) => {
        new MutationObserver((o) => {
          o.forEach((e) => Array.prototype.forEach.call(e.addedNodes, (n) => this.markDownloaded({'node': n, 'force':true})));
        }).observe(elm, {'childList': true});

        return true;
      };

      let alist = this.elements.misc.allContents;
      if (alist) {
        return observe(alist);
      }
    };

    // ページが自動伸長したらダウンロード済みマークを追加する
    let recommendExpansion = () => {
      let observe = (elm) => {
        new MutationObserver((o) => {
          o.forEach((e) => Array.prototype.forEach.call(e.addedNodes, (n) => {
            if (n.classList.contains('_2UWAFbb')) {
              this.markDownloaded({'node': n, 'force':true});
            }
          }));
        }).observe(elm, {'childList': true, 'subtree': true});

        return true;
      };

      let alist = this.elements.misc.recommendContents;
      if (alist) {
        return observe(alist);
      }

    };

    //

    Promise.all([
      AnkUtils.delayFunctionInstaller({'func': middleClickEventFunc, 'retry': RETRY_VALUE, 'label': 'middleClickEventFunc'}),
      AnkUtils.delayFunctionInstaller({'func': delayDisplaying, 'retry': RETRY_VALUE, 'label': 'delayDisplaying'}),
      AnkUtils.delayFunctionInstaller({'func': delayMarking, 'retry': RETRY_VALUE, 'label': 'delayMarking'}),
      AnkUtils.delayFunctionInstaller({'func': openCaption, 'retry': RETRY_VALUE, 'label': 'openCaption'}),
      AnkUtils.delayFunctionInstaller({'func': niceEventFunc, 'retry': RETRY_VALUE, 'label': 'niceEventFunc'}),
      AnkUtils.delayFunctionInstaller({'func': detectContentChange, 'retry': RETRY_VALUE, 'label': 'detectContentChange'}),
      AnkUtils.delayFunctionInstaller({'func': thumbnailListExpansion, 'retry': RETRY_VALUE, 'label': 'thumbnailListExpansion'}),
      AnkUtils.delayFunctionInstaller({'func': recommendExpansion, 'retry': RETRY_VALUE, 'label': 'recommendExpansion'})
    ])
      .catch((e) => logger.warn(e));
  };

  /**
   * 機能のインストール（リストページ用）
   */
  AnkPixiv.prototype.installListPageFunction = function (RETRY_VALUE) {

    // サムネイルにダウンロード済みマークを表示する
    let delayMarking = () => {
      if (this.elements.doc.readyState !== "complete") {
        return false;
      }

      return this.markDownloaded();
    };

    // ページが自動伸長したらダウンロード済みマークを追加する
    let followExpansion = () => {
      let observe = (elm) => {
        new MutationObserver((o) => {
          o.forEach((e) => Array.prototype.forEach.call(e.addedNodes, (n) => this.markDownloaded({'node': n, 'force':true})));
        }).observe(elm, {'childList': true});

        return true;
      };

      let alist = this.elements.misc.recommendList || this.elements.misc.feedList || this.elements.misc.rankingList;
      if (alist) {
        return observe(alist);
      }

      let discovery = this.elements.misc.discovery;
      if (discovery) {
        let container = discovery.querySelector('.column-title+div');
        if (container) {
          return observe(container);
        }
      }
    };

    // AutoPagerize/AutoPatchWork が継ぎ足し動作したらダウンロード済みマークを追加する
    let autoPagerize = () => {
      this.elements.doc.addEventListener('AutoPagerize_DOMNodeInserted', (e) => this.markDownloaded({'node': e.target, 'force':true}), false);
      this.elements.doc.addEventListener('AutoPatchWork.DOMNodeInserted', (e) => this.markDownloaded({'node': e.target, 'force':true}), false);
      return true;
    };

    Promise.all([
      AnkUtils.delayFunctionInstaller({'func': delayMarking, 'retry': RETRY_VALUE, 'label': 'delayMarking'}),
      AnkUtils.delayFunctionInstaller({'func': followExpansion, 'retry': RETRY_VALUE, 'label': 'followExpansion'}),
      AnkUtils.delayFunctionInstaller({'func': autoPagerize, 'retry': RETRY_VALUE, 'label': 'autoPagerize'})
    ])
      .catch((e) => logger.warn(e));
  };

  /**
   * 機能のインストールのまとめ
   */
  AnkPixiv.prototype.installFunctions = function () {
    if (this.inIllustPage()) {
      this.installIllustPageFunction(this.FUNC_INST_RETRY_VALUE);
      return;
    }

    this.installListPageFunction(this.FUNC_INST_RETRY_VALUE);
  };

  // 開始

  new AnkPixiv().start()
    .catch((e) => {
      console.error(e);
    });

}
