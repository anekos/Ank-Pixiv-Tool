
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
          self.elements.doc.location.href,

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

      let installer = function () {

        function proc () {
          try {
            if (counter-- <= 0) {
              AnkUtils.dump('installation failed: '+mod.SITE_NAME);
              return true;
            }

            try {
              var doc = mod.elements.doc;
              var body = mod.elements.illust.body;
              var wrapper = mod.elements.illust.wrapper;
              var medImg = mod.elements.illust.mediumImage;
              var title = mod.elements.illust.title;
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            }

            if (!(body && wrapper && medImg && title)) {
              AnkUtils.dump('delay installation: '+mod.SITE_NAME+' remains '+counter);
              return false;   // リトライしてほしい
            }

            // TODO '<'、'>'ボタンで隣のイラストに移動した場合、コメントが切り替わるまでタイムラグがあり、切り替わる前にDLしようとすると失敗する

            // '<'、'>'ボタンでの移動で保存済み表示を更新する
            medImg.addEventListener(
              'load',
              function () {
                if (viewer)
                  viewer.reset();

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
              viewer = new AnkViewer(
                mod,
                function () mod.info.path.image
              );
            }

            // 中画像クリック時に保存する
            if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
              medImg.addEventListener(
                'click',
                function () {
                  AnkBase.downloadCurrentImageAuto();
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

            AnkUtils.dump('installed: '+mod.SITE_NAME);
          }
          catch (e) {
            AnkUtils.dumpError(e);
          }
          return true;
        }

        if (!proc())
          timer = setTimeout(installer, interval);
      };

      // closure {{{
      let mod = this;
      let viewer;
      let interval = 500;
      let counter = 20;
      // }}}

      return installer();
    }, // }}}

    /*
     * リストページのアイテムにダウンロード済みマークなどをつける
     */
    installListPageFunctions: function () { /// {

      function installer () {
        function proc () {
          try {
            if (counter-- <= 0) {
              AnkUtils.dump('installation failed: '+mod.SITE_NAME+' list');
              return true;
            }

            try {
              var doc = mod.elements.doc;
              var body = doc.getElementsByTagName('body');
              var gallery = doc.getElementById('media-results');
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            }

            if (!((body && body.length>0) && doc.readyState === 'complete' && gallery)) {
              AnkUtils.dump('delay installation: '+mod.SITE_NAME+' list remains '+counter);
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

            AnkUtils.dump('installed: '+mod.SITE_NAME+' list');
          }
          catch (e) {
            AnkUtils.dumpError(e);
          }
          return true;
        }

        //
        if (!proc())
          setTimeout(installer, interval);
      }

      // closure {{{
      let mod = this;
      let interval = 500;
      let counter = 20;
      // }}}

      return installer();
    }, // }}}

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      function marking () {
        let target = AnkBase.getMarkTarget(mod, node, force, ignorePref);
        if (!target)
          return;

        [
          ['.media-result-item > img', 0],              // 一覧
        ].forEach(function ([selector, nTrackback]) {
          AnkUtils.A(target.node.querySelectorAll(selector)) .
            map(function (img) img.src && let (m = img.src.match(/\/scaled\/landing\/\d+\/([^/]+?)\./)) m && [img, m[1]]) .
            filter(function (m) m) .
            forEach(function ([img, id]) {
              if (!(target.illust_id && target.illust_id != id))
                AnkBase.markBoxNode(AnkUtils.trackbackParentNode(img, nTrackback), id, mod.SERVICE_ID, true);
            });
        });
      }

      // closure {{{
      let mod = this;
      // }}}

      return marking();
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
