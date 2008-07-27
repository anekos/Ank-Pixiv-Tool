
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
load("chrome://ankpixiv/content/ankstorage.js");
load("chrome://ankpixiv/content/ankpixiv.js");


/********************************************************************************
 * main
 *******************************************************************************/

var description = 'AnkStorage UnitTest';


let ts = new AnkStorage('ank-test.sqlite', {
  cats: {
    name: "string",
    kind: "string",
    age: "integer",
  }
});

let jemmy = {name: 'jemmy', kind: 'american shorthair', age: 13}; 
let kurinton = {name: 'kurinton', kind: 'mix', age: 12}; 
let alex = {name: 'alex', kind: 'mix', age: 9};



function setUp() {
  ts.createTables();
  ts.delete('cats');
  ts.insert('cats', alex);
  ts.insert('cats', jemmy);
  ts.insert('cats', kurinton);
}



function tearDown() {
}



function test_GlobalObject () {
  assert.isTrue(AnkUtils);
  assert.isTrue(AnkStorage);
  //assert.isTrue(AnkPixiv);
}



function test_TableInfo () {
  let ti = ts.tableInfo('cats');

    assert.equals({type: "string"}, ti.name);
    assert.equals({type: "integer"}, ti.age);
}



function test_insert () {

  ts.insert('cats', {name: 'dummy', kind: 'mix', age: 9});

    assert.isTrue(ts.exists('cats'));
  
  ts.delete('cats');

    assert.isFalse(ts.exists('cats'));

  ts.delete('cats', '1');

    assert.isFalse(ts.exists('cats'));

  let jemmy ={name: 'jemmy', kind: 'american shorthair', age: 13}; 

  ts.insert('cats', {name: 'alex', kind: 'mix', age: 9});
  ts.insert('cats', jemmy);

    assert.isTrue(ts.exists('cats', 'age > 10'));
    assert.isFalse(ts.exists('cats', 'age > 30'));

}



function test_select () {
  let r = ts.select('cats', 'age = 13', function (stmt) {
    while (stmt.executeStep()) {
      let o = AnkStorage.statementToObject(stmt);
      if (o.name == 'jemmy')
        return true;  
    }
  })

    assert.isTrue(r);

  r = ts.select('cats', 'age = 14', function (stmt) {
    while (stmt.executeStep()) {
      let o = AnkStorage.statementToObject(stmt);
      if (o.name == 'jemmy')
        return true;  
    }
  })

    assert.isFalse(r);
}



function test_oselect () {
  let r;
  ts.oselect('cats', 'age = 13', function (record) r = record.name);

    assert.equals('jemmy', r);
    
  r = ts.oselect('cats', 'age = 13');

    assert.equals(1, r.length);

  delete r[0].rowid;

    assert.equals(jemmy, r[0]);
}



function test_update () {
  let r;

  ts.update('cats', 'age = age + 10');
  r = ts.oselect('cats', 'age = 23');

    assert.equals(1, r.length);

  ts.update('cats', 'age = 2');
  r = ts.oselect('cats', 'age = 2');

    assert.equals(3, r.length);

}
