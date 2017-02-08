"use strict";

{

  let AnkPixiv = function () {
    AnkSite.apply(this, arguments);

    let self = this;

    self.SITE_ID = 'PXV';

    self.curContext = null;

    // focusイベント発生時に実行する機能のON・OFF
    self.onFocusUsage = {
      display: false,
      marking: false
    };
  };

  AnkPixiv.prototype = Object.create(AnkSite.prototype, {
    constructor: {
      value: AnkPixiv,
      enumerable: false
    }
  });

  //

  /**
   * 利用するクエリのまとめ
   * @param doc
   */
  AnkPixiv.prototype.getElements = function (doc) {

    function query (q) {
      return doc.querySelector(q);
    }

    function queryAll (q) {
      return doc.querySelectorAll(q);
    }

    return {
      illust: {
        get imgOvr () {
          return query('.works_display');
        },
        med: {
          get img () {
            return query('.works_display > ._layout-thumbnail > img');
          },
          get bigImg () {
            return query('.original-image');
          }
        },
        mng: {
          get img () {
            return query('.works_display > ._work > ._layout-thumbnail > img');
          },
          get largeLink () {
            return query('.works_display > a');
          }
        },
        ugo: {
          get img () {
            return query('.works_display > ._ugoku-illust-player-container canvas');
          }
        }
      },
      mngIdx: {
        get errorMessage () {
          return query('.errorArea') || query('.errortxt');
        },
        get scripts () {
          return queryAll('script');
        },
        get images () {
          return queryAll('.manga > .item-container > img');
        },
        get largeLinks () {
          return queryAll('.manga > .item-container > a');
        }
      },
      info: {
        illust: {
          get datetime () {
            return query('.work-info .meta > li');
          },
          get size () {
            return query('.work-info .meta > li+li');
          },
          get tools () {
            return query('.work-info .tools');
          },
          get title () {
            return query('.work-info .title');
          },
          get R18 () {
            return query('.work-info .r-18, .work-info .r-18g');
          },
          get caption () {
            return query('.work-info .caption');
          },
          get rating () {
            return query('.work-info .rating');
          },
          get tags () {
            return queryAll('.work-tags .tags > .tag > .text');
          },
          get update () {
            return query('.bookmark_modal_thumbnail');
          }
        },
        member: {
          get memberLink () {
            return query('.profile-unit > .user-link');
          },
          get feedLink () {
            return Array.prototype.filter.call(queryAll('.tabs > li > a'), (a) => /\/stacc\//.test(a.href))[0];
          }
        }
      },
      misc: {
        get openCantion () {
          return query('.ui-expander-container > .ui-expander-target > .expand');
        },
        get downloadedDisplayParent () {
          return query('.score');
        },
        get recommendList() {
          // この作品をブックマークした人はこんな作品もブックマークしています
          // あなたのブックマークタグ「○○」へのおすすめ作品
          return query('#illust-recommend ._image-items');
        },
        get feedList() {
          return query('#stacc_timeline') || query('#stacc_center_timeline');
        },
        get rankingList() {
          return query('.ranking-items');
        },
        get downloadedFilenameArea () {
          return query('.ank-pixiv-downloaded-filename-text');
        },
        get nextLink() {
          return query('.before > a');
        },
        get prevLink() {
          return query('.after > a');
        }
      },
      thumbnails: {
      },
      doc: doc
    };
  };

  /**
   * ダウンロード情報のまとめ
   * @param elm
   */
  AnkPixiv.prototype.getContext = function (elm) {

    function getIllustInfo () {
      try {
        let posted = self.getPosted(() => AnkUtils.decodeDateTimeText(elm.info.illust.datetime.textContent));
        let info = {
          url: elm.doc.location.href,
          id: self.getIllustId(elm.doc.location.href),
          title: AnkUtils.trim(elm.info.illust.title.textContent),
          posted: !posted.fault && posted.timestamp,
          postedYMD: !posted.fault && posted.ymd,
          size: (function (sz) {
            sz = AnkUtils.trim(sz);
            let m = /(\d+)\xD7(\d+)/.exec(sz);
            if (m) {
              return {
                width: m[1],
                height: m[2]
              };
            }
            return sz;
          })(elm.info.illust.size.textContent),
          tags: Array.prototype.map.call(elm.info.illust.tags, (e) => AnkUtils.trim(e.textContent)),
          tools: elm.info.illust.tools && AnkUtils.trim(elm.info.illust.tools.textContent),
          caption: elm.info.illust.caption && AnkUtils.trim(elm.info.illust.caption.innerText),
          R18: !!elm.info.illust.R18
        };

        (function (u) {
          let t = u && self.getLastUpdate(u.getAttribute('data-src'));
          if (t) {
            let d = AnkUtils.getDecodedDateTime(new Date(t));
            if (d.timestamp > posted.timestamp) {
              // 更新があった場合
              info.updated = d.timestamp;
              info.updatedYMD = d.ymd;
            }
          }
        })(elm.info.illust.update);

        return Promise.resolve(info);
      }
      catch (e) {
        AnkUtils.Logger.debug(e);
        return Promise.resolve();
      }
    }

    function getMemberInfo () {
      try {
        let info = {
          id: /\/member\.php\?id=(.+?)(?:&|$)/.exec(elm.info.member.memberLink.href)[1],
          pixivId: /\/stacc\/([^\?\/]+)/.exec(elm.info.member.feedLink.href)[1],
          name: AnkUtils.trim(elm.info.member.memberLink.textContent),
          memoizedName: null
        };

        return Promise.resolve(info);
      }
      catch (e) {
        AnkUtils.Logger.debug(e);
        return Promise.resolve();
      }
    }

    //

    let self = this;
    let context = null;

    let getPath = function () {
      function getMedPath () {
        return Promise.resolve({
          original: [{src:elm.illust.med.bigImg.getAttribute('data-src'), referrer:elm.doc.location.href}]
        });
      }

      function getMngPath () {
        return (async () => {
          // マンガインデックスページを参照して画像URLリストを取得する
          let indexPage = elm.illust.mng.largeLink.href;
          let referrer = elm.doc.location.href;
          AnkUtils.Logger.debug('MANGA INDEX PAGE: '+indexPage+', '+referrer);

          let html = await AnkUtils.Remote.get({
            url: indexPage,
            headers: [{name:'Referer', value:referrer}],
            timeout: self.prefs.xhrTimeout
          });
          let docIdx = AnkUtils.createHTMLDocument(html);
          let elmIdx = self.getElements(docIdx);

          // サーバエラーのトラップ
          if (!docIdx || elmIdx.mngIdx.errorMessage) {
            return Promise.reject(new Error(AnkUtils.Locale.getMessage('msg_serverError')));
          }

          // マンガ形式だけど単ページイラストの場合
          if (/(?:\?|&)mode=big(?:&|$)/.test(indexPage)) {
            let img = docIdx.querySelector('img');
            if (img) {
              return {
                original: [{src:img.src, referrer:referrer}]
              };
            }
          }

          // ブック or マンガ
          let thumb = [];
          let orig = [];
          let thumbRef = [];
          let origRef = [];
          let facing = [];
          if (docIdx.documentElement.classList.contains('_book-viewer')) {
            // ブック
            // pixivの構成変更で、ページ単位で設定できていた見開き表示が、作品単位でしか設定できなくなったようだ

            const RE_THUMB = /pixiv\.context\.images\[\d+]\s*=\s*"(.+?)"/;
            const RE_ORIG = /pixiv\.context\.originalImages\[\d+]\s*=\s*"(.+?)"/;

            Array.prototype.forEach.call(elmIdx.mngIdx.scripts, function (e) {
              let mt = RE_THUMB.exec(e.text);
              if (mt) {
                thumb.push(mt[1].replace(/\\(.)/g, '$1'));
              }
              let mo = RE_ORIG.exec(e.text);
              if (mo) {
                orig.push(mo[1].replace(/\\(.)/g, '$1'));
              }
            });

            let ltr = docIdx.documentElement.classList.contains('ltr');

            thumbRef = indexPage;
            origRef = indexPage;

            let swap = function (a, i) {
              let tmp = a[i-1];
              a[i-1] = a[i];
              a[i] = tmp;
            };

            for (let i=0; i<thumb.length; i++) {
              let p = i+1;
              if (p == 1) {
                facing.push(p);
              }
              else {
                let odd = p % 2;
                facing.push((p - odd) / 2 + 1);

                // 見開きの向きに合わせて画像の順番を入れ替える
                if (ltr && odd) {
                  swap(thumb, i);
                  swap(orig, i);
                }
              }
            }
          }
          else {
            // マンガ
            const MAX_PAGE = 1000;

            Array.prototype.some.call(elmIdx.mngIdx.images, function (v, i) {
              if (i > MAX_PAGE) {
                return true;
              }
              thumb.push(v.getAttribute('data-src'));
            });
            thumbRef = indexPage;

            if (self.prefs.viewOriginalSize) {
              // オリジナル画像
              const RE_BIG = /(_p\d+)\./;
              const REPLACE_BIG = '_big$1.';
              const RE_MASTER = /^(https?:\/\/[^/]+).*?\/img-master\/(.+?)_master\d+(\.\w+)$/;
              const REPLACE_MASTER = '$1/img-original/$2$3';

              // 個々の画像用に存在するページ
              origRef = (function () {
                let url = document.getElementsByTagName('a')[0];
                let base = url.protocol+'//'+url.host;
                return Array.prototype.map.call(elmIdx.mngIdx.largeLinks, (a) => base + a.getAttribute('href'));
              })();

              for (let i = 0; i < origRef.length && i < thumb.length; i++) {
                AnkUtils.Logger.debug('ORIGINAL IMAGE PAGE: '+origRef[i]+', '+indexPage);
                let html = await AnkUtils.Remote.get({
                  url: origRef[i],
                  headers: [{name:'Referer', value:indexPage}],
                  timeout: self.prefs.xhrTimeout
                });
                let docBig = AnkUtils.createHTMLDocument(html);
                let elmBig = self.getElements(docBig);

                // サーバエラーのトラップ
                if (!docBig || elmBig.mngIdx.errorMessage) {
                  return Promise.reject(new Error(AnkUtils.Locale.getMessage('msg_serverError')));
                }

                let src = docBig.querySelector('img').src;

                if (!self.prefs.forceCheckMangaImagesAll) {
                  // 最初の一枚以外は拡張子チェックを行わないモード
                  if (thumb[0] == src) {
                    AnkUtils.Logger.debug('MANGA IMAGE: plane mode');
                    orig = thumb;
                  }
                  else if (thumb[0].replace(RE_MASTER, REPLACE_MASTER).replace(/\.\w+$/, '') == src.replace(/\.\w+$/, '')) {
                    let replaceExt = /(\.\w+)$/.exec(src)[1];
                    AnkUtils.Logger.debug('MANGA IMAGE: master mode ... '+thumb[0]+' -> '+thumb[0].replace(RE_MASTER, REPLACE_MASTER).replace(/\.\w+$/, replaceExt));
                    orig = thumb.map((v) => v.replace(RE_MASTER, REPLACE_MASTER).replace(/\.\w+$/, replaceExt));
                  }
                  else if (thumb[0].replace(RE_BIG, REPLACE_BIG) == src) {
                    AnkUtils.Logger.debug('MANGA IMAGE: big mode ... '+thumb[0]+' -> '+thumb[0].replace(RE_BIG, REPLACE_BIG));
                    orig = thumb.map((v) => v.replace(RE_BIG, REPLACE_BIG));
                  }
                  else {
                    AnkUtils.Logger.debug('MANGA IMAGE: UNKNOWN MODE ... '+thumb[0]+' -> '+src);
                  }

                  break;
                }

                orig.push(src);
              }
            }
          }

          if (thumb.length <= 0) {
            // FIXME
            return Promise.reject(new Error('HOGEHOGE'));
          }

          if (facing.length > 0 && facing[facing.length - 1] < facing.length) {
            // 見開きがある場合
            AnkUtils.Logger.debug("Facing Page Check: (thumb) " + thumb.length + ", (orig) "+orig.length+" pics in " + facing[facing.length - 1] + " pages");
          }
          else {
            // 見開きがない場合
            AnkUtils.Logger.debug("Facing Page Check: (thumb) " + thumb.length + ", (orig) "+orig.length+" pics");
            facing = null;
          }

          return (function (path) {
            thumb.forEach(function (t, i) {
              let to = { 'src': t, 'referrer': Array.isArray(thumbRef) ? thumbRef[i] : thumbRef};
              let oo = { 'src': orig[i], 'referrer': Array.isArray(origRef) ? origRef[i] : origRef};
              if (facing) {
                to.facing = oo.facing = facing[i];
              }
              path.thumbnail.push(to);
              path.original.push(oo);
            });

            return path;
          })({
            thumbnail: [],
            original: []
          });
        })();
      }

      function getUgoPath () {
        return (async () => {
          const genObj = `
            (function (c) {
              function f (u) {
                if (u && u.src && u.frames) {
                  return [{
                    src: u.src,
                    frames: u.frames.map((o) => {return {s:o.file, w:o.delay}}),
                    referrer: document.location.href
                  }];
                }
              }

              return {
                thumbnail: f(c.ugokuIllustData),
                original: f(c.ugokuIllustFullscreenData)
              }
            })(pixiv.context)`;

          let id = 'ank-pixiv-script-ugoinfo';
          let name = 'AnkPixiv.UgoInfo';

          return await AnkUtils.PageScript.exec(elm.doc, id, name, genObj);
        })();
      }

      //

      if (elm.illust.med.img) {
        return getMedPath();
      }
      if (elm.illust.mng.img) {
        return getMngPath();
      }
      if (elm.illust.ugo.img) {
        return getUgoPath();
      }

      return Promise.resolve();
    };

    return Promise.all([getPath(), getIllustInfo(), getMemberInfo()])
      .then((result) => {
        context = {
          downloadable: !!result[0] && !!result[1] && !!result[2],
          serviceId: self.SITE_ID,
          siteName: self.sitePrefs.folder,
          path: result[0],
          info: {
            illust: result[1],
            member: result[2]
          }
        };

        AnkUtils.Logger.debug('CONTEXT: ', context);

        return context;
      });
  };

  /**
   * ダウンロードの実行用ハンドラ
   */
  AnkPixiv.prototype.downloadCurrentImage = function (opt) {
    let self = this;

    opt = opt || {};

    (async () => {
      self.curContext = self.curContext && self.curContext.downloadable ? self.curContext : await self.getContext(self.elements);
      if (!self.curContext) {
        let msg = AnkUtils.Locale.getMessage('msg_notReady');
        AnkUtils.Logger.error(new Error(msg));
        return;
      }

      if (!self.curContext.downloadable) {
        // 作品情報が見つからない
        let msg = AnkUtils.Locale.getMessage('msg_cannotFindImages');
        AnkUtils.Logger.error(new Error(msg));
        alert(msg);
        return;
      }

      if (opt.autoDownload) {
        let r = await self.queryDownloadStatus(self.curContext.info.illust.id);
        if (r && r[0]) {
          // ダウンロード済みの場合、自動ダウンロードが発生してもキャンセルする
          return;
        }
      }

      chrome.runtime.sendMessage({'type': 'AnkPixiv.Download.addContext', 'context': self.curContext}, (o) => AnkUtils.Logger.info(o));
    })();
  };

  /**
   * Viewerの操作用ハンドラ
   */
  AnkPixiv.prototype.openViewer = function (e) {
    let self = this;

    (async () => {
      self.curContext = self.curContext && self.curContext.downloadable ? self.curContext : await self.getContext(self.elements);
      if (!self.curContext) {
        AnkUtils.Logger.error(new Error('viewer not ready'));
        return;
      }

      self.viewer.open(e);
    })();
  };

  /**
   * 評価の実行用ハンドラ
   */
  AnkPixiv.prototype.setRate = function (pt) {
    let self = this;

    pt = (function (p) {
      if (typeof p === 'number') {
        return p;
      }

      try {
        return parseInt(p, 10);
      }
      catch(e) {
        return -1;
      }
    })(pt);

    if (pt < 1 || 10 < pt) {
      AnkUtils.Logger.debug('out of range');
      return;
    }

    return (async () => {
      const genObj = `
        (function (rating) {
          if (!pixiv.context.rated && rating && typeof rating.rate === 'number') {
            rating.apply.call(rating, #PT#);
            return true;
          }
          else {
            return false;
          }
        })(pixiv.rating)`.replace(/#PT#/, pt);

      let id = 'ank-pixiv-script-rating';
      let name = 'AnkPixiv.Rating';

      let success = await AnkUtils.PageScript.exec(self.elements.doc, id, name, genObj);
      if (success) {
        // 自動ダウンロード（評価時）
        if (self.prefs.downloadWhenRate && self.prefs.downloadRate <= pt) {
          self.downloadCurrentImage({autoDownload:true});
        }
      }
    })();
  };

  /**
   * イラストIDの取得(イラストページ用)
   */
  AnkPixiv.prototype.getIllustId = function (loc) {
    if (/\/member_illust\.php\?/.test(loc) && /(?:&|\?)mode=medium(?:&|$)/.test(loc)) {
      return (/(?:&|\?)illust_id=(\d+)(?:&|$)/.exec(loc) || [])[1];
    }
  };

  /**
   * 最終更新日時の取得
   */
  AnkPixiv.prototype.getLastUpdate = function (loc) {
    let m = /\/(20\d\d\/\d\d\/\d\d)\/(\d\d\/\d\d)\/\d\d\//.exec(loc);
    return m && new Date(m[1]+' '+m[2].replace(/\//g, ':')).getTime();
  };

  /**
   *
   */
  AnkPixiv.prototype.delayDisplaying = function () {
    let self = this;

    if (!self.prefs.displayDownloaded) {
      return Promise.resolve(true);
    }

    self.onFocusUsage.display = true;

    return (async () => {
      let appendTo = self.elements.misc.downloadedDisplayParent;
      if (!appendTo) {
        return;
      }

      self.curContext = self.curContext && self.curContext.info.illust ? self.curContext : await self.getContext(self.elements);
      if (!self.curContext.info.illust) {
        return;
      }

      self.insertDownloadedDisplay(appendTo, {id:self.curContext.info.illust.id, R18:self.curContext.info.illust.R18, update:self.curContext.info.illust.update});
      return true;
    })();
  };

  /**
   * サムネイルにダウンロード状況表示
   */
  AnkPixiv.prototype.delayMarking = function (node, opt) {
    let self = this;

    opt = opt || {};

    if (!self.prefs.markDownloaded) {
      return true;
    }

    self.onFocusUsage.marking = true;

    const targets = [
      { q:'.image-item > .work', n:1 },               // 作品一覧、ブックマーク
      { q:'.rank-detail a._work', n:2 },              // ホーム（ランキング）
      { q:'.ranking-item a._work', n:2 },             // ランキング
      { q:'.worksListOthersImg > ul > li > a', n:1 }, // プロファイル（ブックマーク、イメージレスポンス）
      { q:'.worksImageresponseImg > a', n:2 },        // イラストページ（イメージレスポンス）
      { q:'li > a.response-in-work', n:1 },           // イラストページ（イメージレスポンス）
      { q:'.search_a2_result > ul > li > a', n:1 },   // イメージレスポンス
      { q:'.stacc_ref_illust_img > a', n:3 },         // フィード（お気に入りに追加したイラスト）
      { q:'.stacc_ref_user_illust_img > a', n:1 },    // フィード（お気に入りに追加したユーザ内のイラスト）
      { q:'.hotimage > a.work', n:1 },                // タグページ（週間ベスト）
      { q:'.image-item > a:nth-child(1)', n:1 },      // タグページ（全期間＆新着）
      { q:'.sibling-items > .after > a', n:1 },       // 前の作品
      { q:'.sibling-items > .before > a', n:1 }       // 次の作品
    ];

    self.insertDownloadedMark(node || self.elements.doc, {
      illust_id: opt.illust_id,
      getId: function (href) {
        return self.getIllustId(href);
      },
      getLastUpdate: function (e) {
        let g = e.querySelector('img');
        return g && self.getLastUpdate(g.src);
      },
      targets: targets,
      overlay: false,
      force: opt.force,
      ignorePref: false
    });

    return true;
  };

  /**
   * focusイベントのハンドラ
   */
  AnkPixiv.prototype.onFocusHandler = function () {
    let self = this;
    if (self.onFocusUsage.display) {
      self.delayDisplaying();
    }
    if (self.onFocusUsage.marking) {
      self.delayMarking();
    }
  };

  /**
   * イラストページ用機能のインストール
   */
  AnkPixiv.prototype.installFunctions = function () {

    // イラストページ用の機能のインストール
    function installMediumPageFunctions () {
      // 中画像クリック関連
      let middleClickEventFunc = function () {
        // FIXME imgOvrの方になった場合は、medImgより広い領域がクリック可能となるが、ページ側の jQuery.on('click')を無効化できないため止む無し
        let addMiddleClickEventListener = function (imgOvr) {
          function mcHandler (e) {
            let useEvent = self.prefs.largeOnMiddle || self.prefs.downloadWhenClickMiddle;
            let useCapture = self.prefs.largeOnMiddle;
            if (!useEvent) {
              return;
            }

            if (self.prefs.largeOnMiddle) {
                (async () =>{
                self.curContext = self.curContext && self.curContext.path ? self.curContext : await self.getContext(self.elements);
                if (!self.curContext) {
                  return;
                }

                self.viewer.open(self.curContext.path, self.prefs);
              })();
            }

            if (self.prefs.downloadWhenClickMiddle) {
              // 自動ダウンロード（中画像クリック時）
              self.downloadCurrentImage({autoDownload:true});
            }

            if (useCapture) {
              e.preventDefault();
              e.stopPropagation();
            }
          }

          imgOvr.addEventListener('click', mcHandler, true);
        };

        //

        // オーバーレイ
        let imgOvr = self.elements.illust.imgOvr;
        if (!imgOvr) {
          return;
        }

        let r = (function () {
          // うごイラ
          if (self.elements.illust.ugo.img) {
            return true;
          }

          // マンガ
          if (self.elements.illust.mng.img) {
            let largeLink = self.elements.illust.mng.largeLink;
            if (largeLink) {
              addMiddleClickEventListener(imgOvr);
              return true;
            }
          }

          // イラスト
          if (self.elements.illust.med.img) {
            let bigImg = self.elements.illust.med.bigImg;
            if (bigImg) {
              addMiddleClickEventListener(imgOvr);
              return true;
            }
          }
        })();

        return r;
      };

      // 「保存済み」を表示する
      let delayDisplaying = function () {
        return self.delayDisplaying();
      };

      // イメレスのサムネイルにダウンロード済みマークを表示する
      let delayMarking = function () {
        return self.delayMarking();
      };

      // キャプションを自動で開く
      let openCaption = function () {
        if (!self.prefs.openCaption) {
          return true;
        }

        setTimeout(() => {
          let openCaption = self.elements.misc.openCantion;
          if (openCaption && openCaption.style.display === 'block') {
            openCaption.click();
          }
        }, self.prefs.openCaptionDelay);

        return true;
      };

      // 評価したら自動ダウンロード
      let ratingEventFunc = function () {
        let rating = self.elements.info.illust.rating;
        if (!rating) {
          return;
        }

        let rated = rating.classList.contains('rated');

        rating.addEventListener('click', () => {
          if (self.prefs.downloadWhenRate && !rated) {
            rated = Array.prototype.some.call(rating.classList, (c) => {
              let m = /^rate-(\d+)$/.exec(c);
              if (m) {
                if (self.prefs.downloadRate <= parseInt(m[1], 10)) {
                  self.downloadCurrentImage({autoDownload: true});
                }
                return true;
              }
            });
          }
        }, false);

        return true;
      };

      //

      return Promise.all([
        AnkUtils.delayFunctionInstaller({func:middleClickEventFunc, retry:RETRY_VALUE, label:'middleClickEventFunc'}),
        AnkUtils.delayFunctionInstaller({prom:delayDisplaying, retry:RETRY_VALUE, label:'delayDisplaying'}),
        AnkUtils.delayFunctionInstaller({func:delayMarking, retry:RETRY_VALUE, label:'delayMarking'}),
        AnkUtils.delayFunctionInstaller({func:openCaption, retry:RETRY_VALUE, label:'openCaption'}),
        AnkUtils.delayFunctionInstaller({func:ratingEventFunc, retry:RETRY_VALUE, label:'ratingEventFunc'})
      ])
        .catch((e) => AnkUtils.Logger.error(e));
    }

    /**
     * リストページ用機能のインストール
     */
    function installListPageFunctions () {

      // サムネイルにダウンロード済みマークを表示する
      let delayMarking = function () {
        return self.delayMarking();
      };

      // ページが自動伸長したらダウンロード済みマークを追加する
      let followExpansion = function () {
        let elm = self.elements.misc.recommendList || self.elements.misc.feedList || self.elements.misc.rankingList;
        if (!elm) {
          return;
        }

        new MutationObserver((o) => {
          o.forEach((e) => self.delayMarking(e.target, {force:true}));
        }).observe(elm, {childList: true});

        return true;
      };

      // AutoPagerize/AutoPatchWork が継ぎ足し動作したらダウンロード済みマークを追加する
      let autoPagerize = function () {
        self.elements.doc.addEventListener('AutoPagerize_DOMNodeInserted', (e) => self.delayMarking(e.target, {force:true}), false);
        self.elements.doc.addEventListener('AutoPatchWork.DOMNodeInserted', (e) => self.delayMarking(e.target, {force:true}), false);
        return true;
      };

      return Promise.all([
          AnkUtils.delayFunctionInstaller({func:delayMarking, retry:RETRY_VALUE, label:'delayMarking'}),
          AnkUtils.delayFunctionInstaller({func:followExpansion, retry:RETRY_VALUE, label:'followExpansion'}),
          AnkUtils.delayFunctionInstaller({func:autoPagerize, retry:RETRY_VALUE, label:'autoPagerize'})
        ])
        .catch((e) => AnkUtils.Logger.error(e));
    }

    //

    // 初期化

    let RETRY_VALUE = {
      max: 30,
      wait: 1000
    };

    let self = this;

    if (self.getIllustId(document.location.href)) {
      installMediumPageFunctions();
    }
    else {
      installListPageFunctions();
    }
  };

  // 開始

  new AnkPixiv().start();

}
