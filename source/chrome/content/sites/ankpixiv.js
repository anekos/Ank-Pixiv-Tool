
try {

  AnkPixiv = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    URL:        'http://www.pixiv.net/',
    DOMAIN:     'www.pixiv.net',
    SERVICE_ID: 'PXV',

    ID_FANTASY_DISPLAY: 'ankpixiv-fantasy-display',


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    in: { // {{{
      get site () // {{{
        AnkPixiv.in.pixiv, // }}}

      get manga () { // {{{
        let node = AnkPixiv.elements.illust.largeLink;
        return node && node.href.match(/(?:&|\?)mode=manga(?:&|$)/);
      }, // }}}

      get pixiv () { // {{{
        try {
          return AnkPixiv.elements.doc.location.hostname === 'www.pixiv.net';
        } catch (e) {
          return false;
        }
      }, // }}}

      get medium () { // {{{
        let loc = AnkBase.currentLocation;
        return (
          AnkPixiv.in.pixiv &&
          loc.match(/member_illust\.php\?/) &&
          loc.match(/(?:&|\?)mode=medium(?:&|$)/) &&
          loc.match(/(?:&|\?)illust_id=\d+(?:&|$)/)
        );
      }, // }}}

      get illustPage () // {{{
        AnkBase.currentLocation.match(/\.pixiv\.net\/member_illust.php\?.*illust_id=/), // }}}

      get listPage () // {{{
        AnkBase.currentLocation.match(/\.pixiv\.net\/member_illust.php\?id=/), // }}}

      get bookmarkPage () // {{{
        AnkBase.currentLocation.match(/\.pixiv\.net\/bookmark_detail.php\?.*illust_id=/), // }}}

      get myPage () // {{{
        (AnkBase.currentLocation == 'http://www.pixiv.net/mypage.php'), // }}}

      get myIllust () // {{{
        !AnkPixiv.elements.illust.avatar, // }}}

      get myBookmark () // {{{
        (AnkBase.currentLocation == 'http://www.pixiv.net/bookmark.php'), // }}}
    }, // }}}

    elements: (function () { // {{{
      let illust =  {
        get mediumImage () {
          return (
            AnkPixiv.elements.doc.querySelector('.works_display > a > img')
            ||
            AnkPixiv.elements.doc.querySelector('.works_display > * > a > img')
          );
        },

        get largeLink () {
          return (
            AnkPixiv.elements.doc.querySelector('.works_display > a')
            ||
            AnkPixiv.elements.doc.querySelector('.works_display > * > a')
          );
        },

        get worksData ()
          AnkPixiv.elements.doc.querySelector('.work-info'),

        get title ()
          AnkPixiv.elements.doc.querySelector('.work-info > .title'),

        get comment ()
          AnkPixiv.elements.doc.querySelector('.work-info > .caption'),

        get avatar ()
          AnkPixiv.elements.doc.querySelector('.profile-unit > a > img.user-image'),

        get userName ()
          AnkPixiv.elements.doc.querySelector('.profile-unit > a > .user'),

        get memberLink ()
          AnkPixiv.elements.doc.querySelector('a.avatar_m'),

        get tags ()
          AnkPixiv.elements.doc.querySelector('.tags'),

        get recommendList()
          AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('ul.image-items')).pop(),
          
        get downloadedDisplayParent ()
          AnkPixiv.elements.doc.querySelector('.work-info'),

        get ads () {
          let obj = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('object'));
          let iframe = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('iframe'));
          let search = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('.ui-search'));
          // 検索欄も広告扱いしちゃうぞ
          let findbox = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('form.search2'));
          // ldrize
          let ldrize = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('#gm_ldrize'));
          // ヘッダ
          let header1 = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('#global-header'));
          let header2 = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('.header'));

          let toolbarItems = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('#toolbar-items'));

          return ([]).concat(obj, iframe, search, findbox, ldrize, header1, header2, toolbarItems);
        }
      };

      let mypage = {
        get fantasyDisplay ()
          AnkPixiv.elements.doc.querySelector('#' + AnkPixiv.ID_FANTASY_DISPLAY),

        get fantasyDisplayNext ()
          AnkPixiv.elements.doc.querySelector('#contents > div > div.area_pixivmobile'),
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
          parseInt(AnkPixiv.elements.doc.querySelector('#rpc_i_id').textContent, 10),

        get dateTime ()
          AnkPixiv.info.illust.worksData.dateTime,

        get size ()
          AnkPixiv.info.illust.worksData.size,

        get tags () {
          let elem = AnkPixiv.elements.illust.tags;
          if (!elem)
            return [];
          return AnkUtils.A(elem.querySelectorAll('.tag > .text'))
                  .map(function (e) AnkUtils.trim(e.textContent))
                  .filter(function (s) s && s.length);
        },

        get shortTags () {
          let limit = AnkBase.Prefs.get('shortTagsMaxLength', 8);
          return AnkPixiv.info.illust.tags.filter(function (it) (it.length <= limit));
        },

        get tools ()
          AnkPixiv.info.illust.worksData.tools,

        get width ()
          let (sz = illust.size) (sz && sz.width),

        get height ()
          let (sz = illust.size) (sz && sz.height),

        get server ()
          AnkPixiv.info.path.largeStandardImage.match(/^http:\/\/([^\/\.]+)\./i)[1],

        get referer () {
          let mode =
            !AnkPixiv.in.manga                                 ? 'big' :
            !AnkBase.Prefs.get('downloadOriginalSize', false) ? 'manga' :
                                                                 'manga_big&page=0'; // @see downloadFiles#downloadNext()
          return AnkBase.currentLocation.replace(/mode=medium/, 'mode='+mode);
        },

        get title ()
          AnkUtils.trim(AnkPixiv.elements.illust.title.textContent),

        get comment ()
          let (e = AnkPixiv.elements.illust.comment)
            (e ? AnkUtils.textContent(e) : ''),

        get R18 ()
          AnkPixiv.info.illust.tags.some(function (v) 'R-18' == v),

        get mangaPages ()
          AnkPixiv.info.illust.worksData.mangaPages,

        get worksData () {
          let zp = AnkUtils.zeroPad;
          let items = AnkUtils.A(AnkPixiv.elements.illust.worksData.querySelectorAll('.meta > li'));
          let result = {};
          items.forEach(function (item) {
            item = item.textContent.replace(/\[ \u30DE\u30A4\u30D4\u30AF\u9650\u5B9A \]/, '').trim();
            let m;
            if (m = item.match(/(\d+)\/(\d+)\/(\d{4})[^\d]+(\d+):(\d+)/)) {
              result.dateTime = {
                year: zp(m[3], 4),
                month: zp(m[1], 2),
                day: zp(m[2], 2),
                hour: zp(m[4], 2),
                minute: zp(m[5], 2),
              };
            } else if (m = item.match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)[^\d]+(\d+):(\d+)/)) {
              result.dateTime = {
                year: zp(m[1], 4),
                month: zp(m[2], 2),
                day: zp(m[3], 2),
                hour: zp(m[4], 2),
                minute: zp(m[5], 2),
              };
            } else if (m = item.match(/\u6F2B\u753B\s*(\d+)P/)) {
              result.mangaPages = parseInt(m[1], 10);
            } else if (m = item.match(/(\d+)\xD7(\d+)/)) {
              result.size = {
                width: parseInt(m[1], 10),
                height: parseInt(m[2], 10),
              };
            } else {
              result.tools = item;
            }
          });
          return result;
        }
      };

      'year month day hour minute'.split(/\s+/).forEach(function (name) {
        illust.__defineGetter__(name, function () illust.dateTime[name]);
      });

      let member = {
        get id ()
          AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('script'))
            .map(function(it) it.textContent.match(/pixiv.context.userId = '(\d+)';/))
            .filter(function(it) it)[0][1],

        get pixivId ()
          (AnkPixiv.elements.illust.avatar.src.match(/\/profile\/([^\/]+)\//)
           ||
           AnkPixiv.info.path.largeImage.match(/^https?:\/\/[^\.]+\.pixiv\.net\/(?:img\d+\/)?img\/([^\/]+)\//))[1],

        get name ()
          AnkUtils.trim(AnkPixiv.elements.illust.userName.textContent),

        get memoizedName ()
          AnkBase.memoizedName,
      };

      let path = {
        get initDir ()
          AnkBase.Prefs.get('initialDirectory'),

        get ext ()
          (AnkPixiv.info.path.largeStandardImage.match(/(\.\w+)(?:$|\?)/)[1] || '.jpg'),

        get mangaIndexPage ()
          AnkBase.currentLocation.replace(/(\?|&)mode=medium(&|$)/, "$1mode=manga$2"),

        get largeImage ()
          let (i = AnkPixiv.info.path)
            AnkPixiv.in.manga ? i.getLargeMangaImage() : i.largeStandardImage,

        get largeStandardImage ()
          AnkPixiv.info.path.mediumImage.replace(/_m\./, '.'),

        getLargeMangaImage: function (n, base, ext, originalSize) {
          let url =
            (base || AnkPixiv.info.path.largeStandardImage).replace(
              /\.[^\.]+$/,
              function (m) (('_p' + (n || 0)) + (ext || m))
            );
          return originalSize ? url.replace(/_p(\d+)\./, '_big_p$1.') : url;
        },

        get mediumImage () {
          // XXX 再投稿された、イラストのパスの末尾には、"?28737478..." のように数値がつく模様
          // 数値を除去してしまうと、再投稿前の画像が保存されてしまう。
          let result = AnkPixiv.elements.illust.mediumImage.src;//.replace(/\?.*$/, '');
          // for pixiv_expand_thumbnail
          //  http://userscripts.org/scripts/show/82175
          result = result.replace(/_big_p0/, '');
          return result;
        }
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

    /*
     * 遅延インストールのためにクロージャに doc などを保存しておく
     */
    installMediumPageFunctions: function () { // {{{
      function delay (msg, e) { // {{{
        if (installTryed == 20) {
          AnkUtils.dump(msg);
          if (e)
            AnkUtils.dumpError(e, AnkBase.Prefs.get('showErrorDialog'));
        }
        if (installTryed > 100)
          return;
        setTimeout(installer, installInterval);
        installTryed++;
        AnkUtils.dump('tried: ' + installTryed);
      } // }}}

      function noMoreEvent (func) { // {{{
        return function (e) {
          e.preventDefault();
          e.stopPropagation();
          return func.apply(this, arguments);
        };
      } // }}}

      // closure {{{
      let ut = AnkUtils;
      let installInterval = 500;
      let installTryed = 0;
      let con = content;
      let doc = AnkPixiv.elements.doc;
      let win = window.content.window;
      let lastMangaPage = undefined;
      let currentMangaPage = 0;
      // }}}

      let installer = function () { // {{{
        try {
          // インストールに必用な各種要素
          try { // {{{
            var body = doc.getElementsByTagName('body')[0];
            var wrapper = doc.getElementById('wrapper');
            var medImg = AnkPixiv.elements.illust.mediumImage;
            var bigImgPath = AnkPixiv.info.path.largeImage;
            var openComment = doc.querySelector('.comment-show-button');
            var worksData = AnkPixiv.elements.illust.worksData;
            var bgImage = doc.defaultView.getComputedStyle(doc.body, '').backgroundImage;
            var fitMode = AnkBase.Prefs.get('largeImageSize', AnkBase.FIT.NONE);
          } catch (e) {
            return delay("delay installation by error", e);
          } // }}}

          // 完全に読み込まれて以内っぽいときは、遅延する
          if (!(body && medImg && bigImgPath && wrapper && openComment && worksData)) // {{{
            return delay("delay installation by null");
          // }}}

          // 中画像クリック時に保存する
          if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
            medImg.addEventListener(
              'click',
              function (e) {
                AnkBase.downloadCurrentImageAuto();
              },
              true
            );
          } // }}}

          // 大画像関係
          if (AnkBase.Prefs.get('largeOnMiddle', true)) { // {{{
            let IDPrefix =
              function (id)
                ('ank-pixiv-large-viewer-' + id);

            let createElement =
              function (tagName, id)
                let (elem = doc.createElement(tagName))
                  (id && elem.setAttribute('id', IDPrefix(id)), elem);

            let viewer = createElement('div', 'panel');
            let bigImg = createElement('img', 'image');
            let imgPanel = createElement('div', 'image-panel');
            let buttonPanel = createElement('div', 'button-panel');
            let prevButton = createElement('button', 'previous-button');
            let nextButton = createElement('button', 'next-button');
            let resizeButton = createElement('button', 'resize-button');
            let closeButton = createElement('button', 'close-button');
            let pageSelector = createElement('select', 'page-selector');

            let updateButtons = function (v) (pageSelector.value = currentMangaPage);

            viewer.setAttribute('style', 'top: 0px; left: 0px; width:100%; height: 100%; text-align: center; display: none; -moz-opacity: 1; padding: 0px; bottom: 0px');
            prevButton.innerHTML = '<<';
            nextButton.innerHTML = '>>';
            resizeButton.innerHTML = 'RESIZE';
            closeButton.innerHTML = '\xD7';
            buttonPanel.setAttribute('style', 'position: fixed !important; bottom: 0px; width: 100%; opacity: 0; z-index: 666');
            bigImg.setAttribute('style', 'margin: 0px; background: #FFFFFF');
            imgPanel.setAttribute('style', 'margin: 0px');

            [prevButton, nextButton, resizeButton, closeButton].forEach(function (button) {
              button.setAttribute('class', 'submit_btn');
              button.setAttribute('style', 'width: 100px !important');
            });

            if (MutationObserver) {
              // 画像ロード中は半透明にする
              new MutationObserver(function (o) {
                o.forEach(function (e) {
                  e.target.style.setProperty('opacity', '0.5', 'important');
                });
              }).observe(bigImg, {attributes: true, attributeFilter: ['src']});

              // 画像ロード完了後に半透明を解除
              bigImg.addEventListener('load', function (e) {
                e.target.style.setProperty('opacity', '1', 'important');
              }, false);
            }

            /*
             * viewer
             *    - imgPanel
             *      - bigImg
             *    - buttonPanel
             *      - prevButton
             *      - pageSelector
             *      - nextButton
             *      - resizeButton
             *      - closeButton
             */
            viewer.appendChild(imgPanel);
            imgPanel.appendChild(bigImg);
            if (AnkPixiv.in.manga) {
              viewer.appendChild(buttonPanel);
              buttonPanel.appendChild(pageSelector);
              buttonPanel.appendChild(prevButton);
              buttonPanel.appendChild(nextButton);
              buttonPanel.appendChild(resizeButton);
              buttonPanel.appendChild(closeButton);
            }
            else {
              viewer.appendChild(buttonPanel);
              buttonPanel.appendChild(resizeButton);
              buttonPanel.appendChild(closeButton);
            }
            body.insertBefore(viewer, body.firstChild);

            let bigMode = false;

            let fadeOutTimer
            let showButtons = function () {
              if (fadeOutTimer)
                clearInterval(fadeOutTimer);
              buttonPanel.style.opacity = 1;
            };
            let hideButtons = function () {
              function clearFadeOutTimer () {
                clearInterval(fadeOutTimer);
                fadeOutTimer = void 0;
                buttonOpacity = 0;
              }

              let buttonOpacity = 100;
              fadeOutTimer = setInterval(function () {
                try {
                  if (buttonOpacity <= 0)
                    return clearFadeOutTimer();
                  buttonOpacity -= 10;
                  buttonPanel.style.opacity = buttonOpacity / 100.0;
                } catch (e if e instanceof TypeError) {
                  // XXX for "can't access dead object"
                  clearFadeOutTimer();
                }
              }, 100);
            };

            let loadBigImage = function (bigImgPath) {
              bigImg.style.display = 'none';
              bigImg.setAttribute('src', bigImgPath);
            };

            let autoResize = function () {
              function resize (w, h) {
                bigImg.style.width = w + 'px';
                bigImg.style.height = h + 'px';
                if (ch > h) {
                  bigImg.style.marginTop = parseInt(ch / 2 - h / 2) + 'px';
                } else {
                  bigImg.style.marginTop = '0px';
                }
              }

              let cw = doc.documentElement.clientWidth, ch = doc.documentElement.clientHeight;
              let iw = bigImg.naturalWidth, ih = bigImg.naturalHeight;
              let pw = cw / iw, ph = ch / ih;
              if (AnkBase.Prefs.get('dontResizeIfSmall')) {
                pw = pw>1 ? 1 : pw;
                ph = ph>1 ? 1 : ph;
              }
              let pp = Math.min(pw, ph);

              switch (fitMode) {
              case AnkBase.FIT.IN_WINDOW_SIZE:
                resize(parseInt(iw * pp), parseInt(ih * pp));
                resizeButton.innerHTML = 'FIT in Window';
                break;
              case AnkBase.FIT.IN_WINDOW_WIDTH:
                resize(parseInt(iw * pw), parseInt(ih * pw));
                resizeButton.innerHTML = 'FIT in Width';
                break;
              case AnkBase.FIT.IN_WINDOW_HEIGHT:
                resize(parseInt(iw * ph), parseInt(ih * ph));
                resizeButton.innerHTML = 'FIT in Height';
                break;
              default:
                resize(iw, ih);
                resizeButton.innerHTML = 'No FIT';
                break;
              }

              bigImg.style.display = '';
              window.content.scrollTo(0, 0);
            };

            bigImg.addEventListener('load', autoResize, true);

            let qresize = null;
            let delayResize = function () {
              if (!bigMode)
                return;
              if (qresize)
                clearTimeout(qresize);
              qresize = setTimeout(function(e) {
                qresize = null;
                autoResize();
              },200)
            };

            win.addEventListener('resize', delayResize, false);

            let changeImageSize = function () {
              let ads = AnkPixiv.elements.illust.ads;
              let wrapperTopMargin;

              if (bigMode) {
                doc.querySelector('html').style.overflowX = '';
                doc.querySelector('html').style.overflowY = '';

                body.style.backgroundImage = bgImage;
                viewer.style.display = 'none';
                wrapper.setAttribute('style', 'opacity: 1;');
                if (wrapperTopMargin)
                  wrapper.style.marginTop = wrapperTopMargin;
                ads.forEach(function (ad) (ad.style.display = ad.__ank_pixiv__style_display));
              } else {
                hideButtons();
                currentMangaPage = 0;
                if (AnkPixiv.in.manga && typeof lastMangaPage == 'undefined') {
                  AnkPixiv.getLastMangaPage(function (v) {
                    if (v) {
                      lastMangaPage = v;
                      for (let i = 0; i < v; i++) {
                        let option = doc.createElement('option');
                        option.textContent = (i + 1) + '/' + v;
                        option.value = i;
                        pageSelector.appendChild(option);
                      }
                    }
                    else {
                      changeImageSize();
                    }
                  });
                }
                body.style.backgroundImage = 'none';
                loadBigImage(bigImgPath);
                viewer.style.display = '';
                wrapper.setAttribute('style', 'opacity: 0.1;');
                wrapperTopMargin = wrapper.style.marginTop;
                wrapper.style.marginTop = '0px';
                bigImg.style.setProperty('opacity', '1', 'important');
                ads.forEach(
                  function (ad) {
                    ad.__ank_pixiv__style_display = ad.style.display;
                    ad.style.display = 'none';
                  }
                );
                updateButtons();
              }
              bigMode = !bigMode;
            };

            let (reloadLimit = 10, reloadInterval = 1000, prevTimeout) {
              bigImg.addEventListener('error',
                function () {
                  if (bigImg instanceof Ci.nsIImageLoadingContent && bigImg.currentURI) {
                    let req = bigImg.getRequest(Ci.nsIImageLoadingContent.CURRENT_REQUEST);
                    AnkUtils.dump('AnkPixiv: imageStatus = ' + req.imageStatus.toString(2));
                    if (confirm(AnkBase.Locale('confirmForReloadBigImage'))) {
                      bigImg.forceReload();
                      return;
                    }
                  }
                  changeImageSize();
                },
                true
              );
            }

            let goPage = function (num) {
              currentMangaPage = num;
              if (lastMangaPage !== undefined && ((num >= lastMangaPage) || (num < 0)))
                return changeImageSize();
              updateButtons();
              AnkUtils.dump('goto ' + num + ' page');
              bigImg.setAttribute('src', AnkPixiv.info.path.getLargeMangaImage(num));
            };

            let goNextPage = function (d, doLoop) {
              if (bigMode) {
                let page = currentMangaPage + (d || 1);
                goPage(
                  lastMangaPage === undefined ? page :
                  !doLoop                     ? page :
                  page >= lastMangaPage       ? 0 :
                  page < 0                    ? lastMangaPage :
                  page
                );
              } else {
                changeImageSize();
              }
            };

            doc.changeImageSize = changeImageSize;
            doc.goNextMangaPage = goNextPage;

            buttonPanel.addEventListener('mouseover', showButtons, false);
            buttonPanel.addEventListener('mouseout', hideButtons, false);
            prevButton.addEventListener('click', noMoreEvent(function () goNextPage(-1, true)), false);
            nextButton.addEventListener('click', noMoreEvent(function () goNextPage(1, true)), false);
            resizeButton.addEventListener(
              'click',
              noMoreEvent(function() {
                function rotateFitMode (fit) {
                  switch (fit) {
                  case AnkBase.FIT.IN_WINDOW_SIZE:
                    return AnkBase.FIT.IN_WINDOW_HEIGHT;
                  case AnkBase.FIT.IN_WINDOW_HEIGHT:
                    return AnkBase.FIT.IN_WINDOW_WIDTH;
                  case AnkBase.FIT.IN_WINDOW_WIDTH:
                    return AnkBase.FIT.IN_WINDOW_NONE;
                  default:
                    return AnkBase.FIT.IN_WINDOW_SIZE;
                  }
                }

                fitMode = rotateFitMode(fitMode);
                autoResize();
              }),
              false
            );
            closeButton.addEventListener('click', noMoreEvent(changeImageSize), false);
            bigImg.addEventListener(
              'click',
              noMoreEvent(function (e) {
                if (AnkPixiv.in.manga && (currentMangaPage < lastMangaPage || lastMangaPage === undefined))
                  goNextPage(1, false)
                else
                  changeImageSize();
              }),
              false
            );
            medImg.addEventListener('click', noMoreEvent(changeImageSize), false);
            pageSelector.addEventListener(
              'change',
              noMoreEvent(function () goPage(parseInt(pageSelector.value, 10))),
              true
            );
            pageSelector.addEventListener('click', noMoreEvent(function () void 0), false);
            doc.addEventListener(
              'click',
              function (e) {
                if (e.button === 0 && bigMode)
                  noMoreEvent(changeImageSize)(e);
              },
              false
            );
          } // }}}

          // レイティングによるダウンロード
          (function () { // {{{
            if (!AnkBase.Prefs.get('downloadWhenRate', false))
              return;
            let point = AnkBase.Prefs.get('downloadRate', 10);
            AnkUtils.A(doc.querySelectorAll('.rating')).forEach(function (e) {
              e.addEventListener(
                'click',
                function () {
                  let klass = e.getAttribute('class', '');
                  let m = klass.match(/rate-(\d+)/);
                  if (m && (point <= parseInt(m[1], 10)))
                    AnkBase.downloadCurrentImageAuto();
                },
                true
              );
            });
          })(); // }}}

          // 保存済み表示
          if (AnkBase.isDownloaded(AnkPixiv.info.illust.id,AnkPixiv.SERVICE_ID)) { // {{{
            AnkBase.insertDownloadedDisplay(
                AnkPixiv.elements.illust.downloadedDisplayParent,
                AnkPixiv.info.illust.R18
            );
          } // }}}

          // コメント欄を開く
          if (AnkBase.Prefs.get('openComment', false)) // {{{
            setTimeout(function () openComment.click(), 1000);
          // }}}

          AnkUtils.dump('installed: pixiv');

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

      // 伸びるおすすめリストに追随する
      function followExpansion () {
        let recommend = AnkPixiv.elements.illust.recommendList;
        
        let installTimer = setInterval(
          function () {
            if (!recommend)
              if (counter > 0) {
                AnkUtils.dump('delay: '+counter--);
                return;
              }
  
            clearInterval(installTimer);
            installTimer = null;
  
            if (AnkBase.Prefs.get('markDownloaded', false)) {
              if (MutationObserver) {
                new MutationObserver(function (o) {
                  o.forEach(function (e) AnkPixiv.markDownloaded(e.target, true));
                }).observe(recommend, {childList: true});
              }
            }
  
            AnkUtils.dump('installed: pixiv bookmark');
          },
          interval
        );
      }

      // プレミアムユーザーでない絵師さんの作品一覧は遅延が発生するのでonFocusによる処理だけではマークがつかない
      function delayMarking () {
        let doc = AnkPixiv.elements.doc;

        let installTimer = setInterval(
            function () {
              if (doc.readyState !== "complete")
                if (counter > 0) {
                  AnkUtils.dump('delay: '+counter--);
                  return;
                }
    
              clearInterval(installTimer);
              installTimer = null;

              AnkPixiv.markDownloaded(doc,true);

              AnkUtils.dump('installed: pixiv list');
            },
            interval
          );
      }

      let counter = 20;
      let interval = 500;

      if (AnkPixiv.in.bookmarkPage || AnkPixiv.in.myBookmark) {
        followExpansion();
      } else if (AnkPixiv.in.listPage) {
        delayMarking();
      }
    },

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      const IsIllust = /&illust_id=(\d+)/;
      const BoxTag = /^(li|div|article)$/i;

      function findBox (e, limit) {
        if (limit <= 0)
          return null;
        if (BoxTag.test(e.tagName))
          return e;
        return findBox(e.parentNode, limit - 1);
      }

      function trackbackParentNode (node, n) {
        for (let i = 0; i< n; i++)
          node = node.parentNode;
        return node;
      }

      if (AnkPixiv.in.medium || !AnkPixiv.in.site)
        return;

      if (!AnkBase.Prefs.get('markDownloaded', false) && !ignorePref)
        return;

      if (!force && AnkBase.Store.document.marked)
        return;

      AnkBase.Store.document.marked = true;

      if (!node)
        node = AnkPixiv.elements.doc;

      [
        ['a > img', 1],
        ['a > p > img', 2],
        ['a > div > img', 2],
        ['a > p > div > img', 3]
      ].forEach(function ([selector, nTrackback]) {
        AnkUtils.A(node.querySelectorAll(selector)) .
          map(function (img) trackbackParentNode(img, nTrackback)) .
          map(function (link) link.href && let (m = IsIllust.exec(link.href)) m && [link, m]) .
          filter(function (m) m) .
          map(function ([link, m]) [link, parseInt(m[1], 10)]) .
          forEach(function ([link, id]) {
            let box = findBox(link, 3);
            if (box && !box.className.split(/ /).some(function (v) v === AnkBase.CLASS_NAME.DOWNLOADED))
              if (AnkBase.isDownloaded(id,AnkPixiv.SERVICE_ID))
                box.className += ' ' + AnkBase.CLASS_NAME.DOWNLOADED;
          });
      });
    }, // }}}

    /*
     * remoteFileExists 用のクッキーをセットする
     */
    setCookies: function () { // {{{
      const cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);
      cookieManager.add(
        '.pixiv.net',
        '/',
        'pixiv_embed',
        'pix',
        false,
        false,
        false,
        new Date().getTime() + (1000 * 60 * 60 * 24 * 365)
      );
    }, // }}}

    /*
     * マンガの最終ページを取得する。
     * この関数は、非同期に呼び出してはいけない。
     * (pagesFromIllustPage のため)
     *
     *    result:     コールバック関数 function (ページ数, 見開きか否か)
     */
    getLastMangaPage: function (result) { // {{{
      const PAGE_LIMIT = 50 - 5;

      let pagesFromIllustPage = AnkPixiv.info.illust.mangaPages;

      function get (source) {
        const MAX = 1000;
        let doc = AnkUtils.createHTMLDocument(source);
        if (doc.querySelector('.errorArea') || doc.querySelector('.errortxt')) {
          window.alert(AnkBase.Locale('serverError'));
          return [0, null];
        }
        let scripts = AnkUtils.A(doc.querySelectorAll('script'));
        let sm = scripts.filter(function (e) ~e.textContent.indexOf('pixiv.context.pages['));
        let fp = new Array(sm.length);
        sm.forEach(function (v, i, a) {
          if (v.textContent.match(/pixiv\.context\.pages\[(\d+)\]/)) {
            fp[i] = 1 + parseInt(RegExp.$1);
          }
        });
        if (fp[fp.length - 1] < fp.length) {
          // 見開きがある場合
          AnkUtils.dump("*** MOD *** Facing Page Check: " + fp.length + " pics in " + fp[fp.length - 1] + " pages");
        }
        else {
          // 見開きがない場合
          fp = null;
        }
        return [Math.min(MAX,sm.length), fp];
      }

      let xhr = new XMLHttpRequest();
      xhr.open('GET', AnkPixiv.info.path.mangaIndexPage, true);
      xhr.onreadystatechange = function (e) {
        if (xhr.readyState == 4 && xhr.status == 200) {
          let arr = get(xhr.responseText);
          result(arr[0], arr[1]);
        }
      };
      xhr.send(null);
    }, // }}}
  };

  /********************************************************************************
  * インストール - ankpixiv.xulにも登録を
  ********************************************************************************/

  AnkBase.MODULES.push(AnkPixiv);

} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
