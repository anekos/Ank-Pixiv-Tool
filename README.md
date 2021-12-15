
# This project is no longer maintained

🐈 Bye!

# Ank-Pixiv-Tool

[![Gitter](https://badges.gitter.im/anekos/Ank-Pixiv-Tool.svg)](https://gitter.im/anekos/Ank-Pixiv-Tool?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

簡単Pixivイラストダウンローダ

## Description

Pixivで、見ているイラストをワンクリックでダウンロードするための拡張機能です。
自動的に、適切なファイル名をつけることが出来ます。
また、中サイズ表示の画面のまま大きなイラストを見られるようになります。

## Requirement

- Firefox 55.0以上
- Google Chrome 62.0以上

## Installation

- Firefox
    - [AMO](https://addons.mozilla.org/ja/firefox/addon/ank-pixiv-tool/)から追加してください
    - [web-ext run](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Getting_started_with_web-ext)で実行する場合は[applications.gecko.id](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/manifest.json/applications)の指定が必要です
- Google Chrome
    - デベロッパーモードでパッケージ化されていない拡張機能を読み込むことで利用可能です。ストアへの登録予定はありません
## Usage

ダウンロードしたい作品のページを開いているときにツールバーのアイコン![アイコン](https://raw.githubusercontent.com/anekos/Ank-Pixiv-Tool/master/webextensions/source/images/icon16.png)をクリックしてください

## Changes from 2.x.x

- ダウンロード時の保存先フォルダ選択ダイアログは廃止されました。保存先はブラウザのデフォルトダウンロードフォルダの下に固定となります。これはwebextension apiの仕様からくる制限です。他の場所に保存したい場合はシンボリックリンク等を活用してください
- 外部からの機能呼び出しは、AnkPixivオブジェクトの直接参照からメッセージング方式に変更されました
- ダウンロード履歴の移行は、ankpixiv.sqliteをjsonファイルに[ダンプ](https://github.com/anekos/Ank-Pixiv-Tool/blob/master/webextensions/misc/dump_ankpixiv_sqlite.py)してインポートしてください

## Thanks

翻訳のご協力に感謝します

winiah,
erglo,
Leszek(teo)Życzkowski,
yfdyh000,
Marcelo Ghelman (ghelman.net),
saudi.linux,
Jojaba - BabelZilla,
RigoNet,
le_,
Marcelo Ghelman (ghelman.net),
ДакСРБИЈА,
dimassony,
le_,
erkanyv,
Mikael Hiort af Ornäs,
FidesNL,
markh

## License

このプロダクトはMozilla Public License 2.0のもとで公開しています

[Mozilla Public License 2.0](https://www.mozilla.org/MPL/2.0/)

このプロダクトは以下のソフトウェアを含みます。
各ソフトウェアのライセンスについては、それぞれのソフトウェアのライセンス条項を参照してください

- [Dexie.js](http://dexie.org/) - [Apache-2.0 license](http://www.apache.org/licenses/LICENSE-2.0)
