
try {

  let AnkPixivModule = function (doc) {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    var self = this;

    self.curdoc = doc;

    self.viewer;

    self.marked = false;

    self._functionsInstalled = false;
    self._contentChangefunctionsInstalled = false;


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.in = { // {{{
      // elementを見ているが、これに関しては問題ないはず
      get manga () // {{{
        !self.in.gallery && // ポップアップは除外
        self.elements.illust.mediaSet && self.info.illust.mangaPages > 1, // }}},

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        self.in.tweet ||         // ツイート
        self.in.gallery,         // ポップアップ中
      // }}}

      get myPage ()
        false,  // under construction

      get myIllust ()
        false,  // under construction

      /*
       * 以下はモジュールローカル部品
       */

      get tweet () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/twitter\.com\/[^/]+\/status\//), // }}}

      // elementを見ているが、これに関しては問題ないはず
      get illustTweet() // {{{
        (self.elements.illust.mediumImage || self.elements.illust.animatedGifThumbnail || self.elements.illust.photoFrame), // }}}

      // elementを見ているが、これに関しては問題ないはず
      get gallery () // {{{
        self.elements.illust.galleryEnabled, // }}}
    }; // }}}

    self.elements = (function () { // {{{
      function query (q)
        self.elements.doc.querySelector(q)

      function queryAll (q)
        self.elements.doc.querySelectorAll(q)

      function queryEither (gQuery, tQuery)
        self.in.gallery ? illust.gallery.querySelector(gQuery) :
                          (illust.tweet && illust.tweet.querySelector(tQuery))

      let illust =  {
        // 外部画像連携
        get photoFrame () {
          let e = illust.tweet && illust.tweet.querySelector('.card2 > div > iframe');
          return (e && AnkUtils.trackbackParentNode(e, 2).getAttribute('data-card2-name') === 'photo') ? e : null; 
        },

        get photoImage () {
          let e = illust.photoFrame;
          return e && e.contentDocument.querySelector('.u-block');
        },

        // 自前画像(twimg)
        get mediaContainer () {
          let e = illust.tweet;
          return e && e.querySelector('.cards-media-container');
        },

        get mediaImage () {
          let e = illust.mediaContainer;
          return e && e.querySelector('div.multi-photo img, a.media img');
        },

        get mediaSet () {
          let e = illust.mediaContainer;
          return e && e.querySelectorAll('div.multi-photo, a.media');
        },

        get animatedGif () {
          let e = illust.tweet;
          return e && e.querySelector('.js-media-container > video.animated-gif > source');
        },

        get animatedGifThumbnail () {
          let e = illust.tweet;
          return e && e.querySelector('.js-media-container > img.animated-gif-thumbnail');
        },

        get largeLink ()
          queryEither('.twitter-timeline-link', '.twitter-timeline-link'),

        get datetime ()
          queryEither('.tweet-timestamp', 'span.metadata > span'),

        get title ()
          queryEither('.tweet-text', '.tweet-text'),

        get comment ()
          illust.title,

        get avatar ()
          queryEither('.avatar', '.avatar'),

        get userName ()
          queryEither('.simple-tweet', '.user-actions'),

        get memberLink ()
          queryEither('.account-group', '.account-group'),

        get tags ()
          null,

        get tweet ()
          query('.permalink-tweet'),

        get gallery ()
          query('.Gallery-content'),        // 画像ポップアップ

        get galleryEnabled ()
          query('.gallery-enabled'),

        // require for AnkBase

        get downloadedDisplayParent ()
          queryEither('.stream-item-header', '.tweet-actions'),

        get downloadedFilenameArea ()
          query('.ank-pixiv-downloaded-filename-text'),

        // require for AnkViewer

        get body () {
          let e = queryAll('body');
          return e && e.length > 0 && e[0];
        },

        get mediumImage ()
          self.in.gallery ? illust.gallery.querySelector('img.media-image') :
                            illust.tweet && (illust.mediaImage || illust.animatedGifThumbnail || illust.photoImage),
      };

      let mypage = {
        get fantasyDisplay ()
          null, // under construction

        get fantasyDisplayNext ()
          null, // under construction
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
          self.getIllustId(),

        get externalUrl () {
          let e = self.elements.illust.largeLink;
          return e && e.getAttribute('data-expanded-url');
        },
        
        get dateTime () {
          let v = self.elements.illust.datetime.title;
          return AnkUtils.decodeDateTimeText(v ? v : self.elements.illust.datetime.textContent);
        },

        get size ()
          null,

        get tags ()
          [],

        get shortTags ()
          [],

        get tools ()
          null,

        get width ()
          0,

        get height ()
          0,

        get server ()
          null,

        get referer ()
          self.info.illust.pageUrl,

        get title ()
          AnkUtils.trim(self.elements.illust.title.textContent),

        get comment ()
          illust.title,

        get R18 ()
          false,

        get mangaPages ()
          self.info.path.image.images.length,

        get worksData ()
          null,
      };

      let member = {
        get id ()
          self.elements.illust.userName.getAttribute('data-user-id'),

        get pixivId ()
          self.elements.illust.userName.getAttribute('data-screen-name'),

        get name ()
          self.elements.illust.userName.getAttribute('data-name'),

        get memoizedName ()
          AnkBase.memoizedName(member.id, self.SERVICE_ID),
      };

      let path = {
        get initDir ()
          AnkBase.Prefs.get('initialDirectory.'+self.SITE_NAME),

        get ext () {
          if (path.image.images.length > 0) {
            let anchor = AnkUtils.getAnchor(path.image.images[0]);
            if (anchor)
              return AnkUtils.getFileExtension(anchor.pathname.match(/(\.\w+)(?::large|:orig)?$/) && RegExp.$1);
          }
        },

        get mangaIndexPage ()
          null,

        get image ()
          self.getImageUrlSync(),
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })();// }}}

  };


  AnkPixivModule.prototype = {

    /********************************************************************************
     * 定数
     ********************************************************************************/

    URL:        'https://twitter.com/', // イラストページ以外でボタンを押したときに開くトップページのURL
    DOMAIN:     'twitter.com',          // CSSの適用対象となるドメイン
    SERVICE_ID: 'TWT',                  // 履歴DBに登録するサイト識別子
    SITE_NAME:  'Twitter',              // ?site-name?で置換されるサイト名のデフォルト値

    /********************************************************************************
     * 
     ********************************************************************************/

    /**
     * このモジュールの対応サイトかどうか
     */
    isSupported: function (doc) {
      return doc.location.href.match(/^https?:\/\/twitter\.com\//) &&
            !doc.location.href.match(/^https?:\/\/pic\.twitter\.com\//);
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

      // TODO 試験実装
      if (!this._contentChangefunctionsInstalled) {

        this._contentChangefunctionsInstalled = true;

        function contentChange () {
          var content = doc.querySelector('.route-profile');

          if (!(content && doc.readyState === 'complete')) {
            return false;   // リトライしてほしい
          }

          new MutationObserver(function () {
            AnkUtils.dump('rise contentChange: '+self.curdoc.location.href);
            self._functionsInstalled = false;
            self.initFunctions();
          }).observe(content, {attributes: true});
          return true;
        }

        let self = this;
        let doc = this.curdoc;

        AnkBase.delayFunctionInstaller(contentChange, 1000, 30, self.SITE_NAME, 'contentChange');
      }
    },

    /**
     * ダウンロード可能か
     */
    isDownloadable: function () {
      if (this.in.gallery)
        return !!this.getIllustId();    // ポップアップしているならどこでもOK
      if (this.in.tweet && this.in.illustTweet)
        return !!this.getIllustId();    // ツイートページはイラストが存在しているときのみOK
      return false;     // 上記以外はNG
    },

    /**
     * イラストID
     */
    getIllustId: function () {
      // twitter自身で保存しているものは画像ファイル名をillust_idにする
      if (!this.info.path.image || this.info.path.image.images.length == 0)
        return null;

      let v = this.info.path.image.images[0];
      if (v) {
        let m = v && v.match(/^https?:\/\/pbs\.twimg\.com\/media\/([^/]+?)\./);   // 外部連携は扱わない
        return m && m[1];
      }

      // twitpic等の外部連携を利用している場合はtweetの短縮URLをillust_idにする
      let e = this.elements.illust.largeLink;
      if (!e)
        return null;

      v = e.href;  // ツイート
      if (v) {
        let m = v && v.match(/\/([^/]+)(?:\?|$)/);
        return m && m[1];
      };

      return null;
    },

    /**
     * ダウンロード実行
     */
    downloadCurrentImage: function (useDialog, debug) {
      let self = this;
      Task.spawn(function () {
        let image = self.getImageUrlSync();
        if (!image || image.images.length == 0) {
          window.alert(AnkBase.Locale('cannotFindImages'));
          return;
        }

        let context = new AnkContext(self);
        AnkBase.addDownload(context, useDialog, debug);
      }).then(null, function (e) AnkUtils.dumpError(e,true)).catch(function (e) AnkUtils.dumpError(e,true));
    },

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      const IsIllust = /^https?:\/\/(?:pbs\.twimg\.com\/media|t\.co)\/([^/]+?)(?:$|\.)/;
      const Targets = [
                        ['span.media-thumbnail > img', 1],  // thumbnail
                        ['div.cards-multimedia > a.media-thumbnail > div > img', 3],  // photo (list/tweet)
                        ['.original-tweet div.cards-multimedia > div.multi-photos > div.photo-1 > img', 3],  // multi-photo (list)
                        ['.js-original-tweet div.cards-multimedia > div.multi-photos > div.photo-1 > img', 3],  // multi-photo (tweet)
                        ['.TwitterPhoto a.TwitterPhoto-link > img', 2], // photo (media)
                        ['.TwitterMultiPhoto div.TwitterMultiPhoto-image--1 > img', 2], // multi-photo (media)
                      ];

      return AnkBase.markDownloaded(IsIllust, Targets, 2, this, node, force, ignorePref);
    }, // }}}

    /*
     * 評価
     */
    setRating: function () { // {{{
      return true;
    },

    /********************************************************************************
     * 
     ********************************************************************************/

    /**
     * 画像URLリストの取得
     */
    getImageUrl: function () {
      let self = this;
      Task.spawn(function* () {
        return self.getImageUrlSync();
      });
    },

    getImageUrlSync: function () {
      let self = this;
      let e = 
        self.in.gallery                           ? self.elements.illust.mediumImage :
        self.elements.illust.photoFrame           ? self.elements.illust.photoImage :
        self.elements.illust.animatedGifThumbnail ? self.elements.illust.animatedGif :
                                                    self.elements.illust.mediaSet;
      ;
      if (!e)
        return null;

      let o = [];
      if (e instanceof NodeList) {
        // multi photo
        AnkUtils.A(e).forEach(function (s) {
          o.push(s.getAttribute('data-url'));
        });
      }
      else {
        // photo or animatedGif
        o.push(self.elements.illust.animatedGifThumbnail ? e.getAttribute('video-src') : e.src);
      }

      let m = [];
      o.forEach(function (s) {
        if (AnkBase.Prefs.get('downloadOriginalSize', false)) {
          let m = s.match(/\/proxy\.jpg\?.*?t=(.+?)(?:$|&)/);
          if (m) {
            try {
              let b64 = m[1];
              let b64dec = window.atob(b64.replace(/-/g,'+').replace(/_/g,'/'));
              let index = b64dec.indexOf('http');
              let lenb = b64dec.substr(0, index);
              let len = lenb.charCodeAt(lenb.length-1);
              s = b64dec.substr(index, len);

              AnkUtils.dump('BASE64: '+b64);
              AnkUtils.dump('DECODED: '+s);
            }
            catch (e) {
              AnkUtils.dumpError(e);
              window.alert(AnkBase.Locale('serverError'));
              return AnkBase.NULL_RET;
            }
          }
          else {
            s = s.replace(/:large/, '');
            if (/^https?:\/\/pbs\.twimg\.com\/media\//.test(s)) {
              if (!/\.\w+(:\w+)$/.test(s)) {
                s += ':orig';
              }
            }
          }
        }
        m.push(s);
      });
      return { images: m, facing: null, };
    },

    /********************************************************************************
     * 
     ********************************************************************************/

    /*
     * イラストページにviewerやダウンロードトリガーのインストールを行う
     */
    installMediumPageFunctions: function () { // {{{

      let proc = function () { // {{{
        // インストールに必用な各種要素
        var body = self.elements.illust.body;
        var medImg = self.elements.illust.mediumImage;
        var largeLink = self.elements.illust.largeLink;
        var photoFrame = self.in.tweet ? self.elements.illust.photoFrame : null;

        // 完全に読み込まれていないっぽいときは、遅延する
        let cond = photoFrame        ? self.elements.illust.photoImage :
                                       largeLink;
        if (!(body && medImg && cond)) {
          return false;   // リトライしてほしい
        }

        function createDebugMessageArea() {
          let e = doc.querySelector('.client-and-actions');
          if (e) {
            {
              let div = doc.createElement('div');
              div.classList.add('ank-pixiv-downloaded-filename');
              let dcaption = doc.createElement('div');
              dcaption.classList.add('ank-pixiv-downloaded-filename-text');
              div.appendChild(dcaption);
            }
  
            e.appendChild(div);
          }
        }

        function addMiddleClickEventListener () {
          medImg.addEventListener(
            'click',
            function (e) AnkBase.downloadCurrentImageAuto(self),
            true
          );
        }

        // デバッグ用
        if (AnkBase.Prefs.get('showDownloadedFilename', false))
          createDebugMessageArea();

        // 中画像クリック時に保存する
        if (AnkBase.Prefs.get('downloadWhenClickMiddle'))
          addMiddleClickEventListener()

        // 保存済み表示
        AnkBase.insertDownloadedDisplayById(
          self.elements.illust.downloadedDisplayParent,
          self.info.illust.R18,
          self.info.illust.id,
          self.SERVICE_ID
        );

        return true;
      };

      let self = this;
      let doc = this.curdoc;

      // install now
      return AnkBase.delayFunctionInstaller(proc, 500, 20, self.SITE_NAME, '');
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {

      let moveGallery = function () {
        var body = self.elements.illust.body;

        if (!(body && doc.readyState === 'complete')) {
          return false;   // リトライしてほしい
        }

        // FIXME 移動後に、移動前のギャラリーの処理結果で表示が上書きされてしまう
        // ギャラリーの移動時に保存済み表示を行う
        let tw = self.elements.doc.querySelector('.Gallery-media');
        if (tw && MutationObserver) {
          new MutationObserver(function () {
            if (!self.info.illust.id)
              return;
            AnkBase.insertDownloadedDisplayById(
              self.elements.illust.downloadedDisplayParent,
              self.info.illust.R18,
              self.info.illust.id,
              self.SERVICE_ID
            );
          }).observe(tw, {childList: true, attributes: true});
        }

        return true;
      };

      let followExpansion = function () {
        let newGrid = self.elements.doc.querySelector('.AppContent-main .GridTimeline-items');
        let grid = self.elements.doc.querySelector('.stream-media-grid-items');
        let items = self.elements.doc.querySelector('.stream-items');

        let elm = grid || items || newGrid;
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

      let delayMarking = function () {
        if (typeof doc === 'undefined' || !doc || doc.readyState !== "complete") {
          return false;     // リトライしてほしい
        }

        self.markDownloaded(doc,true);

        return true;
      };

      let self = this;
      let doc = this.curdoc;

      // install now
      if (AnkBase.Prefs.get('markDownloaded', false)) {
        AnkBase.delayFunctionInstaller(moveGallery, 1000, 30, self.SITE_NAME, 'moveGallery');
        AnkBase.delayFunctionInstaller(followExpansion, 1000, 30, self.SITE_NAME, 'followExpansion');
        AnkBase.delayFunctionInstaller(delayMarking, 1000, 30, self.SITE_NAME, 'delayMarking');
      }
    }, // }}}

  };


  /********************************************************************************
  * 本体へのインストール - ankpixiv.xulにも登録を
  ********************************************************************************/

  AnkBase.addModule(AnkPixivModule);


} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
