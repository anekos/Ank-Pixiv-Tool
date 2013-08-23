
try {

  AnkTwitpic = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    URL:        'http://twitpic.com/',  // イラストページ以外でボタンを押したときに開くトップページのURL
    DOMAIN:     'twitpic.com',          // CSSの適用対象となるドメイン
    SERVICE_ID: 'TWP',                  // 履歴DBに登録するサイト識別子


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    in: { // {{{
      get site () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/twitpic\.com\//), // }}}

      get manga () // {{{
        false, // }}}

      get medium () // {{{
        AnkTwitpic.in.illustPage, // }}}

      get illustPage () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/twitpic\.com\/[^/]+$/) &&
        AnkTwitpic.elements.illust.mediumImage,                               // 動画は保存できない
      // }}}

      get myPage ()
        false,  // under construction

      get myIllust ()
        false,  // under construction
    }, // }}}

    elements: (function () { // {{{
      let illust =  {
        get mediumImage ()
          AnkTwitpic.elements.doc.querySelector('div#media > img'),

        get largeLink ()
          AnkTwitpic.elements.doc.querySelector('div#media-overlay > div > span > a'),

        get datetime ()
          AnkTwitpic.elements.doc.querySelectorAll('div#media-stats > div.media-stat')[1],

        get title ()
          AnkTwitpic.elements.illust.mediumImage,

        get comment ()
          null,

        get avatar ()
          AnkTwitpic.elements.doc.querySelector('div#infobar-user-avatar > a > img'),

        get userName ()
          AnkTwitpic.elements.doc.querySelector('div#infobar-user-info > h2'),

        get memberLink ()
          AnkTwitpic.elements.doc.querySelector('div#infobar-user-info > h4 > a'),

        get tags ()
          null,

        // elements.illust中ではdownloadedDisplayParentのみankpixiv.jsから呼ばれるので必須、他はこのソース内でしか使わない

        get downloadedDisplayParent ()
          AnkTwitpic.elements.doc.querySelector('div#content'),
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
          AnkBase.currentLocation.match(/^https?:\/\/twitpic\.com\/([^/]+)$/)[1],

        get dateTime () {
          let m = AnkTwitpic.elements.illust.datetime.textContent.match(/(an|\d+) (minute|hour|day)/)
          if (!m)
            return null;

          let d = m[1] === 'an' ? 1 : m[1];
          let diff = 60 * 1000 * (
            m[2] === 'day'  ? d*1440 :
            m[2] === 'hour' ? d*60 :
                              d);
          let dd = new Date();
          dd.setTime(dd.getTime() - diff);

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
          AnkTwitpic.info.path.images[0].match(/^https?:\/\/([^\/\.]+)\./i)[1],

        get referer ()
          AnkBase.currentLocation,

        get title ()
          AnkUtils.trim(AnkTwitpic.elements.illust.title.alt),

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
          AnkTwitpic.elements.illust.memberLink.href.match(/\/photos\/(.+)$/)[1],

        get pixivId ()
          member.id,

        get name ()
          AnkUtils.trim(AnkTwitpic.elements.illust.userName.textContent),

        get memoizedName ()
          AnkBase.memoizedName,
      };

      let path = {
        get initDir ()
          AnkBase.Prefs.get('initialDirectory.Twitpic') || AnkBase.Prefs.get('initialDirectory'),

        get ext ()
          (path.images[0].match(/(\.\w+)(?:$|\?)/)[1] || '.jpg'),

        get mangaIndexPage ()
          null,

        get images ()
          // 本当は'full'ページから引かなければいけない？しかしサンプルがみつからず
          [AnkTwitpic.elements.illust.mediumImage.src],
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })(), // }}}


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
      let doc = AnkTwitpic.elements.doc;
      // }}}

      let installer = function () { // {{{
        try {
          // インストールに必用な各種要素
          try { // {{{
            var body = doc.getElementsByTagName('body')[0];
            var largeLink = AnkTwitpic.elements.illust.largeLink;
            var medImg = AnkTwitpic.elements.illust.mediumImage;
          } catch (e) {
            return delay("delay installation by error", e);
          } // }}}

          // 完全に読み込まれていないっぽいときは、遅延する
          if (!(body && largeLink && medImg)) // {{{
            return delay("delay installation by null");
          // }}}

          // viewerは作らない

          // 中画像クリック時("View full size")に保存する
          if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
            largeLink.addEventListener(
              'click',
              function (e) {
                AnkBase.downloadCurrentImageAuto();
              },
              true
            );
          } // }}}

          // 保存済み表示
          if (AnkBase.isDownloaded(AnkTwitpic.info.illust.id,AnkTwitpic.SERVICE_ID)) { // {{{
            AnkBase.insertDownloadedDisplay(
                AnkTwitpic.elements.illust.downloadedDisplayParent,
                AnkTwitpic.info.illust.R18
            );
          }

          AnkUtils.dump('installed: twitpic');

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
    }, // }}}

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      function trackbackParentNode (node, n) {
        for (let i = 0; i< n; i++)
          node = node.parentNode;
        return node;
      }

      if (AnkTwitpic.in.medium || !AnkTwitpic.in.site)
        return;

      if (!AnkBase.Prefs.get('markDownloaded', false) && !ignorePref)
        return;

      if (!force && AnkBase.Store.document.marked)
        return;

      AnkBase.Store.document.marked = true;

      if (!node)
        node = AnkTwitpic.elements.doc;

      [
        ['div.user-photo-wrap > div > a', 2],             // 一覧
        ['div#media-full > p > a', 2],                    // 'full'ページ
      ].forEach(function ([selector, nTrackback]) {
        AnkUtils.A(node.querySelectorAll(selector)) .
          map(function (link) link.href && let (m = link.href.split(/\//)) m.length >= 2 && [link, m.pop()]) .
          filter(function (m) m) .
          forEach(function ([link, id]) {
            if (!AnkBase.isDownloaded(id,AnkTwitpic.SERVICE_ID))
              return;
            let box = trackbackParentNode(link, nTrackback);
            if (box)
              box.className += ' ' + AnkBase.CLASS_NAME.DOWNLOADED;
          });
      });
    }, // }}}

    /*
     * remoteFileExists 用のクッキーをセットする
     */
    setCookies: function () {
      // under construction
    }, // }}}

  };

  /********************************************************************************
  * インストール - ankpixiv.xulにも登録を
  ********************************************************************************/

  AnkBase.MODULES.push(AnkTwitpic);

} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
