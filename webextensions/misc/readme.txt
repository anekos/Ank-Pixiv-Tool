


/*
 * ジェスチャなどに登録して使えるブックマークレット
 */

// ダウンロード実行
javascript:(function () {window.postMessage({'type':'AnkPixiv.Download'},'*')})();

// viewer操作
javascript:(function () {window.postMessage({'type':'AnkPixiv.Viewer.open'},'*')})();
javascript:(function () {window.postMessage({'type':'AnkPixiv.Viewer.close'},'*')})();
javascript:(function () {window.postMessage({'type':'AnkPixiv.Viewer.next'},'*')})();
javascript:(function () {window.postMessage({'type':'AnkPixiv.Viewer.prev'},'*')})();
javascript:(function () {window.postMessage({'type':'AnkPixiv.Viewer.fit'},'*')})();

// いいね！
javascript:(function () {window.postMessage({'type':'AnkPixiv.Rate.n'},'*')})(); // n = 点数(1～10)

// 設定画面の隠しオプションを表示する
javascript:(function(d){Array.prototype.forEach.call(d.querySelectorAll('.item.hidden'),e=>e.classList.remove('hidden'))})(document);



/*
 * 問題・課題
 */


・[問] chromeで、「設定＞ダウンロード前に各ファイルの保存場所を確認する」が有効だと、chrome.downloadsの指定で無効にしていても確認ダイアログが出てしまう→対応待ち https://code.google.com/p/chromium/issues/detail?id=417112
・[問] firefoxで、content script側で作ったObjectURLをbackground page側に渡してもアクセスできない→XHRは（というかcreate/revokeを）background側に戻したくないので保留

－[問] firefoxで、extensionからのXHRを onBeforeSendHeaders でトラップできない模様 https://bugzilla.mozilla.org/show_bug.cgi?id=1273138→対応された模様
－[問] firefoxで、chrome.storageがcontent scriptから利用できない→対応待ち https://bugzilla.mozilla.org/show_bug.cgi?id=1197346→対応された模様
－[問] そもそも論として小説DL機能を実装していいものかどうか→機能削除

・[課] 公開ライセンスの検討
・[課] ファイルシステム上に同名のファイルが存在するかどうかの確認を行えるAPIがないため、ダウンロード履歴を保存していないと、再ダウンロード（既存ファイルの上書き）になるかどうかの確認がとれない
・[課] ファイルの保存にdownloads apiを使っているため、画像ダウンロード毎にダウンロードバーが一瞬表示される→ダウンロードバー置き換えの拡張機能を入れるとか
・[課] background pageをevent pageにしたい→setTimeout()の排除が必要(utils.jsとかdexie.jsとか)
・[課] dexie.jsをdb.jsか自製のコードに置き換える
・[課] ダウンロード時のパス文字列に // とか .. とかが入ると例外が発生する→ファイル名チェックする
・[課] 順序制御をシンプルにする

－[課] うごイラビューアが、等倍表示以外だと負荷が高い→うごイラ対応機能は削除
－[課] うごイラ用jsファイルが、DL時にセキュリティ警告の原因となる→うごイラ対応機能は削除
－[課] 挿絵がリンク切れになった小説はダウンロードしない→してもいいような、しなくてもいいような→小説DL機能は削除

/*
 * 変更点
 */

・[変] ダウンロード先に任意のフォルダを選べず、ブラウザのデフォルトダウンロードフォルダの下になる(API上の制限)→シンボリックリンクやジャンクションなどで対応してください
・[変] サードパーティーcookieの強制保存は廃止(API上の制限)→pixivのマンガがDL出来なくなる件は、ブラウザの例外設定で対応してください
・[変] メタテキストはjson形式に変更
