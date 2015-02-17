
Components.utils.import("resource://gre/modules/Task.jsm");

(function (global) {
  var AnkViewer = function (module) {

    if (!module)
      return null;

    let self = this;

    /********************************************************************************
     * ハンドラの定義
     ********************************************************************************/

    // 他のハンドラをキックさせない
    let noMoreEvent = function (func) { // {{{
      return function (e) {
        e.preventDefault();
        e.stopPropagation();
        return func.apply(this, arguments);
      };
    }; // }}}

    // エレメントの作成
    let createElement = function (tagName, id) {
      function IDPrefix(id) {
        return ('ank-pixiv-large-viewer-' + id);
      }

      let elem = doc.createElement(tagName);
      if (id)
        elem.setAttribute('id', IDPrefix(id));
      return elem;
    };

    // 大画像のロード
    let loadBigImage = function (pageno) {
      function setImgSrc(is) {
        loadings = is.length;

        if (is.length > 0) {
          AnkUtils.dump('VIEW => ' + is[0]);
          bigImg.setAttribute('src', is[0]);
        }

        if (is.length > 1) {
          AnkUtils.dump('VIEW FP => ' + is[1]);
          fpImg.setAttribute('facing', 'true');
          fpImg.setAttribute('src', is[1]);
        }
      }

      fpImg.setAttribute('facing', '');

      let imgs = [];
      if (!facing) {
        imgs.push(images[pageno]);
      }
      else {
        facing.forEach(function (v, i) {
          if (v == 1 + pageno)
            imgs.push(images[i]);
        });
      }

      setImgSrc(imgs);
    };

    function getMinPanelOpacity() {
      return AnkBase.Prefs.get('minPanelOpacity', 0);
    }

    function getMaxPanelOpacity() {
      let max = AnkBase.Prefs.get('maxPanelOpacity', 100);
      let min = getMinPanelOpacity();
      return max > min ? max : min;
    }

    // ボタンパネルを表示する
    let showButtons = function () {
      if (fadeOutTimer) {
        clearInterval(fadeOutTimer);
        fadeOutTimer = void 0;
      }
      buttonPanel.style.opacity = getMaxPanelOpacity() / 100.0;
    };

    // ボタンパネルを隠す
    let hideButtons = function () {
      function proc() {
        try {
          if (buttonOpacity > getMinPanelOpacity()) {
            buttonOpacity -= 10;
            buttonPanel.style.opacity = buttonOpacity / 100.0;
            return false;   // please retry
          }
        } catch (e if e instanceof TypeError) {
          // XXX for "can't access dead object"
        }
        return true;
      }

      function fadeOutTimerHandler() {
        if (!proc())
          return;

        clearInterval(fadeOutTimer);
        fadeOutTimer = void 0;
        buttonOpacity = 0;
      }

      var buttonOpacity = getMaxPanelOpacity();
      fadeOutTimer = setInterval(fadeOutTimerHandler, 100);
    };

    var fadeOutTimer;

    // 画像のサイズを変更する
    let autoResize = function (ev) {
      function resize(p) {
        let ivw = parseInt(iw * p), ivh = parseInt(ih * p);
        let fvw = parseInt(fw * p), fvh = parseInt(fh * p);
        let cvw = (ivw + fvw), cvh = (ivh > fvh ? ivh : fvh);
        let vh = ch > cvh ? ch : cvh;

        bigImg.style.width = ivw + 'px';
        bigImg.style.height = ivh + 'px';
        fpImg.style.width = fvw + 'px';
        fpImg.style.height = fvh + 'px';

        imgContainer.style.width = cvw + 'px';
        imgContainer.style.height = cvh + 'px';
        imgContainer.style.setProperty('padding-top', ((ch > cvh) ? parseInt((ch - cvh) / 2) : 0) + 'px');

        viewer.style.height = vh + 'px';

        bigImg.style.display = '';
        if (fpImg.getAttribute('facing') === 'true')
          fpImg.style.display = '';

        // 表示位置を固定して、スクロールバーのon・offに操作を邪魔されないようにする
        buttonPanel.style.setProperty('top', (ch - buttonPanel.clientHeight - scrollbarSize.height) + 'px');

        window.content.scrollTo(
          (cvw > cw) ? parseInt((cvw - cw) / 2) : 0,
          (pos.outside) ? vh + pos.Y : vh * pos.Y
        );
      }

      if (!bigImg.complete || !fpImg.complete)
        return;

      // 画像読み込み完了時だけ表示開始位置をリセット（リサイズではリセットしない）
      if (ev && ev.type === 'load') {
        pos.Y = 0;
        window.content.scrollTo(openpos.X, pos.Y);
      }

      let cw = win.innerWidth - scrollbarSize.width,    // 横はスクロールバーを含まない幅が最大値
        ch = win.innerHeight;

      let mcvh = imgContainer.style.height && imgContainer.style.height.match(/(\d+)\s*px/);
      if (mcvh) {
        let cvh = mcvh[1];
        pos.Y = window.content.scrollY;
        let h = (ch > cvh) ? ch : cvh;
        if (pos.Y > h) {
          pos.Y -= h;
          pos.outside = true;
        }
        else {
          pos.Y = (h > 0) ? pos.Y / h : 0;
          pos.outside = false;
        }
      }

      let iw = bigImg.naturalWidth, ih = bigImg.naturalHeight;
      let fw = (fpImg.getAttribute('facing') === 'true' ? fpImg.naturalWidth : 0),
        fh = (fpImg.getAttribute('facing') === 'true' ? fpImg.naturalHeight : 0);
      let pw = cw / (iw + fw), ph = ch / (ih > fh ? ih : fh);
      if (AnkBase.Prefs.get('dontResizeIfSmall')) {
        pw = pw > 1 ? 1 : pw;
        ph = ph > 1 ? 1 : ph;
      }
      let pp = Math.min(pw, ph);

      switch (fitMode) {
        case AnkBase.FIT.IN_WINDOW_SIZE:
          resize(pp);
          resizeButton.innerHTML = 'FIT in Window';
          break;
        case AnkBase.FIT.IN_WINDOW_WIDTH:
          resize(pw);
          resizeButton.innerHTML = 'FIT in Width';
          break;
        case AnkBase.FIT.IN_WINDOW_HEIGHT:
          resize(ph);
          resizeButton.innerHTML = 'FIT in Height';
          break;
        default:
          resize(1);
          resizeButton.innerHTML = 'No FIT';
          break;
      }
    };

    // 画像リサイズを、イベント発生から少し遅らせて実行する
    let delayResize = function () {
      if (!bigMode)
        return;

      if (qresize)
        clearTimeout(qresize);  // 前のイベントはキャンセル

      qresize = setTimeout(function (e) {
        qresize = null;
        autoResize();
      }, 200);
    };

    var qresize;

    // Fitボタンを押したらFit Modeを変更する
    let rotateFitMode = function () {
      function nextFitMode(fit) {
        switch (fit) {
          case AnkBase.FIT.IN_WINDOW_SIZE:
            return AnkBase.FIT.IN_WINDOW_HEIGHT;
          case AnkBase.FIT.IN_WINDOW_HEIGHT:
            return AnkBase.FIT.IN_WINDOW_WIDTH;
          case AnkBase.FIT.IN_WINDOW_WIDTH:
            return AnkBase.FIT.NONE;
          default:
            return AnkBase.FIT.IN_WINDOW_SIZE;
        }
      }

      fitMode = nextFitMode(fitMode);
      autoResize();
    };

    // 画像の読み込みに失敗した
    let loadError = function (e) {
      if (e.target instanceof Ci.nsIImageLoadingContent && e.target.currentURI) {
        let req = e.target.getRequest(Ci.nsIImageLoadingContent.CURRENT_REQUEST);
        AnkUtils.dump('self: imageStatus = ' + req.imageStatus.toString(2));
        if (confirm(AnkBase.Locale.get('confirmForReloadBigImage'))) {
          e.target.forceReload();
          return;
        }
      }
      changeImageSize();
    };

    // 大画像をクリックしたら次に行くか閉じる
    let clickedBigImg = function () {
      if (totalMangaPages > 1 && (currentMangaPage < totalMangaPages))
        goNextPage(1, false);
      else
        changeImageSize();
    };

    // viewerを開いたり閉じたりする
    let changeImageSize = function () {
      function hide() {
        doc.querySelector('html').style.overflowX = '';
        doc.querySelector('html').style.overflowY = '';

        body.style.backgroundImage = bgImage;
        viewer.style.display = 'none';
        bigImg.src = fpImg.src = '';
        if (wrapper) {
          wrapper.setAttribute('style', 'opacity: 1;');
          if (wrapperTopMargin)
            wrapper.style.marginTop = wrapperTopMargin;
        }
        if (ads)
          ads.forEach(function (ad) {
            if (ad)
              (ad.style.display = ad.__ank_pixiv__style_display);
          });

        // オープン時の位置に戻る
        window.content.scrollTo(openpos.X, openpos.Y);

        return true;
      }

      function show() {

        resizeButtons();
        showButtons();
        hideButtons();

        // オープン時の位置を保存
        openpos.X = window.content.scrollX;
        openpos.Y = window.content.scrollY;

        currentMangaPage = 0;

        if (pageSelector.childNodes.length == 0) {
          for (let i = 0; i < totalMangaPages; i++) {
            let option = doc.createElement('option');
            option.textContent = (i + 1) + '/' + totalMangaPages;
            option.value = i;
            pageSelector.appendChild(option);
          }

          if (totalMangaPages == 1) {
            // イラストでは不要のボタン
            pageSelector.style.display = 'none';
            prevButton.style.display = 'none';
            nextButton.style.display = 'none';
          }
        }

        body.style.backgroundImage = 'none';
        bigImg.style.display = fpImg.style.display = 'none';  // 最初の１枚は描画が完了するまで表示しない
        loadBigImage(currentMangaPage);
        viewer.style.display = '';
        if (wrapper) {
          wrapper.setAttribute('style', 'opacity: 0.1;');
          wrapperTopMargin = wrapper.style.marginTop;
          wrapper.style.marginTop = '0px';
        }
        bigImg.style.setProperty('opacity', '1', 'important');
        if (ads) {
          ads.forEach(
            function (ad) {
              if (ad) {
                ad.__ank_pixiv__style_display = ad.style.display;
                ad.style.display = 'none';
              }
            }
          );
        }
        updateButtons();
      }

      var wrapperTopMargin;

      if (bigMode) {
        hide();
        bigMode = !bigMode;
      } else {
        // 画像のリストが取得できなければviewerを開かない
        if (!images || images.length === 0) {
          Task.spawn(function () {
            let image = yield module.getImageUrlAsync(AnkBase.Prefs.get('viewOriginalSize', false));
            if (!image || image.images.length === 0)
              return; // server error.

            images = image.images;
            if (AnkBase.Prefs.get('useFacingView', true)) {
              facing = image.facing;
              totalMangaPages = facing ? facing[facing.length - 1] : images.length;
            }
            else {
              facing = null;
              totalMangaPages = images.length;
            }
            show();
            bigMode = !bigMode;
          }).then(null).catch(e => AnkUtils.dumpError(e, true));
        }
        else {
          show();
          bigMode = !bigMode;
        }
      }

    };

    // 指定のページへ
    let goPage = function (num) {
      currentMangaPage = num;
      if ((num >= totalMangaPages) || (num < 0))
        return changeImageSize();
      updateButtons();
      AnkUtils.dump('goto ' + (num + 1) + ' page');
      loadBigImage(currentMangaPage);
    };

    // 次のページへ
    let goNextPage = function (d, doLoop) {
      if (bigMode) {
        let page = currentMangaPage + (d || 1);
        goPage(
          !doLoop ? page :
            page >= totalMangaPages ? 0 :
              page < 0 ? totalMangaPages :
                page
        );
      } else {
        changeImageSize();
      }
    };

    var updateButtons = function () {
      (pageSelector.value = currentMangaPage);
    };

    function resizeButtons() {
      let buttunSizeMultiplier = 1 + 0.25 * AnkBase.Prefs.get('panelSize', 0);
      let buttonWidth = 100 * buttunSizeMultiplier;
      let buttonFontSize = 12 * buttunSizeMultiplier;

      [prevButton, nextButton, resizeButton, closeButton].forEach(function (button) {
        button.style.setProperty('width', buttonWidth + 'px', 'important');
        button.style.setProperty('font-size', buttonFontSize + 'px', 'important');
      });

      pageSelector.style.setProperty('font-size', buttonFontSize + 'px', 'important');
    }

    /********************************************************************************
     * クロージャー
     ********************************************************************************/

    // closure {{{
    var doc = module.elements.doc;
    var win = doc.defaultView;
    var body = module.elements.illust.body;
    var wrapper = module.elements.illust.wrapper;
    var openComment = module.elements.illust.openComment;
    var openCaption = module.elements.illust.openCaption;
    var ads = module.elements.illust.ads;
    var bgImage = win.getComputedStyle(doc.body, '').backgroundImage;

    var images = null;
    var facing = null;
    var totalMangaPages = 0;
    var currentMangaPage = 0;
    var fitMode = AnkBase.Prefs.get('largeImageSize', AnkBase.FIT.NONE);
    var bigMode = false;
    var pos = {};
    var openpos = {};
    var scrollbarSize = AnkUtils.scrollbarSize;
    var loadings = 0;
    // }}}

    /********************************************************************************
     * コンポーネントの生成
     ********************************************************************************/

    var viewer = createElement('div', 'panel');
    var bigImg = createElement('img', 'image');
    var fpImg = createElement('img', 'image');
    var imgContainer = createElement('div', 'image-container');
    var imgPanel = createElement('div', 'image-panel');
    var buttonPanel = createElement('div', 'button-panel');
    var prevButton = createElement('button', 'previous-button');
    var nextButton = createElement('button', 'next-button');
    var resizeButton = createElement('button', 'resize-button');
    var closeButton = createElement('button', 'close-button');
    var pageSelector = createElement('select', 'page-selector');

    viewer.setAttribute('style', 'top: 0px; left: 0px; width: 100%; height: 100%; text-align: center; display: none; -moz-opacity: 1; padding: 0px; bottom: 0px');
    prevButton.innerHTML = '<<';
    nextButton.innerHTML = '>>';
    resizeButton.innerHTML = 'RESIZE';
    closeButton.innerHTML = '\xD7';
    buttonPanel.setAttribute('style', 'position: fixed !important; width: 100%; opacity: 0; z-index: 666; text-align: center');
    bigImg.setAttribute('style', 'margin: 0px; background: #FFFFFF; max-height: none !important');
    fpImg.setAttribute('style', 'margin: 0px; background: #FFFFFF; max-height: none !important');
    imgContainer.setAttribute('style', 'margin: auto');
    imgPanel.setAttribute('style', 'margin: 0px');

    [prevButton, nextButton, resizeButton, closeButton].forEach(function (button) {
      button.setAttribute('class', 'submit_btn');
      button.setAttribute('style', 'text-align: center;');
    });

    resizeButtons();

    /*
     * viewer
     *    - imgPanel
     *      - imgContainer
     *        - fpImg
     *        - bigImg
     *    - buttonPanel
     *      - pageSelector
     *      - prevButton
     *      - pageSelector
     *      - nextButton
     *      - resizeButton
     *      - closeButton
     */
    viewer.appendChild(imgPanel);
    imgPanel.appendChild(imgContainer);
    imgContainer.appendChild(fpImg);
    imgContainer.appendChild(bigImg);
    viewer.appendChild(buttonPanel);
    buttonPanel.appendChild(pageSelector);
    buttonPanel.appendChild(prevButton);
    buttonPanel.appendChild(nextButton);
    buttonPanel.appendChild(resizeButton);
    buttonPanel.appendChild(closeButton);

    body.insertBefore(viewer, body.firstChild);


    /********************************************************************************
     * イベントリスナーの設定
     ********************************************************************************/

    // 左右のimgに同じ操作を行う
    function imgCtrl(func) {
      AnkUtils.A(imgPanel.querySelectorAll('#ank-pixiv-large-viewer-image')).forEach(func);
    }


    // 画像を読み込んだら表示サイズの調整を行う
    imgCtrl(e => e.addEventListener('load', autoResize, true));

    // 画像の読み込みに失敗した
    imgCtrl(e => e.addEventListener('error', loadError, true));

    // 大画像をクリックしたら、状態に応じてページを進めたり閉じたりする
    imgCtrl(e => e.addEventListener('click', noMoreEvent(clickedBigImg), false));

    // ボタンパネルの出し入れ
    buttonPanel.addEventListener('mouseover', showButtons, false);
    buttonPanel.addEventListener('mouseout', hideButtons, false);

    // ページの進む戻る
    let turnNextPage = AnkBase.Prefs.get('swapArrowButton', false) ? -1 : 1;
    prevButton.addEventListener('click', noMoreEvent(() => goNextPage(-turnNextPage, true)), false);
    nextButton.addEventListener('click', noMoreEvent(() => goNextPage(turnNextPage, true)), false);

    // リサイズ方法を変更する
    resizeButton.addEventListener('click', noMoreEvent(rotateFitMode), false);

    // 大画像を閉じる
    closeButton.addEventListener('click', noMoreEvent(changeImageSize), false);

    // ページを番号で選択
    pageSelector.addEventListener('change', noMoreEvent(() => goPage(parseInt(pageSelector.value, 10))), true);

    // セレクタをクリックしても何も実行させない
    pageSelector.addEventListener('click', noMoreEvent(() => void 0), false);

    // 大画像以外の場所をクリックしたら閉じる
    doc.addEventListener(
      'click',
      function (e) {
        if (e.button === 0 && bigMode && e.target !== openComment && e.target !== openCaption)
          noMoreEvent(changeImageSize)(e);
      },
      false
    );

    // ウィンドウサイズにあわせて画像をリサイズする
    win.addEventListener('resize', delayResize, false);

    // 画像の読込中エフェクト
    if (AnkBase.Prefs.get('useLoadProgress', true) && MutationObserver) {
      let loadingFunc = function () {
        imgCtrl(e => e.style.setProperty('opacity', '0.5', 'important'));
      };

      let loadedFunc = function () {
        if (--loadings <= 0)
          imgCtrl(e => e.style.setProperty('opacity', '1', 'important'));
      };

      // 画像ロード中は半透明にする
      imgCtrl(e => new MutationObserver(loadingFunc).observe(e, {attributes: true, attributeFilter: ['src']}));

      // 画像ロード完了後に半透明を解除
      imgCtrl(e => e.addEventListener('load', loadedFunc, false));
    }

    /********************************************************************************
     * 外部向け - 他拡張と連携して処理を行う
     ********************************************************************************/

    doc.changeImageSize = changeImageSize;
    doc.goNextMangaPage = goNextPage;
    doc.rotateFitMode = rotateFitMode;

    // 中画像クリックイベントから呼び出してください
    this.openViewer = function () {
      changeImageSize();
    };

  };

  global["AnkViewer"] = AnkViewer;

})(this);
