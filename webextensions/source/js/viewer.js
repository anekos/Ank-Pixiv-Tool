"use strict";

{

  const FIT_CLASSES = ['fit_in_window', 'fit_in_height', 'fit_in_width', 'no_fit'];

  let prefs = null;

  let viewer = null;

  let scrollCtrl = null;
  let buttonCtrl = null;
  let resizeCtrl = null;
  let pageCache = null;

  let currentPageIdx = 0;
  let totalPages = 0;

  let start = () => {
    scrollCtrl = new ScrollCtrl();
    buttonCtrl = new ButtonCtrl();
    resizeCtrl = new ResizeCtrl();

    return {
      'open': openViewer,
      'close': closeViewer,
      'fit': fitViewer,
      'setPage': setPage
    };
  };

  /*
   *
   */

  /**
   *
   * @param id
   * @returns {string}
   */
  let getAnkId = (id) => {
    return 'ank-pixiv-viewer-' + id;
  };

  /**
   *
   * @param tagName
   * @param id
   * @param cls
   */
  let createAnkElement = (tagName, id, cls) => {
    let e = document.createElement(tagName);
    if (id) {
      e.id = getAnkId(id);
    }
    if (cls) {
      e.classList.add(getAnkId(cls));
    }
    return e;
  };

  /**
   *
   * @param id
   * @returns {Element}
   */
  let queryElementByAnkId = (id) => {
    return document.getElementById(getAnkId(id));
  };

  /**
   * 他のハンドラをキックさせない
   * @param func
   * @returns {function(...[*]=)}
   */
  let noMoreEvent = (func) => {
    return (...args) => {
      args[0].preventDefault();
      args[0].stopPropagation();
      return func.apply(this, args);
    };
  };

  /**
   * ビュアー表示中の画面スクロールの停止・再開
   * @returns {{pause: (function()), resume: (function()), barSize}}
   * @constructor
   */
  let ScrollCtrl = function () {

    let scrollPos = null;
    let barSize = null;

    let pause = () => {
      if (scrollPos) {
        return;
      }
      scrollPos = {
        'top': document.body.scrollTop,
        'left': document.body.scrollLeft
      };
      barSize = AnkUtils.getScrollbarSize();
      document.documentElement.classList.add(getAnkId('enabled'));
    };

    let resume = () => {
      if (!scrollPos) {
        return;
      }
      document.documentElement.classList.remove(getAnkId('enabled'));
      document.body.scrollTop = scrollPos.top;
      document.body.scrollLeft = scrollPos.left;
      scrollPos = null;
    };

    return {
      'pause': pause,
      'resume': resume,
      get barSize () {
        return barSize;
      }
    };
  };

  /**
   * ボタンパネルの表示・非表示
   * @returns {{show: (function()), hide: hide}}
   * @constructor
   */
  let ButtonCtrl = function () {

    const FADEOUT_TIME = 500.0;

    let fadeOutTimer = 0;

    let show = () => {
      if (fadeOutTimer) {
        clearInterval(fadeOutTimer);
        fadeOutTimer = 0;
      }

      viewer.buttonPanel.setAttribute('data-opacity', prefs.maxPanelOpacity.toString());
    };

    let hide = function () {
      let decOpacity = () => {
        try {
          if (btnOpa > minOpa) {
            btnOpa--;
            viewer.buttonPanel.setAttribute('data-opacity', btnOpa.toString());
            return false;   // please retry
          }
        } catch (e) {}
        return true;
      };

      let fadeOutTimerHandler = () => {
        if (decOpacity()) {
          clearInterval(fadeOutTimer);
          fadeOutTimer = 0;
        }
      };

      let maxOpa = prefs.maxPanelOpacity > prefs.minPanelOpacity ? prefs.maxPanelOpacity : prefs.minPanelOpacity;
      let minOpa = prefs.maxPanelOpacity < prefs.minPanelOpacity ? prefs.maxPanelOpacity : prefs.minPanelOpacity;
      let step = maxOpa - minOpa;
      if (step <= 0) {
        return;
      }

      let btnOpa = maxOpa;

      fadeOutTimer = setInterval(fadeOutTimerHandler, FADEOUT_TIME / step);
    };

    return {
      'show': show,
      'hide': hide
    };
  };

  /**
   * 表示サイズを変更する
   * @returns {{setFitMode: (function(*=)), onResizeTriggered: (function(*=)), setWindowResizeListener: (function(*=))}}
   * @constructor
   */
  let ResizeCtrl = function () {

    let fitMode;

    let setFitMode = (n) => {
      n = !isNaN(n) && parseInt(n, 10);
      if (n === undefined || n < 0 || n >= FIT_CLASSES.length) {
        return;
      }

      fitMode = n;

      onResizeTriggered();
    };

    let onResizeTriggered = (ev) => {
      let setSize = (p) => {
        let viw = Math.floor(iw * p);
        let vih = Math.floor(ih * p);
        let vfw = Math.floor(fw * p);
        let vfh = Math.floor(fh * p);

        let vcw = viw + vfw;
        let vch = vih > vfh ? vih : vfh;

        // 逆サイドが広くてスクロールバーが出る時は、panelの領域をスクロールバーの位置までに限定
        let vpw = (vch > ch) && (cw - vcw >= sw) ? (cw-sw) : cw;
        let vph = (vcw > cw) && (ch - vch >= sh) ? (ch-sh) : ch;

        let padLeft = (vpw > vcw) ? Math.floor((vpw - vcw) / 2) : 0;
        let padTop = (vph > vch) ? Math.floor((vph - vch) / 2) : 0;

        viewer.bigImg.style.width = viw + 'px';
        viewer.bigImg.style.height = vih + 'px';
        viewer.fpImg.style.width = vfw + 'px';
        viewer.fpImg.style.height = vfh + 'px';

        viewer.imgContainer.style.width = vcw + 'px';
        viewer.imgContainer.style.height = vch + 'px';
        viewer.imgContainer.style.setProperty('padding-left', padLeft + 'px', '');
        viewer.imgContainer.style.setProperty('padding-top', padTop + 'px', '');

        viewer.panel.style.width = vpw + 'px';
        viewer.panel.style.height = vph + 'px';
      };

      if (!viewer.bigImg.complete || !viewer.fpImg.complete) {
        return;
      }

      let facing = viewer.panel.classList.contains('facing');

      let sw = scrollCtrl.barSize.width;
      let sh = scrollCtrl.barSize.height;

      let cw = window.innerWidth;
      let ch = window.innerHeight;

      let iw = viewer.bigImg.naturalWidth;
      let ih = viewer.bigImg.naturalHeight;
      let fw = facing ? viewer.fpImg.naturalWidth : 0;
      let fh = facing ? viewer.fpImg.naturalHeight : 0;

      if (prefs.adjustFacingImageHeight) {
        if (fh) {
          // 見開きの画像の高さが不揃いの場合は高い方に合わせる
          if (ih > fh) {
            fw = Math.round(fw * (ih / fh));
            fh = ih;
          }
          else {
            iw = Math.round(iw * (fh / ih));
            ih = fh;
          }
        }
      }

      let gw = iw + fw;
      let gh = ih > fh ? ih : fh;

      let ph = ch / gh;
      if (Math.ceil(gw * ph) > cw) {
        ph = (ch - sh) / gh;
      }
      let pw = cw / gw;
      if (Math.ceil(gh * pw) > ch) {
        pw = (cw - sw) / gw;
      }

      let pp = ph < pw ? ph : pw;

      if (prefs.dontResizeIfSmall) {
        ph = ph > 1 ? 1 : ph;
        pw = pw > 1 ? 1 : pw;
        pp = pp > 1 ? 1 : pp;
      }

      let pa = [pp, ph, pw, 1];

      FIT_CLASSES.some((c, i) => {
        if (viewer.panel.classList.contains(c)) {
          if (ev && ev.target === viewer.resizeButton && ev.type == 'click') {
            fitMode = (i+1) % FIT_CLASSES.length;
          }
          viewer.panel.classList.remove(c);
          return true;
        }
      });

      viewer.panel.classList.add(FIT_CLASSES[fitMode]);
      setSize(pa[fitMode]);
    };

    let delayTimerId = null;

    let onWindowResize = (ev) => {
      if (!viewer.opened) {
        return;
      }

      if (delayTimerId) {
        clearTimeout(delayTimerId);
      }

      delayTimerId = setTimeout(() => {
        delayTimerId = null;
        onResizeTriggered(ev);
      });
    };

    let setWindowResizeListener = (enabled) => {
      if (enabled) {
        if (fitMode === undefined) {
          fitMode = isNaN(prefs.largeImageSize) ? 0 : (prefs.largeImageSize % FIT_CLASSES.length);
          viewer.panel.classList.add(FIT_CLASSES[fitMode]);
        }

        window.addEventListener('resize', onWindowResize, false);
      }
      else {
        window.removeEventListener('resize', onWindowResize);
      }
    };

    return {
      'setFitMode': setFitMode,
      'onResizeTriggered': onResizeTriggered,
      'setWindowResizeListener': setWindowResizeListener
    };
  };

  /**
   * 全ページの画像データの入れ物を用意する
   * @param imagePath
   * @param totalPages
   * @returns {{addImage: (function(*=)), clear: (function()), get: (function(*)), length}}
   * @constructor
   */
  let PageCache = function (imagePath, totalPages) {

    // FIXME キャッシュサイズに上限を設けてないので画像数の多い場合危険
    let cache = new Array(totalPages);

    //
    let addImage = (pageIdx) => {
      let loadImg = async (pgc) => {
        for (let i=0; i<pgc.length; i++) {
          let img = pgc[i];
          if (!img.objurl && !img.busy && /^https?:\/\//.test(img.src)) {
            img.busy = true;
            await remote.get({
              'url': img.src,
              //'headers': imgCache.referrer && [{'name':'Referer', 'value': imgCache.referrer}],
              'timeout': prefs.xhrTimeout,
              'responseType': 'blob'
            }).then((resp) => {
              logger.debug('PREFETCHED:', img.src);
              img.objurl = URL.createObjectURL(resp.blob);
              img.busy = false;
            });
          }
        }
      };

      return (async () => {
        if (!isNaN(pageIdx)) {
          // 指定ページ
          await loadImg(cache[pageIdx]);
        }
        else {
          // 全ページ
          for (let n=1; n < totalPages; n++) {
            await loadImg(cache[n]);  // P.1はonloadで処理されるはずなので、P.2から始める
          }
        }
      })().catch((e) => {
        logger.error(e);
      });
    };

    //
    let clear = () => {
      cache.forEach((pgc) => {
        pgc.forEach((img) => {
          img.busy = true;
          if (img.objurl) {
            logger.debug('REVOKED:', img.src);
            URL.revokeObjectURL(img.objurl);
          }
        });
      });
    };

    imagePath.forEach((path, i) => {
      let n = path.facingNo > 0 && path.facingNo-1 || i;
      cache[n] = cache[n] || [];
      cache[n].push({
        'src': path.src,
        'referrer': path.referrer,
        'busy': false,
        'objurl': null
      })
    });

    return {
      'addImage': addImage,
      'clear': clear,
      'get':  (i) => {
        return cache[i];
      },
      get length () {
        return cache.length
      }
    };
  };

  /**
   * 指定のページを表示する
   * @param opts
   */
  let setPage = (opts) => {
    if (!isOpened()) {
      return;
    }

    let setImgSrc = (e, c, p) => {
      e.setAttribute('data-page-no', p);

      if (c.objurl) {
        // ObjectURL だと即表示されるのでロード中エフェクトは使わない
        return e.setAttribute('src', c.objurl);
      }

      if (prefs.useLoadProgress) {
        viewer.imgPanel.classList.add('loading');
      }

      e.setAttribute('src', c.src);
    };

    currentPageIdx = getNewPageIdx(opts, currentPageIdx, totalPages);
    if (currentPageIdx == -1) {
      return closeViewer();
    }

    let pgc = pageCache.get(currentPageIdx);

    if (pgc[1]) {
      viewer.fpImg.classList.remove('none');
      setImgSrc(viewer.fpImg, pgc[1], currentPageIdx);
    }
    else {
      viewer.fpImg.classList.add('none');
      viewer.fpImg.setAttribute('src', '');
    }

    if (pgc[0]) {
      setImgSrc(viewer.bigImg, pgc[0], currentPageIdx);
    }
  };

  /**
   * 移動先のページ番号を取得する
   * @param opts
   * @param currentPageIdx
   * @param totalPages
   * @returns {*}
   */
  let getNewPageIdx = (opts, currentPageIdx, totalPages) => {
    if (opts.reverse ? opts.prevPage : opts.nextPage) {
      // 次へ
      let n = (currentPageIdx + 1) % totalPages;
      if (prefs.loopPage || currentPageIdx < n) {
        viewer.pageSelector.value = n;
        return n;
      }
    }
    else if (opts.reverse ? opts.nextPage : opts.prevPage) {
      // 前へ
      let n = (currentPageIdx + totalPages - 1) % totalPages;
      if (prefs.loopPage || currentPageIdx > n) {
        viewer.pageSelector.value = n;
        return n;
      }
    }
    else if (0 <= opts.pageNo && opts.pageNo < totalPages) {
      // ページ番号指定
      viewer.pageSelector.value = opts.pageNo;
      return opts.pageNo;
    }

    return -1;
  };

  /**
   * 総ページ数を調べる（見開き考慮あり）
   * @param imagePath
   * @returns {*}
   */
  let getTotalPage = (imagePath) => {
    if (imagePath.length == 1) {
      return 1;
    }

    let lastImg = imagePath[imagePath.length-1];
    if (lastImg.facingNo) {
      return lastImg.facingNo;
    }

    return imagePath.length;
  };

  /**
   * imgへのsrcの読み込みが完了した際に実行する
   * @param ev
   */
  let onImageLoadCompleted = (ev) => {
    let img = ev.target;
    if (!viewer.bigImg.complete || !viewer.fpImg.complete) {
      return;
    }

    resizeCtrl.onResizeTriggered(ev);

    // 半透明終了
    viewer.imgPanel.classList.remove('loading', 'hide');

    // 未プリフェッチのsrcの場合は、imgのロードが完了してからキャッシュに入れる
    if (prefs.useImagePrefetch) {
      try {
        let p = parseInt(img.getAttribute('data-page-no'), 10);
        if (!isNaN(p)) {
          pageCache.addImage(p)
            .then(() => {
              pageCache.addImage();
            });
        }
      }
      catch (e) {}
    }
  };

  /**
   * ビュアーを構築する
   * @returns {{panel, bigImg, fpImg, imgContainer, imgPanel, buttonPanel, prevButton, nextButton, resizeButton, closeButton, pageSelector}}
   */
  let createViewerElements = () => {
    let vw = {
      'panel': createAnkElement('div', 'panel'),
      'bigImg': createAnkElement('img', 'image', 'show_image'),
      'fpImg': createAnkElement('img', 'image-fp', 'show_image'),
      'imgContainer': createAnkElement('div', 'image-container'),
      'imgPanel': createAnkElement('div', 'image-panel'),
      'buttonPanel': createAnkElement('div', 'button-panel'),
      'prevButton': createAnkElement('button', 'prev-button', 'submit_button'),
      'nextButton': createAnkElement('button', 'next-button', 'submit_button'),
      'resizeButton': createAnkElement('button', 'resize-button', 'submit_button'),
      'closeButton': createAnkElement('button', 'close-button', 'submit_button'),
      'pageSelector': createAnkElement('select', 'page-selector', 'item_selector'),
      'opened': false
    };

    vw.fpImg.classList.add('fp');

    vw.prevButton.classList.add('for-multi');
    vw.nextButton.classList.add('for-multi');
    vw.pageSelector.classList.add('for-multi');

    vw.panel.appendChild(vw.imgPanel);
    vw.imgPanel.appendChild(vw.imgContainer);
    vw.imgContainer.appendChild(vw.fpImg);
    vw.imgContainer.appendChild(vw.bigImg);
    vw.panel.appendChild(vw.buttonPanel);
    vw.buttonPanel.appendChild(vw.pageSelector);
    vw.buttonPanel.appendChild(vw.prevButton);
    vw.buttonPanel.appendChild(vw.nextButton);
    vw.buttonPanel.appendChild(vw.resizeButton);
    vw.buttonPanel.appendChild(vw.closeButton);

    vw.fpImg.classList.add('none');

    vw.pageSelector.addEventListener('change', noMoreEvent((e) => setPage({'pageNo': e.target.value}), false));
    vw.pageSelector.addEventListener('click', noMoreEvent(() => {}), true);
    vw.prevButton.addEventListener('click', noMoreEvent(() => setPage({'prevPage': true, 'reverse': prefs.swapArrowButton})), true);
    vw.nextButton.addEventListener('click', noMoreEvent(() => setPage({'nextPage': true, 'reverse': prefs.swapArrowButton})), true);

    vw.resizeButton.addEventListener('click', noMoreEvent((e) => resizeCtrl.onResizeTriggered(e)), true);

    vw.closeButton.addEventListener('click', noMoreEvent(() => closeViewer()), false);

    vw.bigImg.addEventListener('click', noMoreEvent(() => setPage({'nextPage': true})), true);
    vw.fpImg.addEventListener('click', noMoreEvent(() => setPage({'nextPage': true})), true);

    vw.bigImg.addEventListener('load', onImageLoadCompleted, false);
    vw.fpImg.addEventListener('load', onImageLoadCompleted, false);

    vw.panel.addEventListener('click', noMoreEvent(() => closeViewer()), false);

    vw.buttonPanel.addEventListener('mouseover', buttonCtrl.show, false);
    vw.buttonPanel.addEventListener('mouseout', buttonCtrl.hide, false);

    return vw;
  };

  /**
   *
   */
  let addCustomStyle = () => {
    let css = [];
    for (let i=0; i<=10; i++) {
      css.push('#ank-pixiv-viewer-button-panel[data-opacity="'+i+'"]{opacity:'+(i/10.0)+';}');
    }
    let style = createAnkElement('style', 'style');
    style.innerHTML = css.join('\n');
    document.head.appendChild(style);
  };

  /**
   * 見開きモードを設定する
   * @param facing
   */
  let setFacingMode = (facing) => {
    viewer.panel.classList.remove('facing');
    if (facing) {
      viewer.panel.classList.add('facing');
    }
  };

  /**
   * ページセレクタの選択肢を生成する
   * @param totalPages
   */
  let setPageSelectorOptions = (totalPages) => {
    viewer.buttonPanel.classList.remove('single-image', 'multi-image');
    if (totalPages == 1) {
      viewer.buttonPanel.classList.add('single-image');
    }
    else {
      viewer.buttonPanel.classList.add('multi-image');
    }

    while (viewer.pageSelector.firstChild) {
      viewer.pageSelector.removeChild(viewer.pageSelector.firstChild);
    }
    for (let i=0; i<totalPages; i++) {
      let o = document.createElement('option');
      o.textContent = [i+1, totalPages].join('/');
      o.value = i;
      viewer.pageSelector.appendChild(o);
    }
  };

  /**
   *
   */
  let isOpened = () => {
    if (viewer) {
      return viewer.opened;
    }

    return !!queryElementByAnkId('panel');
  };

  /**
   * 開く
   * @param opts
   */
  let openViewer = (opts) => {

    prefs = prefs || opts.prefs;

    if (isOpened()) {
      // 既に開いている
      return;
    }

    // サムネかオリジナル画像か選ぶ
    let path = prefs.viewOriginalSize && opts.path.original || opts.path.thumbnail || opts.path.original;
    if (!path) {
      // 引数にパスが見つからない
      return;
    }

    // ビュアーに隠れるページのスクロールを一時停止する
    scrollCtrl.pause();

    totalPages = getTotalPage(path);
    pageCache = new PageCache(path, totalPages);

    // viewerを構築する
    if (!viewer) {
      viewer = createViewerElements();
      addCustomStyle()
    }

    viewer.imgPanel.classList.add('hide'); // 見栄えが悪いので最初のロード中は隠す

    setFacingMode(pageCache.length < path.length);
    setPageSelectorOptions(totalPages);

    document.body.appendChild(viewer.panel);
    viewer.opened = true;
    resizeCtrl.setWindowResizeListener(true);

    // 開く
    currentPageIdx = currentPageIdx == -1 ? 0 : currentPageIdx;
    setPage({'pageNo': currentPageIdx});
    buttonCtrl.show();
 };

  /**
   * 閉じる
   */
  let closeViewer = () => {
    if (!isOpened()) {
      // 開いていない
      return;
    }

    document.body.removeChild(viewer.panel);

    viewer.opened = false;

    resizeCtrl.setWindowResizeListener(false);

    scrollCtrl.resume();

    pageCache.clear();
  };

  /**
   *
   * @param n
   */
  let fitViewer = (n) => {
    if (!isOpened()) {
      // 開いていない
      return;
    }

    resizeCtrl.setFitMode(n);
  };

  //

  var AnkViewer = start();

}