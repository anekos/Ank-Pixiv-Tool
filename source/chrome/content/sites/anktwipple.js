
try {

  let self = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    URL:        'http://twipple.jp/',    // イラストページ以外でボタンを押したときに開くトップページのURL
    DOMAIN:     'twipple.jp',            // CSSの適用対象となるドメイン
    SERVICE_ID: 'TPL',                  // 履歴DBに登録するサイト識別子
    SITE_NAME:  'Twipple',              // ?site-name?で置換されるサイト名のデフォルト値


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    in: { // {{{
      get site () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/[^/]*twipple\.jp\//), // }}}

      get manga () // {{{
        false, // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/p\.twipple\.jp\//) &&
        !AnkBase.currentLocation.match(/\/user\//),
      // }}}

      get myPage ()
        false,  // under construction

      get myIllust ()
        false,  // under construction
    }, // }}}

    elements: (function () { // {{{
      function query (q)
        self.elements.doc.querySelector(q);

      let illust =  {
        get mediumImage ()
          query('#post_image'),

        get largeLink ()
          query('#img_a_origin'),

        get datetime ()
          query('.date'),

        get title ()
          query('#item_tweet'),

        get comment ()
          illust.title,

        get avatar ()
          query('#comment > a > img'),

        get userName ()
          query('#item_screen_name > a'),

        get memberLink ()
          illust.userName,

        get tags ()
          null,

        // elements.illust中ではdownloadedDisplayParentのみankpixiv.jsから呼ばれるので必須、他はこのソース内でしか使わない

        get downloadedDisplayParent ()
          query('#comment'),

        get ads () {
          let header = query('#headerArea');
          let topad = query('#page_top_ad');

          return ([]).concat(header, topad);
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
          AnkBase.currentLocation.match(/p\.twipple\.jp\/([^/]+?)(?:\?|$)/)[1],

        get dateTime ()
          AnkUtils.decodeDateTimeText(self.elements.illust.datetime.textContent),

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

        get mangaPages ()
          1,

        get worksData ()
          null,
      };

      let member = {
        get id ()
          self.elements.illust.memberLink.href.match(/\/user\/(.+)(?:\?|$)/)[1],

        get pixivId ()
          member.id,

        get name ()
          AnkUtils.trim(self.elements.illust.userName.textContent).replace(/\u3055\u3093$/,''),   // ○○さん

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
          return { images: [self.elements.illust.largeLink.href], facing: null, };
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

      let installer = function () { // {{{
        function proc () {
          try {
            if (counter-- <= 0) {
              AnkUtils.dump('installation failed: '+self.SITE_NAME);
              return true;
            }

            // インストールに必用な各種要素
            // ※ついっぷるはイラストページを開いた後同じページにURLパラメータ付きでリダイレクトしている
            try { // {{{
              var body = doc.getElementsByTagName('body');
              var largeLink = self.elements.illust.largeLink;
              var medImg = self.elements.illust.mediumImage;
              var container = doc.getElementById('img_overlay_container');
              var wrapper = doc.getElementById('wrapper');
              var jq = doc.defaultView.wrappedJSObject.jQuery;
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            } // }}}

            // 完全に読み込まれていないっぽいときは、遅延する
            if (!((body && body.length>0) && largeLink && medImg && wrapper && jq)) { // {{{
              AnkUtils.dump('delay installation: '+self.SITE_NAME+' remains '+counter);
              return false;   // リトライしてほしい
            } // }}}

            // viewerは作らない

            // 中画像クリック時に保存する
            if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
              ['#img_overlay_container', '#post_image'].forEach(function (v) {
                let e = self.elements.doc.querySelector(v);
                if (e) {
                  e.addEventListener(
                    'click',
                    function (e) {
                      AnkBase.downloadCurrentImageAuto();
                    },
                    true
                  );
                }
              });
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
        } // }}}

        //
        if (!proc())
          setTimeout(installer, interval);
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
      let counter = 20;
      let interval = 500;
      // }}}

      return installer();
      AnkUtils.dump('installed: '+self.SITE_NAME+' list');
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
        ['.simple_list_photo > div > a', 1],             // 一覧
      ].forEach(function ([selector, nTrackback]) {
        AnkUtils.A(target.node.querySelectorAll(selector)) .
          map(function (link) link.href && let (m = link.href.split(/\//)) m.length >= 2 && [link, m.pop()]) .
          filter(function (m) m) .
          forEach(function ([link, id]) {
            if (!(target.illust_id && target.illust_id != id))
              AnkBase.markBoxNode(AnkUtils.trackbackParentNode(link, nTrackback), id, self.SERVICE_ID, true);
          });
      });
    }, // }}}


    /********************************************************************************
    * その他
    ********************************************************************************/

    rate: function (pt) { // {{{
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
