/********************************************************************************
 * util
 *******************************************************************************/

function load (url) {
  const loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].
    getService(Components.interfaces.mozIJSSubScriptLoader);
  const context = function(){};
  loader.loadSubScript(url, context);
}

load("chrome://ankpixiv/content/ankutils.js");



function test_functions () {

  let u = AnkUtils;

  let d = u.toSQLDateTimeString(new Date('2006/06/06 12:40'));

    assert.equals('2006-06-06 12:40:00.000', d);
}

