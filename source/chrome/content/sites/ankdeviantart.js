
Components.utils.import("resource://gre/modules/Task.jsm");

(function (global) {

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
      get manga () {// {{{
        return (self.info.illust.mangaPages > 1);
      }, // }}}

      get medium () { // {{{
        return self.in.illustPage;
      }, // }}}

      get illustPage () { // {{{
        return self.info.illust.pageUrl.match(/^https?:\/\/(?:[^/]+\.)deviantart\.com\/art\//);
      } // }}}
    }; // }}}

    self.elements = (function () { // {{{
      function query (q) {
        return self.elements.doc.querySelector(q)
      }

      function queryAll (q) {
        return self.elements.doc.querySelectorAll(q)
      }

      function miniBrowseQuery (q) {
        return (illust.miniBrowseContainer || self.elements.doc).querySelector(q)
      }

      function miniBrowseQueryAll (q) {
        return (illust.miniBrowseContainer || self.elements.doc).querySelectorAll(q)
      }

      let illust =  {
        get miniBrowseContainer () {
          return query('.minibrowse-container.dev-page-container');
        },

        get datetime () {
          return Array.slice(miniBrowseQueryAll('.dev-metainfo-content.dev-metainfo-details > dl > dd > span')).filter(e => !!e.getAttribute('ts')).pop();
        },

        get title () {
          return miniBrowseQuery('.dev-title-container h1 >a');
        },

        get comment () {
          return miniBrowseQuery('.dev-description .text.block');
        },

        get avatar () {
          return miniBrowseQuery('.dev-title-container .avatar');
        },

        get userName () {
          return miniBrowseQuery('.dev-title-container .username');
        },

        get memberLink () {
          return illust.userName;
        },

        get tags () {
          return miniBrowseQueryAll('.dev-title-container .dev-about-breadcrumb a');
        },

        // require for AnkBase

        get downloadedDisplayParent () {
          return miniBrowseQuery('.dev-title-container');
        },

        // require for AnkBase.Viewer

        get body () {
          return query('body');
        },

        get wrapper () {
          return query('#output');
        },

        get mediumImage () {
          return miniBrowseQuery('.dev-content-normal');
        },

        get originalImage () {
          return miniBrowseQuery('.dev-content-full');
        },

        get ads () {
          let header1 = query('#overhead-collect');

          return ([]).concat(header1);
        }
      };

      return {
        illust: illust,
        get doc () {
          return self.curdoc;
        }
      };
    })(); // }}}

    self.info = (function () { // {{{
      let illust = {
        get pageUrl () {
          return self.elements.doc.location.href;
        },

        get id () {
          return self.getIllustId();
        },

        get dateTime () {
          try {
            // FIXME timezone...
            let d = self.elements.illust.datetime.getAttribute('ts');
            return d && AnkUtils.getDecodedDateTime(new Date(parseInt(d, 10) * 1000));
          }
          catch (e) {
            AnkUtils.dumpError(e);
          }
        },

        get size () {
          return null;
        },

        get tags () {
          let elem = self.elements.illust.tags;
          if (!elem)
            return [];
          let tags = AnkUtils.A(elem)
                       .map(e => (/^#(.+)$/.exec(AnkUtils.trim(e.textContent)) || [])[1])
                         .filter(s => s && s.length);
          if (tags.length == 0)
            return [];

          return tags;
        },

        get shortTags () {
          let limit = AnkBase.Prefs.get('shortTagsMaxLength', 8);
          return self.info.illust.tags.filter(it => (it.length <= limit));
        },

        get tools () {
          return null;
        },

        get width () {
          return 0;
        },

        get height () {
          return 0;
        },

        get server () {
          return self.info.path.image.images[0].match(/^https?:\/\/([^\/\.]+)\./i)[1];
        },

        get referer () {
          return self.info.illust.pageUrl;
        },

        get title () {
          return AnkUtils.trim(self.elements.illust.title.textContent);
        },

        get comment () {
          let e = self.elements.illust.comment;
          return e ? AnkUtils.textContent(e) : '';
        },

        get R18 () {
          return false;
        },

        get mangaPages () {
          return 1;
        },

        get worksData () {
          return null;
        }
      };

      let member = {
        get id () {
          return member.name;
        },

        get pixivId () {
          return member.id;
        },

        get name () {
          return AnkUtils.trim(self.elements.illust.userName.textContent);
        },

        get memoizedName () {
          return null;
        }
      };

      let path = {
        get initDir () {
          return AnkBase.Prefs.get('initialDirectory.' + self.SITE_NAME);
        },

        get ext () {
          return AnkUtils.getFileExtension(path.image.images.length > 0 && path.image.images[0]);
        },

        get mangaIndexPage () {
          return null;
        },

        get image () {
          return self._image;
        }
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

    URL:        'http://www.deviantart.com/',  // イラストページ以外でボタンを押したときに開くトップページのURL
    DOMAIN:     'deviantart.com',              // CSSの適用対象となるドメイン
    SERVICE_ID: 'dART',                         // 履歴DBに登録するサイト識別子
    SITE_NAME:  'DeviantArt',                  // ?site-name?で置換されるサイト名のデフォルト値

    /********************************************************************************
     * 
     ********************************************************************************/

    /**
     * このモジュールの対応サイトかどうか
     */
    isSupported: function (doc) {
      return doc.location.href.match(/^https?:\/\/(?:[^/]+\.)deviantart\.com\//);
    },

    /**
     * ファンクションのインストール
     */
    initFunctions: function () {
      if (this._functionsInstalled)
        return;

      this._functionsInstalled = true;

      var inits = function () {
        if (self.in.medium) {
          self.installMediumPageFunctions();
        }
        else {
          self.installListPageFunctions();
        }
      };

      var self = this;
      var doc = this.curdoc;

      // ページ移動
      var contentChange = function () {
        let content = self.curdoc.querySelector('body');
        if (!(content && doc.readyState === 'complete')) {
          return false;   // リトライしてほしい
        }

        new MutationObserver(function (o) {
          var rise = false;
          o.forEach(function (a) {
            Array.slice(a.addedNodes).forEach(function (e) {
              AnkUtils.dumpError(e);
              if (e.tagName.toLowerCase() === 'footer' && 'depths' === e.id) {
                rise = true;
              }
            });
          });
          if (rise) {
            let q = self.curdoc.getElementById('#ank-pixiv-large-viewer-panel');
            if (q) {
              q.parentNode.removeChild(q);
            }

            AnkUtils.dump('rise contentChange: ' + self.curdoc.location.href);
            inits();
          }
        }).observe(content, {childList: true});

        return true;
      };

      //

      inits();

      AnkBase.delayFunctionInstaller(contentChange, 500, 60, self.SITE_NAME, 'contentChange');
    },

    /**
     * ダウンロード可能か
     */
    isDownloadable: function () {
      if (!this._functionsInstalled)
        return false;

      if (this.in.medium)
        return {illust_id: this.getIllustId(), service_id: this.SERVICE_ID};
    },

    /**
     * イラストID
     */
    getIllustId: function () {
      let m = this.curdoc.location.href.match(/\/art\/(.+?)(?:\?|$)/);
      return m && m[1];
    },

    /**
     * ダウンロード実行
     */
    downloadCurrentImage: function (useDialog, debug) {
      let self = this;
      Task.spawn(function () {
        let image = yield self.getImageUrlAsync(AnkBase.Prefs.get('downloadOriginalSize', false));
        if (!image || image.images.length == 0) {
          window.alert(AnkBase.Locale.get('cannotFindImages'));
          return;
        }

        let context = new AnkBase.Context(self);
        let ev = AnkBase.createDownloadEvent(context, useDialog, debug);
        window.dispatchEvent(ev);
      }).then(null).catch(e => AnkUtils.dumpError(e,true));
    },

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      const IsIllust = /\/art\/(.+?)(?:\?|$)/;
      const Targets = [
                        ['.dev-page-container .thumb > a', 1],
                        ['.feed-action-content a.thumb', 1],
                        ['#gmi-GZone .gr-body a', 2],
                        ['.grid-thumb a.thumb', 2]
                      ];

      return AnkBase.markDownloaded(IsIllust, Targets, true, this, node, force, ignorePref);
    }, // }}}

    /*
     * 評価する
     */
    setRating: function () { // {{{
      return true;
    }, // }}}

    /********************************************************************************
     * 
     ********************************************************************************/

    /**
     * 画像URLリストの取得
     */
    getImageUrlAsync: function (mangaOriginalSizeCheck) {

      let self = this;

      return Task.spawn(function* () {

        function setSelectedImage (image) {
          self._image = image;
          return image;
        }

        let img = self.elements.illust.originalImage;
        if (!img)
          return null;

        return setSelectedImage({ images: [img.src], facing: null });
      });
    },

    /********************************************************************************
     * 
     ********************************************************************************/

    /*
     * イラストページにviewerやダウンロードトリガーのインストールを行う
     */
    installMediumPageFunctions: function () { // {{{

      let proc = function () { // {{{
        var body = self.elements.illust.body;
        var wrapper = self.elements.illust.wrapper;
        var medImg = self.elements.illust.mediumImage;
        var datetime = self.elements.illust.datetime;

        // 完全に読み込まれていないっぽいときは、遅延する
        if (!(body && wrapper && medImg && datetime)) { // {{{
          return false;   // リトライしてほしい
        } // }}}

        let addMiddleClickEventListener = function () {
          if (useViewer)
            self.viewer = new AnkBase.Viewer(self);

          let useCapture = useViewer;

          medImg.addEventListener(
            'click',
            function (e) {
              Task.spawn(function () {
                // mangaIndexPageへのアクセスが複数回実行されないように、getImageUrlAsync()を一度実行してからopenViewer()とdownloadCurrentImageAuto()を順次実行する
                let image = yield self.getImageUrlAsync();
                if (!image || image.images.length == 0) {
                  window.alert(AnkBase.Locale.get('cannotFindImages'));
                  return;
                }

                self._image = image;

                if (useViewer)
                  self.viewer.openViewer();
                if (useClickDownload)
                  AnkBase.downloadCurrentImageAuto(self);
              }).then(null).catch(e => AnkUtils.dumpError(e,true));

              if (useCapture) {
                e.preventDefault();
                e.stopPropagation();
              }
            },
            useCapture
          );
        };

        // FIXME I have no idea.
        let addRatingEventListener = function () {
          /*
          [
            self.elements.illust.xxx,
            self.elements.illust.yyy
          ].forEach(function (e) {
            if (e)
              e.addEventListener('click', () => AnkBase.downloadCurrentImageAuto(self), true);
          });
          */
        };

        // 中画像クリック
        // FIXME I have no idea.
        //let useViewer = AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+self.SITE_NAME, true);
        let useViewer = false;
        let useClickDownload = AnkBase.Prefs.get('downloadWhenClickMiddle', false);
        if (useViewer || useClickDownload)
          addMiddleClickEventListener();

        // レイティングによるダウンロード
        if (AnkBase.Prefs.get('downloadWhenRate', false))
          addRatingEventListener();

        // 保存済み表示
        AnkBase.insertDownloadedDisplayById(
          self.elements.illust.downloadedDisplayParent,
          self.info.illust.R18,
          self.info.illust.id,
          self.SERVICE_ID
        );

        // 保存済み表示
        self.markDownloaded(doc,true);

        return true;
      }; // }}}

      var self = this;
      var doc = this.curdoc;

      // install now
      return AnkBase.delayFunctionInstaller(proc, 500, 20, self.SITE_NAME, '');
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

      var self = this;
      var doc = this.curdoc;

      // install now
      return AnkBase.delayFunctionInstaller(delayMarking, 500, 20, self.SITE_NAME, 'delayMarking');
    } // }}}

  };

  // --------
  global["SiteModule"] = AnkPixivModule;

})(this);
