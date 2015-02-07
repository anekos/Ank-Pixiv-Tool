
try {

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
      get manga () // {{{
        false, // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/twitpic\.com\/[^/]+$/),
      // }}}

      get myPage ()
        false,  // under construction

      get myIllust ()
        false,  // under construction
    }; // }}}

    self.elements = (function () { // {{{
      function query (q)
        self.elements.doc.querySelector(q)

      function queryAll (q)
        self.elements.doc.querySelectorAll(q)

      let illust =  {

        get largeLink ()
          null,

        get datetime () {
          let e = queryAll('div.media-stat > p');
          return e && e.length >= 2 && e[1];
        },

        get title ()
          self.elements.illust.mediumImage,

        get comment ()
          null,

        get avatar ()
          query('div#infobar-user-avatar > a > img'),

        get userName ()
          query('div#infobar-user-info > h2'),

        get memberLink ()
          query('div#infobar-user-info > h4 > a'),

        get tags ()
          null,

        // require for AnkBase

        get downloadedDisplayParent ()
          query('#infobar-right'),

        // require for AnkViewer

        get body () {
          let e = queryAll('body');
          return e && e.length > 0 && e[0];
        },

        get wrapper ()
          query('#content'),

        get mediumImage ()
          query('div#media > img'),

        get ads () {
          let header = query('#infobar-wrap');

          return ([]).concat(header);
        },
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
        get doc () self.curdoc
      };
    })(); // }}}

    self.info = (function () { // {{{
      let illust = {
        get pageUrl ()
          self.elements.doc.location.href,

        get id ()
          self.getIllustId(),

        get dateTime () {
          let e = self.elements.illust.datetime;
           return e && AnkUtils.decodeDateTimeText(e.textContent);
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
          self.info.path.image.images[0].match(/^https?:\/\/([^\/\.]+)\./i)[1],

        get referer ()
          self.info.illust.pageUrl,

        get title ()
          AnkUtils.trim(self.elements.illust.title.alt),

        get comment ()
          illust.title,

        get R18 ()
          false,

        get mangaPages ()
          1,

        get worksData ()
          null,
      };

      let member = {
        get id ()
          self.elements.illust.memberLink.href.match(/\/photos\/(.+)(?:\?|$)/)[1],

        get pixivId ()
          member.id,

        get name ()
          AnkUtils.trim(self.elements.illust.userName.textContent),

        get memoizedName ()
          null,
      };

      let path = {
        get initDir ()
          AnkBase.Prefs.get('initialDirectory.'+self.SITE_NAME),

        get ext ()
          AnkUtils.getFileExtension(path.image.images.length > 0 && path.image.images[0]),

        get mangaIndexPage ()
          null,

        get image ()
          self._image,
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

     URL:        'http://twitpic.com/',  // イラストページ以外でボタンを押したときに開くトップページのURL
     DOMAIN:     'twitpic.com',          // CSSの適用対象となるドメイン
     SERVICE_ID: 'TWP',                  // 履歴DBに登録するサイト識別子
     SITE_NAME:  'Twitpic',              // ?site-name?で置換されるサイト名のデフォルト値

     /********************************************************************************
      * 
      ********************************************************************************/

     /**
      * このモジュールの対応サイトかどうか
      */
     isSupported: function (doc) {
       return doc.location.href.match(/^https?:\/\/twitpic\.com\//);
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

       if (!(this.in.illustPage && !this.elements.illust.mediumImage))
         return { illust_id:this.getIllustId(), service_id:this.SERVICE_ID };
     },

     /**
      * イラストID
      */
     getIllustId: function () {
       let m = this.curdoc.location.href.match(/^https?:\/\/twitpic\.com\/([^/]+)(?:\?|$)/);
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
           window.alert(AnkBase.Locale('cannotFindImages'));
           return;
         }

         let context = new AnkContext(self);
         AnkBase.addDownload(context, useDialog, debug);
       }).then(null).catch(function (e) AnkUtils.dumpError(e,true));
     },

     /*
      * ダウンロード済みイラストにマーカーを付ける
      *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
      *    force:    追加済みであっても、強制的にマークする
      */
     markDownloaded: function (node, force, ignorePref) { // {{{
       const IsIllust = /\/([^/]+?)(?:\?|$)/;
       const Targets = [
                         ['div.user-photo-wrap > div > a', 2],             // 一覧
                         ['div#media-full > p > a', 2],                    // 'full'ページ
                       ];

       return AnkBase.markDownloaded(IsIllust, Targets, false, this, node, force, ignorePref);
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

         return setSelectedImage({ images: [self.elements.illust.mediumImage.src], facing: null });
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
        var body = self.elements.illust.body;
        var medImg = self.elements.illust.mediumImage;

        // 完全に読み込まれていないっぽいときは、遅延する
        if (!(body && medImg)) { // {{{
          return false;   // リトライしてほしい
        } // }}}

        let addMiddleClickEventListener = function () {
          if (useViewer)
            self.viewer = new AnkViewer(self);

          let useCapture = useViewer;

          medImg.addEventListener(
            'click',
            function (e) {
              Task.spawn(function () {
                // mangaIndexPageへのアクセスが複数回実行されないように、getImageUrlAsync()を一度実行してからopenViewer()とdownloadCurrentImageAuto()を順次実行する
                let image = yield self.getImageUrlAsync();
                if (!image || image.images.length == 0) {
                  window.alert(AnkBase.Locale('cannotFindImages'));
                  return;
                }

                self._image = image;

                if (useViewer)
                  self.viewer.openViewer();
                if (useClickDownload)
                  AnkBase.downloadCurrentImageAuto(self);
              }).then(null).catch(function (e) AnkUtils.dumpError(e,true));

              if (useCapture) {
                e.preventDefault();
                e.stopPropagation();
              }
            },
            useCapture
          );
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

      let self = this;
      let doc = this.curdoc;

      return AnkBase.delayFunctionInstaller(proc, 1000, 20, self.SITE_NAME, '');  // おそい:interval=1000
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {

      let delayMarking = function () {
        var doc = self.elements.doc;
        var body = doc.getElementsByTagName('body');

        if (!((body && body.length>0) && doc.readyState === 'complete')) {
          return false;   // リトライしてほしい
        }

        // リスト表示が遅くてダウンロードマーク表示が漏れることがあるので、再度処理を実行
        self.markDownloaded(doc,true);

        return true;
      };

      let self = this;
      let doc = this.curdoc;

      return AnkBase.delayFunctionInstaller(delayMarking, 1000, 40, self.SITE_NAME, 'delayMarking');  // さらにおそい:interval=1000,retry=40
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
