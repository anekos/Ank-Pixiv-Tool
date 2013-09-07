
try {

  let self = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    URL:        'http://img.ly/', // イラストページ以外でボタンを押したときに開くトップページのURL
    DOMAIN:     'img.ly',         // CSSの適用対象となるドメイン
    SERVICE_ID: 'IMG',            // 履歴DBに登録するサイト識別子
    SITE_NAME:  'Imgly',          // ?site-name?で置換されるサイト名のデフォルト値


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    in: { // {{{
      get site () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/img\.ly\//), // }}}

      get manga () // {{{
        false, // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/img\.ly\/[^/]+?(?:\?|$)/), // }}}

      get myPage ()
        false,  // under construction

      get myIllust ()
        false,  // under construction
    }, // }}}

    elements: (function () { // {{{
      function query (q)
        self.elements.doc.querySelector(q)

      function queryAll (q)
        self.elements.doc.querySelectorAll(q)

      let illust =  {
        get largeLink ()
          query('#button-fullview > a'),

        get mediumImage ()
          query('#the-image'),

        get date ()
          query('#image-date > strong'),

        get title ()
          query('#image-description'),

        get memberLink ()
          query('.name > a'),

        get wrapper ()
          query('#profile'),

        // elements.illust中ではdownloadedDisplayParentのみankpixiv.jsから呼ばれるので必須、他はこのソース内でしか使わない

        get downloadedDisplayParent ()
          query('#image-box'),

        get ads () {
          let header = query('#header');

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
        get doc () window.content.document
      };
    })(), // }}}

    info: (function () { // {{{
      let illust = {
        get id ()
          AnkBase.currentLocation.match(/img\.ly\/([^/]+?)(?:\?|$)/)[1],

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
          self.elements.illust.largeLink.href,

        get title ()
          AnkUtils.trim(self.elements.illust.title.textContent),

        get comment ()
          illust.title,

        get R18 ()
          false,

      };

      let member = {
        get id ()
          self.elements.illust.memberLink.href.match(/^https?:\/\/img\.ly\/images\/([^/]+?)(?:\?|$)/)[1],

        get pixivId ()
          member.id,

        get name ()
          AnkUtils.trim(self.info.member.id),

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
          return { images: [self.elements.illust.mediumImage.src.replace(/\/large_/,'/original_')], facing: null, };
        },
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })(), // }}}

    get downloadable ()
      true,


    /********************************************************************************
    * ダウンロード＆ファイル関連
    ********************************************************************************/

    // ボタン押下でのダウンロードまでの実装であれば、以下の３つのメソッドは空のメソッドのままでＯＫ

    /*
     * 遅延インストールのためにクロージャに doc などを保存しておく
     */
    installMediumPageFunctions: function () { // {{{

      let installer = function () {

        function proc () {
          try {
            if (counter-- <= 0) {
              AnkUtils.dump('installation failed: '+self.SITE_NAME);
              return true;
            }
  
            try {
              var body = doc.getElementsByTagName('body');
              var wrapper = self.elements.illust.wrapper;
              var medImg = self.elements.illust.mediumImage;
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            }
  
            if (!((body && body.length>0) && wrapper && medImg)) {
              AnkUtils.dump('delay installation: '+self.SITE_NAME+' remains '+counter);
              return false;   // リトライしてほしい
            }
  
            // 大画像関係
            if (AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+self.SITE_NAME, true)) {
              new AnkViewer(
                self,
                body[0],
                wrapper,
                null,
                function () self.info.path.image.images
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
              self.elements.illust.downloadedDisplayParent,
              self.info.illust.id,
              self.SERVICE_ID,
              self.info.illust.R18
            );
  
            AnkUtils.dump('installed: '+self.SITE_NAME);
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
      let doc = self.elements.doc;
      let interval = 500;
      let counter = 20;
      // }}}

      return installer();
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {

      function installer () {
        function proc () {
          try {
            if (counter-- <= 0) {
              AnkUtils.dump('installation failed: '+self.SITE_NAME+' list');
              return true;
            }

            try {
              var body = doc.getElementsByTagName('body');
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            }

            if (!((body && body.length>0) && doc.readyState === 'complete')) {
              AnkUtils.dump('delay installation: '+self.SITE_NAME+' list remains '+counter);
              return false;   // リトライしてほしい
            }

            // リスト表示が遅くてダウンロードマーク表示が漏れることがあるので、再度処理を実行
            self.markDownloaded(doc,true);

            AnkUtils.dump('installed: '+self.SITE_NAME+' list');
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
      let doc = self.elements.doc;
      let interval = 1000;    // おそい
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

      let target = AnkBase.getMarkTarget(self, node, force, ignorePref);
      if (!target)
        return;

      [
        ['li.image-list-item > div+p > a', 2],              // 一覧
      ].forEach(function ([selector, nTrackback]) {
        AnkUtils.A(target.node.querySelectorAll(selector)) .
          map(function (link) link.href && let (m = link.href.match(/img\.ly\/([^/]+?)(?:\?|$)/)) m && [link, m[1]]) .
          filter(function (m) m) .
          forEach(function ([link, id]) {
            if (!(target.illust_id && target.illust_id != id))
              AnkBase.markBoxNode(AnkUtils.trackbackParentNode(link, nTrackback), id, self.SERVICE_ID, false);
          });
      });
    }, // }}}


    /********************************************************************************
    * その他
    ********************************************************************************/

    rate: function () { // {{{
      return true;
    },

  };

  /********************************************************************************
  * インストール - ankpixiv.xulにも登録を
  ********************************************************************************/

  AnkBase.addModule(self);

} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
