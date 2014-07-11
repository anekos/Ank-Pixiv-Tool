
try {

  let AnkModule = function (currentDoc) {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    var self = this;

    self.URL        = 'https://twitter.com/'; // イラストページ以外でボタンを押したときに開くトップページのURL
    self.DOMAIN     = 'twitter.com';          // CSSの適用対象となるドメイン
    self.SERVICE_ID = 'TWT';                  // 履歴DBに登録するサイト識別子
    self.SITE_NAME  = 'Twitter';              // ?site-name?で置換されるサイト名のデフォルト値


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.in = { // {{{
      get site () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/twitter\.com\//) &&
        !self.info.illust.pageUrl.match(/^https?:\/\/pic\.twitter\.com\//), // }}}

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
        get photoFrame ()
          let (e = illust.tweet && illust.tweet.querySelector('.card2 > div > iframe'))
            (e && AnkUtils.trackbackParentNode(e, 2).getAttribute('data-card2-name') === 'photo') ? e : null, 

        get photoImage ()
          let (e = illust.photoFrame)
            e && e.contentDocument.querySelector('.u-block'),

        // 自前画像(twimg)
        get mediaContainer ()
          illust.tweet.querySelector('.cards-media-container'),

        get mediaImage ()
          let (e = illust.mediaContainer)
            e && e.querySelector('div.multi-photo img, a.media img'),

        get mediaSet ()
          let (e = illust.mediaContainer)
            e && e.querySelectorAll('div.multi-photo, a.media'),

        get animatedGif ()
          let (e = illust.tweet)
            e && e.querySelector('.js-media-container > video.animated-gif > source'),

        get animatedGifThumbnail ()
          let (e = illust.tweet)
            e && e.querySelector('.js-media-container > img.animated-gif-thumbnail'),

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

        // require for AnkViewer

        get body ()
          let (e = queryAll('body'))
            e && e.length > 0 && e[0],

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
        get doc () currentDoc ? currentDoc : window.content.document
      };
    })(); // }}}

    self.info = (function () { // {{{
      let illust = {
        get pageUrl ()
          self.elements.doc ? self.elements.doc.location.href : '',

        get id () {
          // twitter自身で保存しているものは画像ファイル名をillust_idにする
          let (v = self.info.path.image.images[0]) {
            if (v && v.match(/^https?:\/\/pbs\.twimg\.com\/media\/([^/]+?)\./))   // 外部連携は扱わない
              return RegExp.$1;
          };

          // twitpic等の外部連携を利用している場合はtweetの短縮URLをillust_idにする
          let e = self.elements.illust.largeLink;
          if (!e)
            return null;

          let (v = e.href) {  // ツイート
            if (v && v.match(/\/([^/]+)(?:\?|$)/))
              return RegExp.$1;
          };

          return null;
        },

        get externalUrl ()
          let (e = self.elements.illust.largeLink)
            e && e.getAttribute('data-expanded-url'),
        
        get dateTime ()
          let (v = self.elements.illust.datetime.title)
            AnkUtils.decodeDateTimeText(v ? v : self.elements.illust.datetime.textContent),

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
          let anchor = AnkUtils.getAnchor(path.image.images[0]);
          let m = anchor.pathname.match(/(\.\w+)(?::large|:orig)?$/);
          return (m && m[1] || '.jpg');
        },

        get mangaIndexPage ()
          null,

        get image () {
          let e = 
            self.in.gallery                           ? self.elements.illust.mediumImage :
            self.elements.illust.photoFrame           ? self.elements.illust.photoImage :
            self.elements.illust.animatedGifThumbnail ? self.elements.illust.animatedGif :
                                                        self.elements.illust.mediaSet;
          ;

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
              if (s.match(/\/proxy\.jpg\?.*?t=((.+?)aHR0.+?)(?:$|&)/)) {
                try {
                  let b64 = RegExp.$1;
                  let hdr = RegExp.$2;

                  let lenb = window.atob(hdr);
                  let len = lenb.charCodeAt(lenb.length-1) * 8;
                  len = parseInt(len/6) + (len % 6 ? 1 : 0);

                  let dat = b64.substr(hdr.length,len);
                  let (pad = 4 - len % 4) {
                    if (pad < 4) {
                      for (let i=0; i<pad; i++)
                        dat += '=';
                    }
                  }

                  AnkUtils.dump('BASE64: \n'+b64+'\n    '+dat);
                  s = window.atob(dat);
                  AnkUtils.dump('DECODED: '+s);
                }
                catch (e) {
                  AnkUtils.dumpError(e);
                  window.alert(AnkBase.Locale('serverError'));
                  return AnkBase.NULL_RET;
                }
              }
              else {
                s = s.replace(/:large/, ':orig');
              }
            }
            m.push(s);
          });
          return { images: m, facing: null, };
        },
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })();// }}}

    Object.defineProperty(this, 'downloadable', { // {{{
      get: function () {
        if (self.in.gallery)
          return true;    // ポップアップしているならどこでもOK
        if (self.in.tweet && self.in.illustTweet)
          return true;    // ツイートページはイラストが存在しているときのみOK
        return false;     // 上記以外はNG
      },
    }); // }}}

  };


  /********************************************************************************
  * メソッド
  ********************************************************************************/

  AnkModule.prototype = {

    /*
     * イラストページにviewerやダウンロードトリガーのインストールを行う
     */
    installMediumPageFunctions: function () { // {{{

      let proc = function (mod) { // {{{
        // インストールに必用な各種要素
        var body = mod.elements.illust.body;
        var medImg = mod.elements.illust.mediumImage;
        var largeLink = mod.elements.illust.largeLink;
        var photoFrame = mod.in.tweet ? mod.elements.illust.photoFrame : null;

        // 完全に読み込まれていないっぽいときは、遅延する
        let cond = photoFrame        ? mod.elements.illust.photoImage :
                                       largeLink;
        if (!(body && medImg && cond)) {
          return false;   // リトライしてほしい
        }

        // 中画像クリック時に保存する
        if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
          medImg.addEventListener(
            'click',
            function () AnkBase.downloadCurrentImageAuto(mod),
            true
          );
        } // }}}

        // 保存済み表示
        AnkBase.insertDownloadedDisplayById(
          mod.elements.illust.downloadedDisplayParent,
          mod.info.illust.id,
          mod.SERVICE_ID,
          mod.info.illust.R18
        );

        return true;
      };

      // install now
      return AnkBase.delayFunctionInstaller(this, proc, 500, 20, '');
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {

      let proc = function (mod) {
        var doc = mod.elements.doc;
        var body = mod.elements.illust.body;

        if (!(body && doc.readyState === 'complete')) {
          return false;   // リトライしてほしい
        }

        // ギャラリーの移動時に保存済み表示を行う
        let tw = mod.elements.doc.querySelector('.Gallery-media');
        if (tw && MutationObserver) {
          new MutationObserver(function () {
            if (!mod.info.illust.id)
              return;
            AnkBase.insertDownloadedDisplayById(
              mod.elements.illust.downloadedDisplayParent,
              mod.info.illust.id,
              mod.SERVICE_ID,
              mod.info.illust.R18
            );
          }).observe(tw, {childList: true, attributes: true});
        }

        return true;
      };

      let followExpansion = function (mod) {
        let newGrid = mod.elements.doc.querySelector('.AppContent-main .GridTimeline-items');
        let grid = mod.elements.doc.querySelector('.stream-media-grid-items');
        let items = mod.elements.doc.querySelector('.stream-items');

        let elm = grid || items || newGrid;
        if (!elm) {
          return false;     // リトライしてほしい
        }

        // 伸びるおすすめリストに追随する
        if (MutationObserver) {
          new MutationObserver(function (o) {
            o.forEach(function (e) mod.markDownloaded(e.target, true));
          }).observe(elm, {childList: true});
        }

        return true;
      };

      let delayMarking = function (mod) {
        var doc = mod.elements.doc;

        if (typeof doc === 'undefined' || !doc || doc.readyState !== "complete") {
          return false;     // リトライしてほしい
        }

        mod.markDownloaded(doc,true);

        return true;
      };

      // install now
      if (AnkBase.Prefs.get('markDownloaded', false)) {
        AnkBase.delayFunctionInstaller(this, proc, 500, 20, 'ls');
        AnkBase.delayFunctionInstaller(this, followExpansion, 500, 20, 'fe');
        AnkBase.delayFunctionInstaller(this, delayMarking, 500, 20, 'dm');
      }
    }, // }}}

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      const IsIllust = /^https?:\/\/(?:pbs\.twimg\.com\/media|t\.co)\/([^/]+?)(?:$|\.)/;
      const Targets = [
                        ['span.media-thumbnail > img', 1],
                        ['div > a.is-preview > div > img', 3],
                        ['span.media-thumbnail .js-tweet-text a.twitter-timeline-link', 10, 'media-thumbnail'],
                        ['.TwitterPhoto a.TwitterPhoto-link > img', 2],
                      ];

      return AnkBase.markDownloaded(IsIllust, Targets, 2, this, node, force, ignorePref);
    }, // }}}

    /*
     * 評価
     */
    rate: function () { // {{{
      return true;
    },

  };


  /********************************************************************************
  * ベースとなるインスタンスの生成＋本体へのインストール - ankpixiv.xulにも登録を
  ********************************************************************************/

  AnkModule.prototype.dup = function () new AnkModule(this.elements.doc);

  AnkBase.addModule(new AnkModule());


} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
