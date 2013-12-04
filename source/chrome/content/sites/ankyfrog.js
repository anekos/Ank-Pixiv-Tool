
try {

  let AnkModule = function (currentDoc) {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    var self = this;

    self.URL        = 'http://twitter.yfrog.com/'; // イラストページ以外でボタンを押したときに開くトップページのURL
    self.DOMAIN     = 'yfrog.com';                 // CSSの適用対象となるドメイン
    self.SERVICE_ID = 'YFR';                       // 履歴DBに登録するサイト識別子
    self.SITE_NAME  = 'Yfrog';                     // ?site-name?で置換されるサイト名のデフォルト値


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.in = { // {{{
      get site () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/twitter\.yfrog\.com\//), // }}}

      get manga () // {{{
        false, // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/twitter\.yfrog\.com\/[^/?]+(?:\?|$)/), // }}}

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
          query('#input-direct'),

        get date ()
          query('.tweet-info > .user > .date'),

        get title ()
          query('#the_tweet'),

        get memberLink ()
          query('.username'),

        // require for AnkBase

        get downloadedDisplayParent ()
          query('.tweet-info'),

        // require for AnkViewer

        get body ()
          let (e = queryAll('body'))
            e && e.length > 0 && e[0],

        get wrapper ()
          query('#body'),

        get mediumImage ()
          query('#main_image'),

        get ads () {
          let header = query('#menu-search-wrapper-big-daddy');

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
        get doc () currentDoc ? currentDoc : window.content.document
      };
    })(); // }}}

    self.info = (function () { // {{{
      let illust = {
        get pageUrl ()
          self.elements.doc ? self.elements.doc.location.href : '',

        get id ()
          let (m = self.elements.illust.mediumImage.src.match(/\/([^/]+?)\.[^/]+$/))
            m && m[1],

        get dateTime ()
          AnkUtils.decodeDateTimeText(self.elements.illust.date.textContent),

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

      };

      let member = {
        get id ()
          let (m = self.elements.illust.memberLink.href.match(/\/user\/([^/]+?)\/profile/))
            m && m[1],

        get pixivId ()
          member.id,

        get name ()
          self.elements.illust.memberLink.getAttribute('data-screen-name'),

        get memoizedName ()
          AnkBase.memoizedName(member.id, self.SERVICE_ID),
      };

      let path = {
        get initDir ()
          AnkBase.Prefs.get('initialDirectory.'+self.SITE_NAME),

        get ext ()
          '.jpg',   // 読み込んでみないとわからないのでとりあえずjpgで

        get mangaIndexPage ()
          null,

        get image () {
          return { images: [self.elements.illust.largeLink.value], facing: null, };
        },
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })(); // }}}

    /*
     * ダウンロード可能状態かどうか
     */
    self.downloadable = true;

  };

  /********************************************************************************
  * メソッド
  ********************************************************************************/

  // ボタン押下でのダウンロードまでの実装であれば、以下のメソッドは空のメソッドのままでＯＫ

  /*
   * イラストページにviewerやダウンロードトリガーのインストールを行う
   */
  AnkModule.prototype = {

    installMediumPageFunctions: function () { // {{{

      let proc = function (mod) {
        var doc = mod.elements.doc;
        var body = mod.elements.illust.body;
        var wrapper = mod.elements.illust.wrapper;
        var medImg = mod.elements.illust.mediumImage;
        var title = mod.elements.illust.title;
        var largeLink = mod.elements.illust.largeLink;

        if (!(body && wrapper && medImg && title && largeLink)) {
          return false;   // リトライしてほしい
        }

        // TODO '<'、'>'ボタンで隣のイラストに移動した場合、コメントが切り替わるまでタイムラグがあり、切り替わる前にDLしようとすると失敗する

        // '<'、'>'ボタンでの移動で保存済み表示を更新する
        medImg.addEventListener(
          'load',
          function () {
            if (mod.__viewer)
              mod.__viewer.reset();

            AnkBase.insertDownloadedDisplayById(
              mod.elements.illust.downloadedDisplayParent,
              mod.info.illust.id,
              mod.SERVICE_ID,
              mod.info.illust.R18
            );
          },
          false
        );

        // 大画像関係
        // FIXME 一度viewerを開くと、'<'、'>'ボタンで隣のイラストに移動した場合、一回目の画像が表示されてしまう
        if (AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+mod.SITE_NAME, true)) {
          mod.__viewer = new AnkViewer(
            mod,
            function () mod.info.path.image
          );
        }

        // 中画像クリック時に保存する
        if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
          medImg.addEventListener(
            'click',
            function () {
              AnkBase.downloadCurrentImageAuto(mod);
            },
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
     * リストページのアイテムにダウンロード済みマークなどをつける
     */
    installListPageFunctions: function () { /// {

      let proc = function (mod) {
        var doc = mod.elements.doc;
        var body = doc.getElementsByTagName('body');
        var gallery = doc.getElementById('media-results');

        if (!((body && body.length>0) && doc.readyState === 'complete' && gallery)) {
          return false;   // リトライしてほしい
        }

        // リスト表示が遅くてダウンロードマーク表示が漏れることがあるので、再度処理を実行
        mod.markDownloaded(mod.elements.doc,true);

        // 伸びるリストに追随する
        if (MutationObserver) {
          new MutationObserver(function (o) {
            o.forEach(function (e) mod.markDownloaded(e.target, true));
          }).observe(gallery, {childList: true});
        }

        return true;
      };


      // install now
      return AnkBase.delayFunctionInstaller(this, proc, 500, 20, 'ls');
    }, // }}}

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      const IsIllust = /\/scaled\/landing\/\d+\/([^/]+?)\./;
      const Targets = [
                        ['.media-result-item > img', 1],              // 一覧
                      ];

      return AnkBase.markDownloaded(IsIllust, Targets, true, this, node, force, ignorePref);
    }, // }}}

    /*
     * 評価
     */
    rate: function () { // {{{
      return true;
    }, // }}}
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
