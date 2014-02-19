
try {

  let AnkModule = function (currentDoc) {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    var self = this;

    self.URL        = 'https://www.tumblr.com/'; // イラストページ以外でボタンを押したときに開くトップページのURL
    self.DOMAIN     = 'tumblr.com';              // CSSの適用対象となるドメイン
    self.SERVICE_ID = 'TBR';                     // 履歴DBに登録するサイト識別子
    self.SITE_NAME  = 'Tumblr';                  // ?site-name?で置換されるサイト名のデフォルト値

    self.EXPERIMENTAL = true;                    // 試験実装中のモジュール


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.in = { // {{{
      get site () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/[^/]*tumblr\.com\//), // }}}

      get manga () // {{{
        false, // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/[^/]+?\.tumblr\.com\/post\//) &&
        !!self.elements.illust.mediumImage, // }}}

      get myPage ()
        false,  // under construction

      get myIllust ()
        false,  // under construction
    }; // }}}

    self.elements = (function () { // {{{
      function query (q)
        self.elements.doc.querySelector(q);

      function queryAll (q)
        self.elements.doc.querySelectorAll(q);

      // 画像の面積を返す
      // XXX 過度に長細いものなどは、1 とかにするほうがいいかも…
      function getImageSize (e)
        ((e.offsetHeight || 1) * (e.offsetWidth || 1));

      function getLargestImage () {
        let maxSize = 0, maxElement = null;

        for (let root of Array.slice(arguments)) {
          if (!root)
            continue;
          for (let it of root.querySelectorAll('img')) {
            let size = getImageSize(it);
            if (maxSize < size) {
              maxSize = size;
              maxElement = it;
            }
          }
        }

        return maxElement;
      }

      let illust =  {
        get date ()
          query('.date') ||
          query('.postmeta > a') ||
          query('.post-date a'),

        get title ()
          query('.caption > p') ||
          query('.post > p+p') ||
          query('.photo > p+p'),

        get userName ()
          query('.footer-content > h5') ||
          query('#header > h1 > a'),

        get memberLink ()
          let (e = query('#header > * > .profile-image'))
            (e && e.parentNode),

        // require for AnkBase

        get downloadedDisplayParent ()
          query('.caption > p'),

        // require for AnkViewer

        get body ()
          let (e = queryAll('body'))
            e && e.length > 0 && e[0],

        get wrapper ()
          query('.container.section') ||
          query('#newDay') ||
          query('body'),

        get mediumImage ()
          getLargestImage(query('.post'), query('.photo')),

        get ads () {
          let header = query('#header');
          let header2 = query('#fb-root');

          return ([]).concat(header, header2);
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
        get doc () currentDoc ? currentDoc : window.content.document
      };
    })(); // }}}

    self.info = (function () { // {{{
      let illust = {
        get pageUrl ()
          self.elements.doc ? self.elements.doc.location.href : '',

        get id ()
          self.info.illust.pageUrl.match(/\.tumblr\.com\/post\/([^/]+?)(?:\?|\/|$)/)[1],

        get dateTime ()
          AnkUtils.decodeDateTimeText(self.elements.illust.date.textContent),

        get size ()
          null,

        get tags ()
          [],

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
          let (e = self.elements.illust.title)
           e && AnkUtils.trim(e.textContent),

        get comment ()
          illust.title,

        get R18 ()
          !!self.info.illust.pageUrl.match(/\.tumblr\.com\/post\/[^/]+?\/[^/]*r-?18/),

      };

      let member = {
        get id ()
          self.info.illust.pageUrl.match(/^https?:\/\/([^/]+?)\.tumblr\.com\/post\//)[1],

        get pixivId ()
          member.id,

        get name ()
          AnkUtils.trim(self.elements.illust.userName ? self.elements.illust.userName.textContent : self.info.member.id),

        get memoizedName ()
          AnkBase.memoizedName(member.id, self.SERVICE_ID),
      };

      let path = {
        get initDir ()
          AnkBase.Prefs.get('initialDirectory.'+self.SITE_NAME),

        get ext ()
          (self.info.path.image.images[0].match(/(\.\w+)(?:$|\?)/)[1].toLowerCase() || '.jpg'),

        get mangaIndexPage ()
          null,

        get image () {
          return { images: [self.elements.illust.mediumImage.src], facing: null, };
        },
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })(); // }}}

    self.downloadable = true;

  };


  /********************************************************************************
   * メソッド
   ********************************************************************************/

  AnkModule.prototype = {

     /*
      * イラストページにviewerやダウンロードトリガーのインストールを行う
      */
    installMediumPageFunctions: function () { // {{{

      let proc = function (mod) {
        var body = mod.elements.illust.body;
        var wrapper = mod.elements.illust.wrapper;
        var medImg = mod.elements.illust.mediumImage;

        if (!(body && wrapper && medImg)) {
          return false;   // リトライしてほしい
        }

        // 大画像関係
        if (AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+mod.SITE_NAME, true)) {
          new AnkViewer(
            mod,
            function () mod.info.path.image
          );
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
      // under construction
      return AnkBase.delayFunctionInstaller(this, function() true, 500, 20, 'ls');
    }, // }}}

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      const IsIllust = /\.tumblr\.com\/post\/([^/]+?)(?:\?|\/|$)/;
      const Targets = [
                        ['#portfolio  div.item > a', 1],   // 一覧
                      ];

      return AnkBase.markDownloaded(IsIllust, Targets, true, this, node, force, ignorePref);
    }, // }}}

    /*
     * 評価する
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
