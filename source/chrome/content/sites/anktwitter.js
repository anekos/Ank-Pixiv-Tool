
try {

  AnkTwitter = {

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
        AnkTwitter.in.illustPage, // }}}

      get illustPage () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/twitter\.com\/[^/]+\/status\/[^/]+\/photo\//),
      // }}}

      get myPage ()
        false,  // under construction

      get myIllust ()
        false,  // under construction
    }, // }}}

    elements: (function () { // {{{
      let illust =  {
        get mediumImage ()
          AnkTwitter.elements.doc.querySelector('div.media > a.media-thumbnail > img'),

        get largeLink ()
          AnkTwitter.elements.doc.querySelector('p.tweet-text > a.twitter-timeline-link'),

        get datetime ()
          AnkTwitter.elements.doc.querySelector('a.tweet-timestamp'),

        get title ()
          AnkTwitter.elements.doc.querySelector('p.tweet-text'),

        get comment ()
          null,

        get avatar ()
          AnkTwitter.elements.doc.querySelector('img.avatar'),

        get userName ()
          AnkTwitter.elements.doc.querySelector('strong.fullname'),

        get memberLink ()
          AnkTwitter.elements.doc.querySelector('a.account-group'),

        get tags ()
          null,

        get notDisplayed()
          AnkTwitter.elements.doc.querySelector('div.media-not-displayed'),

        // elements.illust中ではdownloadedDisplayParentのみankpixiv.jsから呼ばれるので必須、他はこのソース内でしか使わない

        get downloadedDisplayParent ()
          AnkTwitter.elements.doc.querySelector('ul.tweet-actions'),
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
          AnkTwitter.elements.illust.largeLink.href.match(/\/([^/]+)$/)[1],

        get dateTime () {
          let dtext  = AnkTwitter.elements.illust.datetime.title;
          let m = dtext.match(/(\d+).+?(\d+).+?(\d+).+?(\d+):(\d+)/);
          let dd = new Date();
          if (m) {
            dd.setFullYear(parseInt(m[1]));
            dd.setMonth(parseInt(m[2])-1);
            dd.setDate(parseInt(m[3]));
            dd.setHours(parseInt(m[4]));
            dd.setMinutes(parseInt(m[5]));
          } else {
            AnkUtils.dump(AnkTwitpic.SERVICE_ID+': unknown datetime format = '+dtext);
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
          AnkUtils.trim(AnkTwitter.elements.illust.title.textContent),

        get comment ()
          illust.title,

        get R18 ()
          false,

        get mangaPages ()
          1,  // under construction

        get worksData ()
          null,
      };

      'year month day hour minute'.split(/\s+/).forEach(function (name) {
        illust.__defineGetter__(name, function () illust.dateTime[name]);
      });

      let member = {
        get id ()
          AnkTwitter.elements.illust.memberLink.getAttribute('data-user-id'),

        get pixivId ()
          let (m = AnkTwitter.elements.illust.memberLink.href.match(/\/([^/]+)$/))
            m ? m[1] : null,

        get name ()
          AnkUtils.trim(AnkTwitter.elements.illust.userName.textContent),

        get memoizedName ()
          AnkBase.memoizedName,
      };

      let path = {
        get initDir ()
          AnkBase.Prefs.get('initialDirectory.'+AnkTwitter.SITE_NAME),

        get ext ()
          (path.images[0].match(/(\.\w+):large$/)[1] || '.jpg'),

        get mangaIndexPage ()
          null,

        get images ()
          [AnkTwitter.elements.illust.mediumImage.src+':large'],
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
      // under construction
      AnkUtils.dump('installed: '+AnkTwitter.SITE_NAME);
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {
      // under construction
      AnkUtils.dump('installed: '+AnkTwitter.SITE_NAME+' list');
    }, // }}}

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      // under construction
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

  AnkBase.MODULES.push(AnkTwitter);

} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
