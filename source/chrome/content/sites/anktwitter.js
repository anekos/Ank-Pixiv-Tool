
try {

  let self = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    URL:        'https://twitter.com/', // イラストページ以外でボタンを押したときに開くトップページのURL
    DOMAIN:     'twitter.com',          // CSSの適用対象となるドメイン
    SERVICE_ID: 'TWT',                  // 履歴DBに登録するサイト識別子
    SITE_NAME:  'Twitter',              // ?site-name?で置換されるサイト名のデフォルト値


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    in: { // {{{
      get site () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/twitter\.com\//), // }}}

      get manga () // {{{
        false, // }}} // under construction

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        self.in.tweet ||         // ツイート
        self.in.gallery ||       // ポップアップ中
        self.in.illustGrid,      // '画像/動画'ページ
      // }}}

      get myPage ()
        false,  // under construction

      get myIllust ()
        false,  // under construction

      /*
       * 以下はモジュールローカル部品
       */

      get tweet () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/twitter\.com\/[^/]+\/status\//), // }}}

      // elementを見ているが、これに関しては問題ないはず
      get illustTweet() // {{{
        (self.elements.illust.mediumImage || self.elements.illust.photoFrame), // }}}

      // elementを見ているが、これに関しては問題ないはず
      get gallery () // {{{
        self.elements.illust.galleryEnabled, // }}}

      get illustGrid () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/twitter\.com\/[^/]+\/media\/grid/),
    }, // }}}

    elements: (function () { // {{{
      function query (q)
        self.elements.doc.querySelector(q);

      function queryEither (gQuery, tQuery)
        self.in.gallery ? illust.gallery.querySelector(gQuery) :
                          (illust.tweet && illust.tweet.querySelector(tQuery));

      let illust =  {
        get mediumImage ()
          queryEither('img.media-image', '.media-thumbnail > img'),

        get photoFrame ()
          let (e = self.elements.illust.tweet.querySelector('.card2 > div > iframe'))
            (e && AnkUtils.trackbackParentNode(e, 2).getAttribute('data-card2-name') === 'photo') ? e : null, 

        get photoImage ()
          illust.photoFrame && illust.photoFrame.contentDocument.querySelector('.u-block'),

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
          query('.gallery-container'),

        get galleryEnabled ()
          query('.gallery-enabled'),

        // elements.illust中ではdownloadedDisplayParentのみankpixiv.jsから呼ばれるので必須、他はこのソース内でしか使わない

        get downloadedDisplayParent ()
          queryEither('.stream-item-header', '.tweet-actions'),
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
        get id () {
          let v = self.elements.illust.largeLink.getAttribute('data-url');  // pic.twitter
          if (v && v.match(/^https?:\/\/pbs\.twimg\.com\/media\/([^/]+?)\./))
            return RegExp.$1;

          v = self.elements.illust.largeLink.href;  // ツイート
          if (v && v.match(/\/([^/]+)$/))
            return RegExp.$1;

          return null;
        },  // いずれも 'http://t.co/'+id で作品のページに飛べる

        get dateTime () {
          let dtext  = self.elements.illust.datetime.title;
          let m = dtext.match(/(\d+).+?(\d+).+?(\d+).+?(\d+):(\d+)/);
          let dd = new Date();
          if (m) {
            dd.setFullYear(parseInt(m[1]));
            dd.setMonth(parseInt(m[2])-1);
            dd.setDate(parseInt(m[3]));
            dd.setHours(parseInt(m[4]));
            dd.setMinutes(parseInt(m[5]));
          } else {
            AnkUtils.dump(self.SERVICE_ID+': unknown datetime format = '+dtext);
          }

          return {
            year: AnkUtils.zeroPad(dd.getFullYear(), 4),
            month: AnkUtils.zeroPad(dd.getMonth()+1, 2),
            day: AnkUtils.zeroPad(dd.getDate(), 2),
            hour: AnkUtils.zeroPad(dd.getHours(), 2),
            minute: AnkUtils.zeroPad(dd.getMinutes(), 2),
          };
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
          AnkBase.currentLocation,

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

      'year month day hour minute'.split(/\s+/).forEach(function (name) {
        illust.__defineGetter__(name, function () illust.dateTime[name]);
      });

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

        get ext () 
         (path.image.images[0].match(/(\.\w+)(?::large|\?)/)[1] || '.jpg'),

        get mangaIndexPage ()
          null,

        get image () {
          let m = [
            self.in.gallery                 ? self.elements.illust.mediumImage.src :
            self.elements.illust.photoFrame ? self.elements.illust.photoImage.src :
                                              self.elements.illust.mediumImage.parentNode.getAttribute('data-url')
          ];
          return { images: m, facing: null, };
        },
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })(), // }}}

    get downloadable () { // {{{
      if (self.in.gallery)
        return true;    // ポップアップしているならどこでもOK
      if (self.in.tweet && self.in.illustTweet)
        return true;    // ツイートページはイラストが存在しているときのみOK
      return false;     // 上記以外はNG
    }, // }}}

    /********************************************************************************
    * ダウンロード＆ファイル関連
    ********************************************************************************/

    // ボタン押下でのダウンロードまでの実装であれば、以下の３つのメソッドは空のメソッドのままでＯＫ

    /*
     * 遅延インストールのためにクロージャに doc などを保存しておく
     */
    installMediumPageFunctions: function () { // {{{
      function delay (msg, e) { // {{{
        if (installTryed == 10) {
          AnkUtils.dump(msg);
          if (e)
            AnkUtils.dumpError(e, AnkBase.Prefs.get('showErrorDialog'));
        }
        if (installTryed >= 20)
          return;
        setTimeout(installer, installInterval);
        installTryed++;
        AnkUtils.dump('tried: ' + installTryed);
      } // }}}

      // closure {{{
      let installInterval = 500;
      let installTryed = 0;
      let doc = self.elements.doc;
      // }}}

      let installer = function () { // {{{
        try {
          // インストールに必用な各種要素
          try { // {{{
            var body = doc.getElementsByTagName('body')[0];
            var gallery = self.elements.illust.gallery;
            var tweet = self.elements.illust.tweet;
            var largeLink = self.elements.illust.largeLink;
            var photoFrame = self.in.tweet ? self.elements.illust.photoFrame : null;
          } catch (e) {
            return delay("delay installation by error", e);
          } // }}}

          // 完全に読み込まれていないっぽいときは、遅延する
          let cond = self.in.illustGrid ? true :
                     photoFrame         ? self.elements.illust.photoImage :
                                          largeLink;
          if (!(body && cond))
            return delay("delay installation by null");

          // viewerは作らない

          // 保存済み表示
          if (!self.in.illustGrid && AnkBase.isDownloaded(self.info.illust.id,self.SERVICE_ID)) { // {{{
            AnkBase.insertDownloadedDisplay(
                self.elements.illust.downloadedDisplayParent,
                self.info.illust.R18
            );
          }

          // ギャラリー移動にあわせて保存済み表示 - under construction

          AnkUtils.dump('installed: '+self.SITE_NAME);

        } catch (e) {
          AnkUtils.dumpError(e);
        }
      }; // }}}

      return installer();
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {
      // 実装しない（外部の画像サービスを使っていると、DOMの情報とillust_idを関連付けしづらいため）
      AnkUtils.dump('installed: '+self.SITE_NAME+' list');
    }, // }}}

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      // 実装しない（同上）
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
