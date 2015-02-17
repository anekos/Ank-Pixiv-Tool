/********************************************************************************
* 外部向け - 他拡張と連携して処理を行う
********************************************************************************/

(function (global) {

  let AnkPixiv = {};

  AnkPixiv.prototype = {
    /*
     * ダウンロード
     */
    downloadCurrentImage: function (useDialog, confirmDownloaded, debug) { // {{{
      AnkBase.expose.downloadCurrentImage(useDialog, confirmDownloaded, debug);
    }, // }}}

    /*
     * 評価
     */
    rate: function (pt) { // {{{
      AnkBase.expose.rate(pt);
    } // }}}
  };

  // --------
  global["AnkPixiv"] = AnkPixiv;

})(this);
