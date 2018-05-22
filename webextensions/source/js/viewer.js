"use strict";

{

  const FIT_CLASSES = ['fit_in_window', 'fit_in_height', 'fit_in_width', 'no_fit'];

  let prefs = null;

  let viewer = null;

  let scrollCtrl = null;
  let buttonCtrl = null;
  let resizeCtrl = null;
  let pageCache = null;

  let curPageIdx = 0;

  let start = () => {
    scrollCtrl = new ScrollCtrl();
    buttonCtrl = new ButtonCtrl();
    resizeCtrl = new ResizeCtrl();
    //pageCache = new PageCache();

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
    let maxOpa = 0;
    let minOpa = 0;

    let show = () => {
      if (fadeOutTimer) {
        clearInterval(fadeOutTimer);
        fadeOutTimer = 0;
      }

      viewer.buttonPanel.setAttribute('data-opacity', prefs.maxPanelOpacity.toString());
    };

    let decOpacity = (btnOpa) => {
      try {
        if (btnOpa > minOpa) {
          btnOpa--;
          viewer.buttonPanel.setAttribute('data-opacity', btnOpa.toString());
          return false;   // please retry
        }
      } catch (e) {}
      return true;
    };

    let fadeOutTimerHandler = (btnOpa) => {
      if (decOpacity(btnOpa)) {
        clearInterval(fadeOutTimer);
        fadeOutTimer = 0;
      }
    };

    let hide = function () {
      maxOpa = prefs.maxPanelOpacity > prefs.minPanelOpacity ? prefs.maxPanelOpacity : prefs.minPanelOpacity;
      minOpa = prefs.maxPanelOpacity < prefs.minPanelOpacity ? prefs.maxPanelOpacity : prefs.minPanelOpacity;
      let step = maxOpa - minOpa;
      if (step <= 0) {
        return;
      }

      let btnOpa = maxOpa;

      fadeOutTimer = setInterval(() => fadeOutTimerHandler(btnOpa--), FADEOUT_TIME / step);
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
   * @returns {{init: (function(*)), prefetch: (function(*=)), get: (function(*)), getNewPageIdx: (function(*, *)), totalPages, facing}}
   * @constructor
   */
  let PageCache = function () {

    let totalPages = 0;
    let facing = false;

    let path = [];
    let cache = [];

    let busy = false;

    // 画像を読み込む
    let load = async (pgc) => {
      for (let i=0; i<pgc.length; i++) {
        let img = pgc[i];
        if (!img.objurl && /^https?:\/\//.test(img.src)) {
          await remote.get({
            'url': img.src,
            //'headers': imgCache.referrer && [{'name':'Referer', 'value': imgCache.referrer}],
            'timeout': prefs.xhrTimeout,
            'responseType': 'blob'
          })
            .then((resp) => {
              logger.debug('PREFETCHED:', img.src);
              try {
                img.objurl = URL.createObjectURL(resp.blob);
              }
              catch (e) {
                logger.warn(e);
              }
            });
        }
      }
    };

    // 読み込んだ画像データを破棄する
    let revoke = (pgc) => {
      pgc.forEach((img) => {
        img.busy = true;
        if (img.objurl) {
          logger.debug('REVOKED:', img.src);
          try {
            URL.revokeObjectURL(img.objurl);
          }
          catch (e) {
            logger.warn(e);
          }
        }
      });
    };

    // キャッシュする
    let prefetch = (pageIdx) => {
      if (busy) {
        // TODO キャッシュ範囲外へページジャンプした場合は実行中のloadをキャンセルしてやりなおしたい
        logger.debug('prefetch busy', pageIdx);
        return;
      }

      busy = true;

      let wkCache = [];
      for (let i=0; i < prefs.imagePrefetchSize && i < totalPages; i++) {
        let page = (i + pageIdx + totalPages - 1) % totalPages; // 前ページから imagePrefetchSize 分がキャッシュ対象
        let pgc;
        let index = cache.findIndex((c) => c && c[0] && c[0].page == page);
        if (index != -1) {
          pgc = cache.splice(index, 1)[0];
        }
        else {
          pgc = path[page].map((img) => {
            return {
              'src': img.src,
              'referrer': img.referrer,
              'objurl': null,
              'page': page
            };
          });
        }
        wkCache.push(pgc);
      }

      cache.forEach((e) => revoke(e));
      cache = wkCache;
      cache.push(cache.shift()); // 前ページは最後に回す

      return (async () => {
        for (let i=0; i < cache.length; i++) {
          await load(cache[i]);
        }

        busy = false;
      })()
        .catch((e) => {
          busy = false;
          return Promise.reject(e);
        });
    };

    // キャッシュから情報を探す
    let get = (pageIdx) => {
      let pgc = cache.find((e) => e && e[0] && e[0].page == pageIdx);
      return path[pageIdx].map((img, i) => {
        return {
          'src': img.src,
          'objurl': pgc && pgc[i] && pgc[i].objurl
        };
      });
    };

    // 移動先のページ番号を取得する
    let getNewPageIdx = (opts, currentPageIdx) => {
      if (opts.reverse ? opts.prevPage : opts.nextPage) {
        // 次へ
        let n = (currentPageIdx + 1) % totalPages;
        if (prefs.loopPage || currentPageIdx < n) {
          return n;
        }
      }
      else if (opts.reverse ? opts.nextPage : opts.prevPage) {
        // 前へ
        let n = (currentPageIdx + totalPages - 1) % totalPages;
        if (prefs.loopPage || currentPageIdx > n) {
          return n;
        }
      }
      else if (0 <= opts.pageNo && opts.pageNo < totalPages) {
        // ページ番号指定
        return opts.pageNo;
      }

      return -1;
    };

    //　初期化する
    let init = (imagePath) => {
      path = [];
      imagePath.forEach((p, i) => {
        let pageIdx = p.facingNo > 0 && p.facingNo-1 || i;

        path[pageIdx] = path[pageIdx] || [];
        path[pageIdx].push({
          'src': p.src,
          'referrer': p.referrer
        });

        totalPages = pageIdx + 1;
      });

      facing = totalPages != imagePath.length;
    };

    //

    return {
      'init': init,
      'prefetch': prefetch,
      'get': get,
      'getNewPageIdx': getNewPageIdx,
      get totalPages () {
        return totalPages
      },
      get facing () {
        return facing;
      }
    };
  };

  /**
   * bigImg/fpImgに画像を張り付ける
   * @param eImg
   * @param cache
   * @param pageIdx
   */
  let setImgSrc = (eImg, cache, pageIdx) => {
    eImg.setAttribute('data-page-idx', pageIdx);

    if (cache.objurl) {
      // ObjectURL だと即表示されるのでロード中エフェクトは使わない
      return eImg.setAttribute('src', cache.objurl);
    }

    if (prefs.useLoadProgress) {
      viewer.imgPanel.classList.add('loading');
    }

    eImg.setAttribute('src', cache.src);
  };

  /**
   * bigImg/fpImgへのsrcの読み込みが完了した際に実行する
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
        let p = parseInt(img.getAttribute('data-page-idx'), 10);
        if (!isNaN(p)) {
          pageCache.prefetch(p)
            .catch((e) => {
              logger.error(e);
            });
        }
      }
      catch (e) {}
    }
  };

  /**
   * 指定のページを表示する
   * @param opts
   */
  let setPage = (opts) => {
    if (!isOpened()) {
      return;
    }

    curPageIdx = pageCache.getNewPageIdx(opts, curPageIdx);
    if (curPageIdx == -1) {
      return closeViewer();
    }

    viewer.pageSelector.value = curPageIdx;

    let pgc = pageCache.get(curPageIdx);

    if (pgc[1]) {
      viewer.fpImg.classList.remove('none');
      setImgSrc(viewer.fpImg, pgc[1], curPageIdx);
    }
    else {
      viewer.fpImg.classList.add('none');
      viewer.fpImg.setAttribute('src', '');
    }

    if (pgc[0]) {
      setImgSrc(viewer.bigImg, pgc[0], curPageIdx);
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
    style.textContent = css.join('\n');
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

    // viewerを構築する
    if (!viewer) {
      viewer = createViewerElements();
      addCustomStyle();
    }

    // 画像読み込みキャッシュの初期化
    pageCache = new PageCache();
    pageCache.init(path);

    setFacingMode(pageCache.facing);
    setPageSelectorOptions(pageCache.totalPages);

    viewer.imgPanel.classList.add('hide'); // 見栄えが悪いので最初のロード中は隠す

    document.body.appendChild(viewer.panel);
    viewer.opened = true;
    resizeCtrl.setWindowResizeListener(true);

    // 開く
    curPageIdx = curPageIdx == -1 ? 0 : curPageIdx;
    setPage({'pageNo': curPageIdx});
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