
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
          AnkBase.currentLocation.match(/\/([^/]+)$/)[1],

        get dateTime () {
          let dtext  = self.elements.illust.datetime.textContent;
          let m = dtext.match(/(\d+).+?(\d+).+?(\d+).+?(\d+):(\d+):/);
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

      'year month day hour minute'.split(/\s+/).forEach(function (name) {
        illust.__defineGetter__(name, function () illust.dateTime[name]);
      });

      let member = {
        get id ()
          self.elements.illust.memberLink.href.match(/\/user\/(.+)$/)[1],

        get pixivId ()
          member.id,

        get name ()
          AnkUtils.trim(self.elements.illust.userName.textContent).replace(/さん$/,''),

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
            var largeLink = self.elements.illust.largeLink;
            var medImg = self.elements.illust.mediumImage;
          } catch (e) {
            return delay("delay installation by error", e);
          } // }}}

          // 完全に読み込まれていないっぽいときは、遅延する
          if (!(body && largeLink && medImg)) // {{{
            return delay("delay installation by null");
          // }}}

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
          if (AnkBase.isDownloaded(self.info.illust.id,self.SERVICE_ID)) { // {{{
            AnkBase.insertDownloadedDisplay(
                self.elements.illust.downloadedDisplayParent,
                self.info.illust.R18
            );
          }

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
      // under construction
      AnkUtils.dump('installed: '+self.SITE_NAME+' list');
    }, // }}}

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{

      if (self.in.medium || !self.in.site)
        return;

      if (!AnkBase.Prefs.get('markDownloaded', false) && !ignorePref)
        return;

      if (!force && AnkBase.Store.document.marked)
        return;

      AnkBase.Store.document.marked = true;

      if (!node)
        node = self.elements.doc;

      [
        ['.simple_list_photo > div > a', 1],             // 一覧
      ].forEach(function ([selector, nTrackback]) {
        AnkUtils.A(node.querySelectorAll(selector)) .
          map(function (link) link.href && let (m = link.href.split(/\//)) m.length >= 2 && [link, m.pop()]) .
          filter(function (m) m) .
          forEach(function ([link, id]) {
            if (!AnkBase.isDownloaded(id,self.SERVICE_ID))
              return;
            let box = AnkUtils.trackbackParentNode(link, nTrackback);
            if (box)
              box.className += ' ' + AnkBase.CLASS_NAME.DOWNLOADED_OVERLAY;
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
