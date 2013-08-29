try {

  /********************************************************************************
  * 外部向け - 他拡張と連携して処理を行う
  ********************************************************************************/

  AnkPixiv = {
      /*
       * ダウンロード
       */
      downloadCurrentImage: function (useDialog, confirmDownloaded, debug) { // {{{
        AnkBase.call.downloadCurrentImage(useDialog, confirmDownloaded, debug);
      }, // }}}

      /*
       * 評価
       */
      rate: function (pt) { // {{{
        AnkBase.call.rate(pt);
      }, // }}}
  };

} catch (error) {
  dump("[" + error.name + "]\n" +
       "  message: " + error.message + "\n" +
       "  filename: " + error.fileName + "\n" +
       "  linenumber: " + error.lineNumber + "\n" +
       "  stack: " + error.stack + "\n");
 }
