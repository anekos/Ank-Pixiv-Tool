
Components.utils.import("resource://gre/modules/Task.jsm");

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
        (self.info.illust.mangaPages > 1), // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/www\.tinami\.com\/view\//), // }}}

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
        get images () {
          let e = query('.captify')
          if (e)
            return [e];
          return queryAll('.viewbody > * > img');
        },

        get datetime ()
          query('.view_info'),

        get title ()
          query('.viewdata > h1 > span'),

        get comment ()
          query('.description'),

        get userName ()
          query('.prof > p > a > strong'),

        get memberLink ()
          query('.prof > p > a'),

        get tags ()
          queryAll('.tag > span'),

        get typeImages ()
          queryAll('.viewdata > p > img'),

        get postParams ()
          queryAll('#open_original_content > input'),

        get nextLink()
          query('.mvnext > a'),

        get prevLink()
          query('.mvprev > a'),

        // require for AnkBase

        get downloadedDisplayParent ()
          query('.description'),

        // require for AnkViewer

        get body () {
          let e = queryAll('body');
          if (e)
            return e.length > 0 && e[0];
        },

        get wrapper ()
          query('#container'),

        get mediumImage ()
          illust.images[0],

        get imageOverlay ()
          query('.viewbody'), 

        get largeForm ()
          query('#open_original_content'),

        get openCaption ()
          query('#show_all'),

        get ads () {
          let header = query('#header');
          let controller = query('#controller');

          return ([]).concat(header, controller);
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

        get dateTime ()
          AnkUtils.decodeDateTimeText(self.elements.illust.datetime.textContent),

        get size ()
          null,

        get tags ()
          AnkUtils.A(self.elements.illust.tags).filter(function (e) AnkUtils.trim(e.textContent)),

        get shortTags () {
          let limit = AnkBase.Prefs.get('shortTagsMaxLength', 8);
          return self.info.illust.tags.filter(function (it) (it.length <= limit));
        },

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
          AnkUtils.trim(self.elements.illust.comment.textContent),

        get R18 ()
          false,

        get mangaPages ()
          self.info.path.image.images.length,

      };

      let member = {
        get id ()
          self.elements.illust.memberLink.href.match(/\/profile\/(.+)(?:\?|$)/)[1],

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

     URL:        'http://www.tinami.com/', // イラストページ以外でボタンを押したときに開くトップページのURL
     DOMAIN:     'tinami.com',             // CSSの適用対象となるドメイン
     SERVICE_ID: 'TNM',                    // 履歴DBに登録するサイト識別子
     SITE_NAME:  'Tinami',                 // ?site-name?で置換されるサイト名のデフォルト値

     /********************************************************************************
      * 
      ********************************************************************************/

     /**
      * このモジュールの対応サイトかどうか
      */
     isSupported: function (doc) {
       return doc.location.href.match(/^https?:\/\/[^/]*tinami\.com\//);
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
       let m = this.curdoc.location.href.match(/www\.tinami\.com\/view\/([^/]+?)(?:\?|$)/);
       return m && parseInt(m[1], 10);
     },

     /**
      * ダウンロード実行
      */
     downloadCurrentImage: function (useDialog, debug) {
       let self = this;
       Task.spawn(function () {
         let image = yield self.getImageUrlAsync();
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
                         ['td > p.capt + a', 1],                              // 一覧
                         ['td > .title > .collection_form_checkbox + a', 2],  // コレクション
                         ['.thumbs > li > ul > li > a', 1],                   // 最近の投稿作品
                       ];

       return AnkBase.markDownloaded(IsIllust, Targets, false, this, node, force, ignorePref);
     }, // }}}

     /*
      * 評価する
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
     getImageUrlAsync: function () {

       let self = this;

       return Task.spawn(function* () {

         // 取得済みならそのまま返す
         if (self._image && self._image.images.length > 0)
           return self._image;

         function setSelectedImage (image) {
           self._image = image;
           return image;
         }

         let m = []

         // マンガ
         if (!self.elements.illust.largeForm) {
           m = AnkUtils.A(self.elements.illust.images).map(function (e) e.src);
         }
         else {
           // イラスト
           let params = AnkUtils.A(self.elements.illust.postParams).
                          map(function (e) (e.getAttribute('name')+'='+e.getAttribute('value'))).
                            join('&');
           let html = yield AnkUtils.httpGETAsync(self.info.illust.pageUrl, self.info.illust.pageUrl, params);
           let doc = AnkUtils.createHTMLDocument(html);
           if (!doc)
             return null;

           m = Array.slice(doc.querySelectorAll('img')).
                 filter(function (e) e.src.match(/^https?:\/\/img\.tinami\.com\/illust\d*\/img\//)).
                   map(function (e) e.src);
         }

         return setSelectedImage({ images: m, facing: null });
       });
     },


     /********************************************************************************
      * 
      ********************************************************************************/

    /*
     * イラストページにviewerやダウンロードトリガーのインストールを行う
     */
    installMediumPageFunctions: function () { // {{{

      let proc = function () {
        var body = self.elements.illust.body;
        var wrapper = self.elements.illust.wrapper;
        var medImg = self.elements.illust.mediumImage;
        var openCaption = self.elements.illust.openCaption;
        var images = self.elements.illust.images;
        var imgOvr = self.elements.illust.imageOverlay;

        if (!(body && wrapper && (images && images.length>0) && medImg && imgOvr)) {
          return false;   // リトライしてほしい
        }

        let addMiddleClickEventListener = function () {
          if (useViewer)
            self.viewer = new AnkViewer(self);

          let useCapture = useViewer;

          imgOvr.addEventListener(
            'click',
            function (e) {
              Task.spawn(function () {
                // mangaIndexPageへのアクセスが複数回実行されないように、getImageUrlAsync()を一度実行してからopenViewer()とdownloadCurrentImageAuto()を順次実行する
                let image = yield self.getImageUrlAsync();
                if (!image || image.images.length == 0) {
                  window.alert(AnkBase.Locale('cannotFindImages'));
                  return;
                }

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

        // 続きを表示
        if (AnkBase.Prefs.get('openCaption', false) && openCaption)
          setTimeout(function () openCaption.click(), 1000);

        return true;
      };

      let self = this;
      let doc = this.curdoc;

      // install now
      return AnkBase.delayFunctionInstaller(proc, 500, 40, self.SITE_NAME, '');
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

      let self = this;
      let doc = this.curdoc;

      // install now
      return AnkBase.delayFunctionInstaller(this, proc, 500, 20, self.SITE_NAME, 'delayMarking');
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
