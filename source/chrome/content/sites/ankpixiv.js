
Components.utils.import("resource://gre/modules/Task.jsm");

try {

  let AnkPixivModule = function (doc) {

    var self = this;

    self.curdoc = doc;

    self.viewer;

    self.marked = false;

    self._functionsInstalled = false;

    self._image = {
        thumbnail: null,
        originai: null,
    };

    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.in = { // {{{
      get manga () { // {{{
        let v = self.info.path.mangaIndexPage;
        return v && v.match(/(?:&|\?)mode=manga(?:&|$)/);
      }, // }}}

      get ugoira () { // {{{
        let e = self.elements.illust.mediumImage;
        return e && e.tagName.toLowerCase() === 'canvas';
      }, // }}}

      get medium () { // {{{
        let loc = self.info.illust.pageUrl;
        return (
          loc.match(/member_illust\.php\?/) &&
          loc.match(/(?:&|\?)mode=medium(?:&|$)/) &&
          loc.match(/(?:&|\?)illust_id=\d+(?:&|$)/)
        );
      }, // }}}

      get illustPage () // {{{
        self.in.medium, // }}}

      get myPage () // {{{
        (self.info.illust.pageUrl == 'http://www.pixiv.net/mypage.php'), // }}}

      get myIllust () // {{{
        !self.elements.illust.avatar, // }}}

      /*
       * 以下はモジュールローカル部品
       */

      // elementsを使っているが確定後にしか使わないのでOK
      get feed () // {{{
        self.elements.illust.feedList, // }}}

      get illustList () // {{{
        self.info.illust.pageUrl.match(/\.pixiv\.net\/member_illust.php\?id=/), // }}}

      get bookmarkNew () // {{{
        self.info.illust.pageUrl.match(/\.pixiv\.net\/bookmark_new_illust\.php/), // }}}

      get bookmarkAdd () // {{{
        self.info.illust.pageUrl.match(/\.pixiv\.net\/bookmark_add\.php\?/), // }}}
    }; // }}}

    self.elements = (function () { // {{{
      function query (q)
        self.elements.doc.querySelector(q)

      function queryAll (q)
        self.elements.doc.querySelectorAll(q)

      let illust =  {
        get largeLink () {
          let e = illust.ugoiraContainer;
          if (e)
            return e.querySelector('a');

          e = illust.mediumImage;
          if (e)
            return e.parentNode.parentNode;
        },

        get datetime ()
          query('.meta > li'),

        get size ()
          query('.meta > li+li'),

        get title ()
          query('.work-info .title'),

        get comment ()
          query('.work-info .caption'),

        get avatar ()
          query('.profile-unit > a > img.user-image'),

        get userName ()
          query('.profile-unit > a > .user'),

        get memberLink ()
          query('.profile-unit > a.user-link'),

        get userTags ()
          query('.user-tags'),

        get tags ()
          queryAll('.tags > .tag > .text'),

        get tools ()
          query('.tools'),

        get R18 ()
          query('.r-18')
          ||
          query('.r-18g'),

        get feedLink ()
          query('.tab-feed'),

        // この作品をブックマークした人はこんな作品もブックマークしています
        // あなたのブックマークタグ「○○」へのおすすめ作品
        get recommendList()
          AnkUtils.A(queryAll('._image-items')).pop(),

        get ugoiraContainer ()
          query('.works_display ._ugoku-illust-player-container'),

        get ugoiraFullscreenLink ()
          query('.works_display ._ugoku-illust-player-container .full-screen'),

        get feedList()
          query('#stacc_timeline')
          ||
          query('#stacc_center_timeline'),

        get rankingList()
          query('.ranking-items'),

        get autoPagerizeTarget()
          queryAll('._unit'),

        get nextLink()
          query('.before > a'),

        get prevLink()
          query('.after > a'),

        get uiLayoutWest ()
          query('.ui-layout-west'),

        // require for AnkBase

        get downloadedDisplayParent ()
          query('.score'),

        get downloadedFilenameArea ()
          query('.ank-pixiv-downloaded-filename-text'),

        // require for AnkViewer

        get body () {
          let e = queryAll('body');
          return e && e.length > 0 && e[0];
        },

        get wrapper ()
          query('#wrapper'),

        get mediumImage () {
          return (
            query('.works_display > ._layout-thumbnail > img')
            ||
            query('.works_display > a > div > img')
            ||
            query('.works_display > * > a > div > img')
            ||
            query('.works_display canvas')
          );
        },

        get bigImage ()
          query('.original-image'),

        get imageOverlay ()
          query('.works_display ._layout-thumbnail'), 

        get openCaption ()
          query('.ui-expander-container > .ui-expander-target > .expand'),

        get ads () {
          const Ads = [
                       'object',
                       'iframe',
                       '.ui-search',
                       'form.search2',          // 検索欄も広告扱いしちゃうぞ
                       '#global-header',        // ヘッダ
                       '.header',
                       '._header',
                       '#toolbar-items',        // toolbar
                       '._toolmenu',            // 閲覧履歴ボタン
                       '#gm_ldrize',            // ldrize
                       '#header-banner',
                       ];

          let a = [];
          Ads.forEach(function (q) AnkUtils.A(queryAll(q)).forEach(function (e) a.push(e)));
          return a;
        },

      };

      let mypage = {
        get fantasyDisplay ()
          query('#' + self.ID_FANTASY_DISPLAY),

        get fantasyDisplayNext ()
          query('#contents > div > div.area_pixivmobile'),
      };

      return {
        illust: illust,
        mypage: mypage,
        get doc () self.curdoc,
      };
    })(); // }}}

    self.info = (function () { // {{{
      let illust = {
        get pageUrl ()
          self.elements.doc.location.href,

        get id ()
          self.illustId,

        get dateTime () {
          let e = self.elements.illust.datetime;
          return e && AnkUtils.decodeDateTimeText(e.textContent);
        },

        get size () {
          let e = self.elements.illust.size;
          if (e) {
            let m = e.textContent.match(/(\d+)\xD7(\d+)/);
            if (m)
              return {
                width: parseInt(m[1]),
                height: parseInt(m[2])
              };
          }
        },

        get tags ()
          AnkUtils.A(self.elements.illust.tags) .
            map(function (e) AnkUtils.trim(e.textContent)) .
              filter(function (s) s && s.length),

        get shortTags () {
          let limit = AnkBase.Prefs.get('shortTagsMaxLength', 8);
          return illust.tags.filter(function (it) (it.length <= limit));
        },

        get tools () {
          let e = self.elements.illust.tools;
          return e && AnkUtils.trim(e.textContent);
        },

        get width () {
          let sz = illust.size;
          return sz && sz.width;
        },

        get height () {
          let sz = illust.size;
          return sz && sz.height;
        },

        get server () {
          let a = self.info.path.image.images;
          if (a.length > 0) {
            let m = a[0].match(/^https?:\/\/([^\/\.]+)\./i);
            if (m)
              return m[1];
          }
        },

        get referer () {
          let mode =
            !self.in.manga                                    ? 'big' :
            !AnkBase.Prefs.get('downloadOriginalSize', false) ? 'manga' :
                                                                'manga_big&page=0'; // @see downloadFiles#downloadNext()

          return self.info.illust.pageUrl.replace(/mode=medium/, 'mode='+mode);
        },

        get title () {
          let e = self.elements.illust.title;
          return e && AnkUtils.trim(e.textContent);
        },

        get comment () {
          let e = self.elements.illust.comment;
          return e && AnkUtils.textContent(e);
        },

        get R18 ()
          !!self.elements.illust.R18,

        get animationFrames() {
          let ugoku = self.elements.doc.defaultView.wrappedJSObject.pixiv.context.ugokuIllustData;
          if (ugoku) {
            let frames = ugoku.frames;
            if (frames)
              return frames.map(function (o) o.file+','+o.delay);
          }
        },
      };

      let member = {
        get id () {
          let e = self.elements.illust.memberLink;
          if (e) {
            let m = e.href.match(/\/member\.php\?id=(\d+)/);
            if (m)
              return m[1];
          }
        },

        // XXX 遅延が酷いとavatar.srcで例外発生？
        get pixivId () {
          let e = self.elements.illust.feedLink;
          let m = e && e.href.match(/\/stacc\/([^\?\/]+)/);
          if (!m) {
            e = self.elements.illust.avatar;
            m = e && e.src.match(/\/profile\/([^\/]+)\//);
          }
          if (m)
            return m[1];
        },

        get name () {
          let e = self.elements.illust.userName;
          return e && AnkUtils.trim(e.textContent);
        },

        get memoizedName ()
          AnkBase.memoizedName(member.id, self.SERVICE_ID),
      };

      let path = {
        get initDir ()
          AnkBase.Prefs.get('initialDirectory.'+self.SITE_NAME),

        get ext ()
          AnkUtils.getFileExtension(path.image.images.length > 0 && path.image.images[0]),

        get mangaIndexPage () {
          let e = self.elements.illust.largeLink;
          return e && e.href;
        },

        get ugokuIllustSrc () {
          let ugoku = self.elements.doc.defaultView.wrappedJSObject.pixiv.context.ugokuIllustData;
          return ugoku && ugoku.src;
        },

        get ugokuIllustFullscreenSrc () {
          let ugoku = self.elements.doc.defaultView.wrappedJSObject.pixiv.context.ugokuIllustFullscreenData;
          return ugoku && ugoku.src;
        },

        // ダウンロード時のみの利用なので downloadOriginalSize のチェックだけでよい
        get image () // {{{
          self.in.manga && !AnkBase.Prefs.get('downloadOriginalSize', false) ? self._image.thumbnail : self._image.original, // }}}
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })(); // }}}

  };


  AnkPixivModule.prototype = {

    /********************************************************************************
     * 定数
     ********************************************************************************/

    URL:       'http://www.pixiv.net/',
    DOMAIN:     'www.pixiv.net',
    SERVICE_ID: 'PXV',
    SITE_NAME:  'Pixiv',

    ID_FANTASY_DISPLAY: 'ankpixiv-fantasy-display',

    PAGE_TYPE: {
      ILLUST: 1,
      LIST: 2,
      NULL: 0,
    },

    /********************************************************************************
     * グローバルメソッド
     ********************************************************************************/

    /**
     * このモジュールの対応サイトかどうか
     */
    isSupported: function (doc) {
      return doc.location.href.match(/^https?:\/\/www\.pixiv\.net\//);
    },

    /**
     * ファンクションのインストール
     */
    initFunctions: function () {
      if (this._functionsInstalled)
        return;

      this._functionsInstalled = true;

      if (this.in.medium) {
        this.installMediumPageFunctions();
      }
      else {
        this.installListPageFunctions();
      }
    },

    /**
     * ダウンロード可能か
     */
    isDownloadable: function () {
      return this.in.medium && !this.in.myIllust;
    },

    /**
     * イラストID
     */
    get illustId () {
      let m = this.curdoc.location.href.match(/illust_id=(\d+)/);
      return m && parseInt(m[1], 10);
    },

    /**
     * ダウンロード実行
     */
    downloadCurrentImage: function (useDialog, debug) {
      let self = this;
      this.getImageUrl(AnkBase.Prefs.get('downloadOriginalSize', false), function (image) {
        // 画像の情報がない
        if (image.images.length == 0) {
          window.alert(AnkBase.Locale('cannotFindImages'));
          return;
        }

        let context = new AnkContext(self);
        AnkBase.addDownload(context, useDialog, debug);
      });
    },

    /**
     * 画像URLリストの取得
     */
    getImageUrl: function (mangaOriginalSizeCheck, callback) {
      function doCallback (v) {
        if (self.in.manga && !mangaOriginalSizeCheck) {
          self._image.thumbnail = v;
        }
        else {
          self._image.original = v;
        }

        callback(v);
      }

      let self = this;

      // うごイラ
      if (self.in.ugoira) {
        return doCallback({
          images: [ self.info.path.ugokuIllustFullscreenSrc || self.info.path.ugokuIllustSrc ],
          facing: null,
        });
      }

      // 単ページイラスト
      if (!self.in.manga) {
        let result = (function () {
          if (self.elements.illust.bigImage) {
            let src = self.elements.illust.bigImage.getAttribute('data-src');
            AnkUtils.dump(src);
            if (src) {
              return {
                images: [ src ],
                facing: null,
              }
            }
          }
          return AnkBase.NULL_RET;
        })();
        return doCallback(result);
      }

      // マンガ or ブック

      // 取得済みならそのまま返す(ここはdoCallbackではない)
      if (!mangaOriginalSizeCheck && self._image.thumbnail && self._image.thumbnail.lenght > 0) {
        return callback(self._image.thumbnail);
      }
      if (mangaOriginalSizeCheck && self._image.original && self._image.original.length > 0) {
        return callback(self._image.original);
      }

      // マンガインデックスページを参照して画像URLリストを取得する
      Task.spawn(function* () {

        let indexPage = self.info.path.mangaIndexPage;
        let referer = self.info.illust.pageUrl;
        AnkUtils.dump('MANGA INDEX PAGE: '+indexPage);
        let html = yield AnkUtils.httpGETAsync(indexPage, referer);
        let doc = AnkUtils.createHTMLDocument(html);

        // サーバエラーのトラップ
        if (!doc || doc.querySelector('.errorArea') || doc.querySelector('.errortxt')) {
          window.alert(AnkBase.Locale('serverError'));
          return AnkBase.NULL_RET;
        }

        referer = indexPage;

        // pixivの構成変更で、ページ単位で設定できていた見開き表示が、作品単位でしか設定できなくなったようだ
        const MAXPAGE = 1000;
        let imMed = [];
        AnkUtils.A(doc.querySelectorAll('.manga > .item-container > img')).some(function (v) {
          if (imMed.length > MAXPAGE)
            return true;
          imMed.push(v.getAttribute('data-src'));
        });

        let im = [];
        let fp = [];
        if (!mangaOriginalSizeCheck) {
          // サムネイル画像
          im = imMed;
        } else {
          // オリジナル画像
          let reBig = /(_p\d+)\./;
          let replaceBig = '_big$1.';
          let reMaster = /^(https?:\/\/[^/]+).*?\/img-master\/(.+?)_master\d+(\.\w+)$/;
          let replaceMaster = '$1/img-original/$2$3';

          let a = AnkUtils.A(doc.querySelectorAll('.manga > .item-container > a'));
          for (let i=0; i<a.length && i<MAXPAGE; i++) {
            let href = indexPage;
            href = href.replace(/^(https?:\/\/.+?)(?:\/.*)$/,"$1")+a[i].href;
            AnkUtils.dump('ORIGINAL IMAGE PAGE: '+href);
            let html = yield AnkUtils.httpGETAsync(href, indexPage);
            let doc = AnkUtils.createHTMLDocument(html);

            // サーバエラーのトラップ
            if (!doc || doc.querySelector('.errorArea') || doc.querySelector('.errortxt')) {
              window.alert(AnkBase.Locale('serverError'));
              return AnkBase.NULL_RET;
            }

            let src = doc.querySelector('img').src;

            if (AnkBase.Prefs.get('forceCheckMangaImagesAll', false)) {
              im.push(src);
            } else {
              // 最初の一枚以外は拡張子チェックを行わない
              if (imMed[0] ==  src) {
                AnkUtils.dump('MANGA IMAGE: plane mode');
                im = imMed;
              }
              else if (imMed[0].replace(reMaster, replaceMaster).replace(/\.\w+$/, '') == src.replace(/(\.\w+)$/, '')) {
                let replaceExt = RegExp.$1;
                AnkUtils.dump('MANGA IMAGE: master mode ... '+imMed[0]+' -> '+imMed[0].replace(reMaster, replaceMaster).replace(/\.\w+$/, replaceExt));
                im = imMed.map(function (v) v.replace(reMaster, replaceMaster).replace(/\.\w+$/, replaceExt));
              }
              else if (imMed[0].replace(reBig, replaceBig) ==  src) {
                AnkUtils.dump('MANGA IMAGE: big mode ... '+imMed[0]+' -> '+imMed[0].replace(reBig, replaceBig));
                im = imMed.map(function (v) v.replace(reBig, replaceBig));
              }
              else {
                AnkUtils.dump('MANGA IMAGE: UNKNOWN MODE ... '+imMed[0]+' -> '+src);
              }
              break;
            }
          }
        }

        if (im.length == 0) {
          // ブック
          if (doc.documentElement.classList.contains('_book-viewer')) {
            let ltr = doc.documentElement.classList.contains('ltr');
            let re = mangaOriginalSizeCheck ? /pixiv\.context\.originalImages\[\d+\]\s*=\s*\"(.+?)\"/ : /pixiv\.context\.images\[\d+\]\s*=\s*\"(.+?)\"/;
            AnkUtils.A(doc.querySelectorAll('script')).forEach(function (e) {
              let mimg = e.text.match(re);
              if (mimg)
                im.push(mimg[1].replace(/\\(.)/g, '$1'));
            });

            for (var i=0; i<im.length; i++) {
              let p = i+1;
              if (p == 1) {
                fp.push(p);
              }
              else {
                let oddp = p%2;
                fp.push((p - oddp) / 2 + 1)

                // 見開きの向きに合わせて画像の順番を入れ替える
                if (ltr && oddp) {
                  let tmp = im[i-1];
                  im[i-1] = im[i];
                  im[i] = tmp;
                }
              }
            }
          }
        }

        if (im.length > 0) {
          if (fp.length > 0 && fp[fp.length - 1] < fp.length) {
            // 見開きがある場合
            AnkUtils.dump("Facing Page Check: " + im.length + " pics in " + fp[fp.length - 1] + " pages");
          }
          else {
            // 見開きがない場合
            AnkUtils.dump("Facing Page Check: " + im.length + " pics");
            fp = null;
          }

          return { images: im, facing: fp, };
        }

        // error
        window.alert(AnkBase.Locale('serverError'));
        return AnkBase.NULL_RET;

      }).then(function (result) {
          doCallback(result);
        },
        function (e) {
          window.alert(AnkBase.Locale('serverError'));
          AnkUtils.dumpError(e);
          callback(AnkBase.NULL_RET);
        }
      );
    },

    /********************************************************************************
     * ローカルメソッド
     ********************************************************************************/

    /*
     * イラストページにviewerやダウンロードトリガーのインストールを行う
     */
    installMediumPageFunctions: function () { // {{{

      let proc = function () {
        // インストールに必用な各種要素
        var doc = self.elements.doc;
        var body = self.elements.illust.body;
        var wrapper = self.elements.illust.wrapper;
        var medImg = self.elements.illust.mediumImage;
        var largeLink = self.elements.illust.largeLink;
        var openCaption = self.elements.illust.openCaption;
        var userTags = self.elements.illust.userTags;
        var imgOvr = self.elements.illust.imageOverlay;
        var jq = doc.defaultView.wrappedJSObject.jQuery

        // 完全に読み込まれていないっぽいときは、遅延する
        if (!(body && medImg && wrapper && userTags)) { // {{{
          return false;   // リトライしてほしい
        } // }}}

        // デバッグ用
        if (AnkBase.Prefs.get('showDownloadedFilename', false)) {
          let e = self.elements.illust.uiLayoutWest;
          if (e) {
            {
              let div = doc.createElement('div');
              div.classList.add('area_new');
              div.classList.add('ank-pixiv-downloaded-filename');

              let dtitle = doc.createElement('div');
              dtitle.classList.add('area_title');
              dtitle.classList.add('ank-pixiv-downloaded-filename-title');
              div.appendChild(dtitle);

              let dcaption = doc.createElement('div');
              dcaption.classList.add('area_inside');
              dcaption.classList.add('ank-pixiv-downloaded-filename-text');
              div.appendChild(dcaption);

              e.insertBefore(div, e.querySelector('.profile-unit+*'));
            }
          }
        }

        // 大画像関係
        if (!self.in.ugoira) {
          if (AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+self.SITE_NAME, true)) {
            if (imgOvr && jq) {
              // FIXME 多分このunbindがbindの後になる場合がある。setTimeoutでもう一回実行しているのは場当たり的な対応
              jq(imgOvr).off('click');
              setTimeout(function () jq(imgOvr).off('click'), 1000);
            }

            new AnkViewer(self);
          }
        }

        // FIXME AnkViewer無効時に、中クリックして、Pixivのデフォルト動作で大画像を見ると、ダウンロードマークが消える
        // 中画像クリック時に保存する
        if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
          let e = imgOvr || largeLink;
          e.addEventListener(
            'click',
            // FIXME AnkViewer有効かつ中クリックダウンロード有効時に、getImageUrl()が２重に実行されてしまうので、0.5秒遅延させる
            function () setTimeout(function () AnkBase.downloadCurrentImageAuto(self), 500),
            true
          );
        } // }}}

        // レイティングによるダウンロード
        if (AnkBase.Prefs.get('downloadWhenRate', false)) { // {{{
          let point = AnkBase.Prefs.get('downloadRate', 10);
          AnkUtils.A(doc.querySelectorAll('.rating')).forEach(function (e) {
            e.addEventListener(
              'click',
              function () {
                let klass = e.getAttribute('class', '');
                let m = klass.match(/rate-(\d+)/);
                if (m && (point <= parseInt(m[1], 10)))
                  AnkBase.downloadCurrentImageAuto(self);
              },
              true
            );
          });
        } // }}}

        // 保存済み表示
        AnkBase.insertDownloadedDisplayById(
          self.elements.illust.downloadedDisplayParent,
          self.info.illust.id,
          self.SERVICE_ID,
          self.info.illust.R18
        );

        // キャプションを開く
        if (AnkBase.Prefs.get('openCaption', false) && openCaption && openCaption.style.display === 'block') // {{{
          setTimeout(function () openCaption.click(), 1000);
        // }}}

        // イメレスにマーキング
        self.markDownloaded(doc,true);

        return true;
      }; // }}}

      let self = this;

      // install now
      return AnkBase.delayFunctionInstaller(proc, 500, 20, self.SITE_NAME, '');
    }, // }}}

    /*
     * リストページのアイテムにダウンロード済みマークなどをつける
     */
    installListPageFunctions: function () { /// {

      let followExpansion = function () {
        var recommend = self.elements.illust.recommendList;
        var feed = self.elements.illust.feedList;
        var ranking = self.elements.illust.rankingList;

        let elm = recommend || feed || ranking;
        if (!elm) {
          return false;     // リトライしてほしい
        }

        // 伸びるおすすめリストに追随する
        if (MutationObserver) {
          new MutationObserver(function (o) {
            o.forEach(function (e) self.markDownloaded(e.target, true));
          }).observe(elm, {childList: true});
        }

        return true;
      };

      let autoPagerize = function () {
        var aptarget = self.elements.illust.autoPagerizeTarget;

        if (!(doc && aptarget)) {
          return false;     // リトライしてほしい
        }

        // AutoPagerizeによる継ぎ足し動作
        // TODO サイト別.jsに個別に書くのはよくない気がする
        doc.addEventListener(
          'AutoPagerize_DOMNodeInserted',
          function (e) {
            let a = [];
            if (e.target.classList.contains('image-item')) {
              a.push(e.target);
            }
            else {
              [
                '._image-items > li',              // フォロー新着作品＆○○さんの作品一覧
                '.ranking-items > .ranking-item',  // ランキング
              ] .
                some(function (q) {
                  let n = e.target.querySelectorAll(q);
                  return n && n.length > 0 && !!(a = AnkUtils.A(n));
                });
            }
            if (a && a.length > 0)
              a.forEach(function (node) self.markDownloaded(node, true));
          },
          false
        );

        return true;
      };

      let delayMarking = function () {
        if (typeof doc === 'undefined' || !doc || doc.readyState !== "complete") {
          return false;     // リトライしてほしい
        }

        // プレミアムユーザーでない絵師さんの作品一覧は遅延が発生するのでonFocusによる処理だけではマークがつかない
        self.markDownloaded(doc,true);

        return true;
      };

      let self = this;
      let doc = this.curdoc;

      // install now
      if (AnkBase.Prefs.get('markDownloaded', false)) {
        if (!this.in.illustList && !this.in.bookmarkNew && !this.in.bookmarkAdd) {
          AnkBase.delayFunctionInstaller(followExpansion, 500, 20, self.SITE_NAME, 'followExpansion');
        }
        AnkBase.delayFunctionInstaller(autoPagerize, 500, 20, self.SITE_NAME, 'autoPagerize');
        AnkBase.delayFunctionInstaller(delayMarking, 500, 20, self.SITE_NAME, 'delayMarking');
      }
    },

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */ 
    markDownloaded: function (node, force, ignorePref) { // {{{
      const IsIllust = /&illust_id=(\d+)/;
      const Targets = [
                        ['li > a.work', 1],                       // 作品一覧、ブックマーク
                        ['.rank-detail a._work', 2],              // ホーム（ランキング）
                        ['.ranking-item a._work', 2],             // ランキング
                        ['.worksListOthersImg > ul > li > a', 1], // プロファイル（ブックマーク、イメージレスポンス）
                        ['.worksImageresponseImg > a', 2],        // イラストページ（イメージレスポンス）
                        ['li > a.response-in-work', 1],           // イラストページ（イメージレスポンス）
                        ['.search_a2_result > ul > li > a', 1],   // イメージレスポンス
                        ['.stacc_ref_illust_img > a', 3],         // フィード（お気に入りに追加したイラスト）
                        ['.stacc_ref_user_illust_img > a', 1],    // フィード（お気に入りに追加したユーザ内のイラスト）
                        ['.hotimage > a.work', 1],                // タグページ（週間ベスト）
                        ['.image-item > a:nth-child(1)', 1],      // タグページ（全期間＆新着）
                        ['.sibling-items > .after > a', 1],       // 前の作品
                        ['.sibling-items > .before > a', 1],      // 次の作品
                      ];

      return AnkBase.markDownloaded(IsIllust, Targets, false, this, node, force, ignorePref);
    }, // }}}

    /*
     * 評価する
     */
    rate: function (pt) { // {{{
      function setRating (pt) {
        if (!self.in.medium)
          throw 'not in illust page';
        if (pt < 1 || 10 < pt)
          throw 'out of range';

        let rating = doc.defaultView.wrappedJSObject.pixiv.rating;
        if (typeof rating.rate === 'number') {
          rating.apply.call(rating, pt);
          if (!AnkBase.Prefs.get('downloadWhenRate', false))
            return true;
          let point = AnkBase.Prefs.get('downloadRate', 10);
          if (point <= pt)
            AnkBase.downloadCurrentImage(self, AnkBase.Prefs.get('confirmExistingDownloadWhenAuto'));
        } else {
          return false;
        }
      }

      let self = this;
      let doc = this.curdoc;

      return setRating(pt);
    }, // }}}

  };


  /********************************************************************************
  * ベースとなるインスタンスの生成＋本体へのインストール - ankpixiv.xulにも登録を
  ********************************************************************************/

  AnkBase.addModule(AnkPixivModule);


} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
