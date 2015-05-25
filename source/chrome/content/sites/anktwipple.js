
Components.utils.import("resource://gre/modules/Task.jsm");

(function (global) {

  let AnkPixivModule = function (doc) {

    var self = this;

    self.curdoc = doc;

    self.viewer;

    self.marked = false;

    self._functionsInstalled = false;

    self._image;

    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.in = { // {{{
      get manga () { // {{{
        return false;
      }, // }}}

      get medium () { // {{{
        return self.in.illustPage;
      }, // }}}

      get illustPage () { // {{{
        return self.info.illust.pageUrl.match(/^https?:\/\/p\.twipple\.jp\//) && !self.info.illust.pageUrl.match(/\/user\//);
      } // }}}
    }; // }}}

    self.elements = (function () { // {{{
      function query (q) {
        return self.elements.doc.querySelector(q);
      }

      function queryAll (q) {
        return self.elements.doc.querySelectorAll(q);
      }

      let illust =  {
        get largeLink () {
          return query('#img_a_origin');
        },

        get datetime () {
          return query('.date');
        },

        get title () {
          return query('#item_tweet');
        },

        get comment () {
          return illust.title;
        },

        get avatar () {
          return query('#comment > a > img');
        },

        get userName () {
          return query('#item_screen_name > a');
        },

        get memberLink () {
          return illust.userName;
        },

        get tags () {
          return null;
        },

        get nextLink() {
          let e = query('a > img#prev_icon');
          return e && e.parentNode;
        },

        get prevLink() {
          let e = query('a > img#next_icon');
          return e && e.parentNode;
        },

        // require for AnkBase

        get downloadedDisplayParent () {
          return query('#comment');
        },

        // require for AnkBase.Viewer

        get body () {
          let e = queryAll('body');
          return e && e.length > 0 && e[0];
        },

        get wrapper () {
          return query('#wrapper');
        },

        get mediumImage () {
          return query('#post_image');
        },

        get imageOverlay () {
          return query('#img_overlay_container');
        },

        get ads () {
          let header = query('#headerArea');
          let topad = query('#page_top_ad');

          return ([]).concat(header, topad);
        }
      };

      return {
        illust: illust,
        get doc () {
          return self.curdoc;
        }
      };
    })(); // }}}

    self.info = (function () { // {{{
      let illust = {
        get pageUrl () {
          return self.elements.doc.location.href;
        },

        get id () {
          return self.getIllustId();
        },


        get dateTime () {
          return AnkUtils.decodeDateTimeText(self.elements.illust.datetime.textContent);
        },

        get size () {
          return null;
        },

        get tags () {
          return [];
        },

        get shortTags () {
          return [];
        },

        get tools () {
          return null;
        },

        get width () {
          return 0;
        },

        get height () {
          return 0;
        },

        get server () {
          return null;
        },

        get referer () {
          return self.elements.illust.largeLink.href;
        },

        get title () {
          return AnkUtils.trim(self.elements.illust.title.textContent);
        },

        get comment () {
          return illust.title;
        },

        get R18 () {
          return false;
        },

        get mangaPages () {
          return 1;
        },

        get worksData () {
          return null;
        }
      };

      let member = {
        get id () {
          return self.elements.illust.memberLink.href.match(/\/user\/(.+)(?:\?|$)/)[1];
        },

        get pixivId () {
          return member.id;
        },

        get name () {
          return AnkUtils.trim(self.elements.illust.userName.textContent).replace(/\u3055\u3093$/, '');   // ○○さん
        },

        get memoizedName () {
          return null;
        }
      };

      let path = {
        get initDir () {
          return AnkBase.Prefs.get('initialDirectory.' + self.SITE_NAME);
        },

        get ext () {
          return AnkUtils.getFileExtension();  // 読み込んでみないとわからないのでとりあえずjpgで
        },

        get mangaIndexPage () {
          return null;
        },

        get image () {
          return self._image;
        }
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })(); // }}}

  };


  /********************************************************************************
  * メソッド
  ********************************************************************************/

  AnkPixivModule.prototype = {

    /********************************************************************************
     * 定数
     ********************************************************************************/

     URL:        'http://twipple.jp/',  // イラストページ以外でボタンを押したときに開くトップページのURL
     DOMAIN:     'twipple.jp',          // CSSの適用対象となるドメイン
     SERVICE_ID: 'TPL',                 // 履歴DBに登録するサイト識別子
     SITE_NAME:  'Twipple',             // ?site-name?で置換されるサイト名のデフォルト値

     /********************************************************************************
      * 
      ********************************************************************************/

     /**
      * このモジュールの対応サイトかどうか
      */
     isSupported: function (doc) {
       return doc.location.href.match(/^https?:\/\/[^/]*twipple\.jp\//);
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
       if (!this._functionsInstalled)
         return false;

       if (this.in.medium)
         return { illust_id:this.getIllustId(), service_id:this.SERVICE_ID };
     },

     /**
      * イラストID
      */
     getIllustId: function () {
       let m = this.curdoc.location.href.match(/p\.twipple\.jp\/([^/]+?)(?:\?|$)/);
       return m && m[1];
     },

     /**
      * ダウンロード実行
      */
     downloadCurrentImage: function (useDialog, debug) {
       let self = this;
       Task.spawn(function () {
         let image = yield self.getImageUrlAsync(AnkBase.Prefs.get('downloadOriginalSize', false));
         if (!image || image.images.length == 0) {
           window.alert(AnkBase.Locale.get('cannotFindImages'));
           return;
         }

         let context = new AnkBase.Context(self);
         let ev = AnkBase.createDownloadEvent(context, useDialog, debug);
         window.dispatchEvent(ev);
       }).then(null).catch(e => AnkUtils.dumpError(e,true));
     },


     /*
      * ダウンロード済みイラストにマーカーを付ける
      *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
      *    force:    追加済みであっても、強制的にマークする
      */
     markDownloaded: function (node, force, ignorePref) { // {{{
       const IsIllust = /\/([^/]+?)(?:\?|$)/;
       const Targets = [
                         ['.simple_list_photo > div > a', 1],             // 一覧
                       ];

       return AnkBase.markDownloaded(IsIllust, Targets, true, this, node, force, ignorePref);
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
     getImageUrlAsync: function (mangaOriginalSizeCheck) {

       let self = this;

       return Task.spawn(function* () {

         // 取得済みならそのまま返す
         if (self._image && self._image.images.length > 0)
           return self._image;

         function setSelectedImage (image) {
           self._image = image;
           return image;
         }

         return setSelectedImage({ images:[self.elements.illust.largeLink.href], facing:null });
       });
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
        // ※ついっぷるはイラストページを開いた後同じページにURLパラメータ付きでリダイレクトしている
        var body = self.elements.illust.body;
        var wrapper = self.elements.illust.wrapper;
        var medImg = self.elements.illust.mediumImage;
        var largeLink = self.elements.illust.largeLink;
        var imgOvr = self.elements.illust.imageOverlay;
        var jq = doc.defaultView.wrappedJSObject.jQuery;

        // 完全に読み込まれていないっぽいときは、遅延する
        if (!(body && wrapper && medImg && imgOvr && jq)) { // {{{
          return false;   // リトライしてほしい
        } // }}}

        let addMiddleClickEventListener = function () {
          if (useViewer)
            self.viewer = new AnkBase.Viewer(self);

          let useCapture = useViewer;

          let listener = function (e) {
            if (e.target.getAttribute('id') != 'img_overlay_container')
              return;

            Task.spawn(function () {
              // mangaIndexPageへのアクセスが複数回実行されないように、getImageUrlAsync()を一度実行してからopenViewer()とdownloadCurrentImageAuto()を順次実行する
              let image = yield self.getImageUrlAsync();
              if (!image || image.images.length == 0) {
                window.alert(AnkBase.Locale.get('cannotFindImages'));
                return;
              }

              self._image = image;

              if (useViewer)
                self.viewer.openViewer();
              if (useClickDownload)
                AnkBase.downloadCurrentImageAuto(self);
            }).then(null).catch(e => AnkUtils.dumpError(e,true));

            //e.preventDefault();
            //e.stopPropagation();
          };

          new MutationObserver(function (o) {
            if (useViewer)
              jq(imgOvr).unbind('click');
            imgOvr.addEventListener('click', listener, false);
          }).observe(imgOvr, {attributes: true});
        };

        // 中画像クリック
        let useViewer = AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+self.SITE_NAME, true);
        let useClickDownload = AnkBase.Prefs.get('downloadWhenClickMiddle', false);
        if (useViewer || useClickDownload)
          addMiddleClickEventListener();

        // 保存済み表示
        AnkBase.insertDownloadedDisplayById(
          self.elements.illust.downloadedDisplayParent,
          self.info.illust.R18,
          self.info.illust.id,
          self.SERVICE_ID
        );

        return true;
      };

      var self = this;
      var doc = this.curdoc;

      // install now
      return AnkBase.delayFunctionInstaller(proc, 500, 20, self.SITE_NAME, '');
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {

      let delayMarking = function () {
        var body = self.elements.illust.body;

        if (!(body && doc.readyState === 'complete')) {
          return false;   // リトライしてほしい
        }

        // リスト表示が遅くてダウンロードマーク表示が漏れることがあるので、再度処理を実行
        self.markDownloaded(doc,true);

        return true;
      };

      var self = this;
      var doc = this.curdoc;

      // install now
      return AnkBase.delayFunctionInstaller(delayMarking, 1000, 20, 'ls');  // おそい:interval=1000
    } // }}}

  };

  // --------
  global["SiteModule"] = AnkPixivModule;

})(this);