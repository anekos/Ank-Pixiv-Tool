
function AnkViewer (module, body, wrapper, openComment, getImages) {

  if (!module)
    return null;

  let self = this;

  /********************************************************************************
  * XXX
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
    function IDPrefix (id)
      ('ank-pixiv-large-viewer-' + id);

    let elem = doc.createElement(tagName);
    if (id)
      elem.setAttribute('id', IDPrefix(id));
    return elem;
  };

  // 大画像のロード
  let loadBigImage = function (bigImg, bigImgPath) {
    bigImg.setAttribute('src', bigImgPath);
  };

  // ボタンパネルを表示する
  let showButtons = function () {
    if (fadeOutTimer) {
      clearInterval(fadeOutTimer);
      fadeOutTimer = void 0;
    }
    buttonPanel.style.opacity = 1;
  };

  // ボタンパネルを隠す
  let hideButtons = function () {
    function clearFadeOutTimer () {
      clearInterval(fadeOutTimer);
      fadeOutTimer = void 0;
      buttonOpacity = 0;
    }
    function fadeOutTimerHandler () {
      try {
        if (buttonOpacity <= 0)
          return clearFadeOutTimer();
        buttonOpacity -= 10;
        buttonPanel.style.opacity = buttonOpacity / 100.0;
      } catch (e if e instanceof TypeError) {
        // XXX for "can't access dead object"
        clearFadeOutTimer();
      }
    }

    if (AnkBase.Prefs.get('dontHidePanel', false))
      return;

    let buttonOpacity = 100;
    fadeOutTimer = setInterval(fadeOutTimerHandler, 100);
  };

  let fadeOutTimer;

  // 画像のサイズを変更する
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

    let cw = win.innerWidth - scrollbarSize, ch = win.innerHeight;
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

  // 画像リサイズを、イベント発生から少し遅らせて実行する
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

  let qresize;

  // viewerを開いたり閉じたりする
  let changeImageSize = function () {
    function hide () {
      doc.querySelector('html').style.overflowX = '';
      doc.querySelector('html').style.overflowY = '';

      body.style.backgroundImage = bgImage;
      viewer.style.display = 'none';
      if (wrapper) {
        wrapper.setAttribute('style', 'opacity: 1;');
        if (wrapperTopMargin)
          wrapper.style.marginTop = wrapperTopMargin;
      }
      if (ads)
        ads.forEach(function (ad) {
          if (ad)
            return (ad.style.display = ad.__ank_pixiv__style_display);
        });

      return true;
    }

    function show () {
      if (AnkBase.Prefs.get('dontHidePanel', false))
        showButtons();
      else
        hideButtons();

      currentMangaPage = 0;

      if (module.in.manga) {
        for (let i = 0; i < images.length; i++) {
          let option = doc.createElement('option');
          option.textContent = (i + 1) + '/' + images.length;
          option.value = i;
          pageSelector.appendChild(option);
        }
      }

      body.style.backgroundImage = 'none';
      bigImg.style.display = 'none';
      loadBigImage(bigImg, images[0]);
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

    let ads = module.elements.illust.ads;
    let wrapperTopMargin;

    if (bigMode) {
      hide();
    } else {
      // 画像のリストが取得できなければviewerを開かない
      if (typeof images === 'undefined' || images.length == 0) {
        images = getImages();
        if (images.length == 0)
          return false; // server error.

        scrollbarSize = AnkUtils.scrollbarSize;
      }

      show();
    }

    bigMode = !bigMode;
  };

  // 指定のページへ
  let goPage = function (num) {
    currentMangaPage = num;
    if ((num >= images.length) || (num < 0))
      return changeImageSize();
    updateButtons();
    AnkUtils.dump('goto ' + num + ' page');
    loadBigImage(bigImg, images[num]);
  };

  // 次のページへ
  let goNextPage = function (d, doLoop) {
    if (bigMode) {
      let page = currentMangaPage + (d || 1);
      goPage(
        !doLoop               ? page :
        page >= images.length ? 0 :
        page < 0              ? images.length :
                                page
      );
    } else {
      changeImageSize();
    }
  };

  let updateButtons = function (v) {
    (pageSelector.value = currentMangaPage);
  };

  /********************************************************************************
  * XXX
  ********************************************************************************/

  // closure {{{
  let win = window.content.window;
  let doc = module.elements.doc;
  let medImg = module.elements.illust.mediumImage;
  let bgImage = doc.defaultView.getComputedStyle(doc.body, '').backgroundImage;
  let images = undefined;
  let currentMangaPage = 0;
  let fitMode = AnkBase.Prefs.get('largeImageSize', AnkBase.FIT.NONE);
  let bigMode = false;
  let scrollbarSize = undefined;
  // }}}

  /********************************************************************************
  * viewerのコンポーネントの生成
  ********************************************************************************/

  if (!wrapper) {
    let childs = body.childNodes;
    wrapper = doc.createElement('ank-wrapper');
    AnkUtils.A(childs).
      forEach(function (e) {
        body.removeChild(e);
        wrapper.appendChild(e);
      }
    );
    body.appendChild(wrapper);
  }

  let viewer = createElement('div', 'panel');
  let bigImg = createElement('img', 'image');
  let imgPanel = createElement('div', 'image-panel');
  let buttonPanel = createElement('div', 'button-panel');
  let prevButton = createElement('button', 'previous-button');
  let nextButton = createElement('button', 'next-button');
  let resizeButton = createElement('button', 'resize-button');
  let closeButton = createElement('button', 'close-button');
  let pageSelector = createElement('select', 'page-selector');

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

  /*
   * viewer
   *    - imgPanel
   *      - bigImg
   *    - buttonPanel
   *      - pageSelector
   *      - prevButton
   *      - pageSelector
   *      - nextButton
   *      - resizeButton
   *      - closeButton
   */
  viewer.appendChild(imgPanel);
  imgPanel.appendChild(bigImg);
  if (module.in.manga) {
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

  /********************************************************************************
  * イベントリスナーの設定
  ********************************************************************************/

  // 中画像をクリックしたら開く
  medImg.addEventListener(
    'click',
    function (e) {
      noMoreEvent(changeImageSize)(e);
    },
    false
  );

  // 画像を読み込んだら表示サイズの調整を行う
  bigImg.addEventListener('load', autoResize, true);

  // 画像の読み込みに失敗した
  bigImg.addEventListener('error',
    function () {
      if (bigImg instanceof Ci.nsIImageLoadingContent && bigImg.currentURI) {
        let req = bigImg.getRequest(Ci.nsIImageLoadingContent.CURRENT_REQUEST);
        AnkUtils.dump('self: imageStatus = ' + req.imageStatus.toString(2));
        if (confirm(AnkBase.Locale('confirmForReloadBigImage'))) {
          bigImg.forceReload();
          return;
        }
      }
      changeImageSize();
    },
    true
  );

  // ボタンパネルの出し入れ
  buttonPanel.addEventListener('mouseover', showButtons, false);
  buttonPanel.addEventListener('mouseout', hideButtons, false);

  // ページの進む戻る
  prevButton.addEventListener('click', noMoreEvent(function () goNextPage(-1, true)), false);
  nextButton.addEventListener('click', noMoreEvent(function () goNextPage(1, true)), false);

  // 大画像をリサイズする
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
          return AnkBase.FIT.NONE;
        default:
          return AnkBase.FIT.IN_WINDOW_SIZE;
        }
      }

      fitMode = rotateFitMode(fitMode);
      autoResize();
    }),
    false
  );

  // 大画像を閉じる
  closeButton.addEventListener('click', noMoreEvent(changeImageSize), false);

  // 大画像をクリックしたら、状態に応じてページを進めたり閉じたりする
  bigImg.addEventListener(
    'click',
    noMoreEvent(function (e) {
      if (module.in.manga && (currentMangaPage < images.length))
        goNextPage(1, false)
      else
        changeImageSize();
    }),
    false
  );

  // ページを番号で選択
  pageSelector.addEventListener(
    'change',
    noMoreEvent(function () goPage(parseInt(pageSelector.value, 10))),
    true
  );

  // セレクタをクリックしても何も実行させない
  pageSelector.addEventListener('click', noMoreEvent(function () void 0), false);

  // 大画像以外の場所をクリックしたら閉じる
  doc.addEventListener(
    'click',
    function (e) {
      if (e.button === 0 && bigMode && e.target !== openComment)
        noMoreEvent(changeImageSize)(e);
    },
    false
  );

  // ウィンドウサイズにあわせて画像をリサイズする
  win.addEventListener('resize', delayResize, false);

  // 大画像のロードのブログレス効果
  if (!AnkBase.Prefs.get('dontShowImageLoadProgress', false) && MutationObserver) {
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

  return self;
}
