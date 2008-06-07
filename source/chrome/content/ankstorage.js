
var AnkStorage = function (filename, tables) {
  this.filename = filename;
  this.tables = {};

  for (var key in tables) {
    this.tables[key] = new AnkTable(key, tables[key]);
  }

  var file = Components.classes["@mozilla.org/file/directory_service;1"].
              getService(Components.interfaces.nsIProperties).
              get("ProfD", Components.interfaces.nsIFile);
  file.append(filename);
  var storageService = Components.classes["@mozilla.org/storage/service;1"].
                         getService(Components.interfaces.mozIStorageService);
  this.database = storageService.openDatabase(file);

  this.createTables();

  return this;
};


AnkStorage.prototype = {
  insert: function (table, values) {
    if ('string' == typeof table)
      table = this.tables[table];

    var ns = [], vs = [], ps = [], vi = 0;
    for (var fieldName in values) {
      ns.push(fieldName);
      (function (idx, type, value) {
        vs.push(function (stmt) {
          switch (type) {
            case 'string':  return stmt.bindUTF8StringParameter(idx, value);
            case 'integer': return stmt.bindInt32Parameter(idx, value);
          }
        });
      })(vi, table.fields[fieldName], values[fieldName]);
      ps.push('?' + (++vi));
    }

    var q = 'insert into ' + table.name + ' (' + AnkUtils.join(ns) + ') values(' + AnkUtils.join(ps) + ');'
    var stmt = this.database.createStatement(q);
    for (var i in vs)
      (vs[i])(stmt);

    return dump("result" + stmt.execute());
  },


  _find: function (tableName, conditions) {
    var q = 'select * from ' + tableName + ' where ' + conditions;
    return this.database.createStatement(q);
  },


  find: function (tableName, conditions) {
    var storageWrapper = AnkUtils.ccci("@mozilla.org/storage/statement-wrapper;1",
                                       Components.interfaces.mozIStorageStatementWrapper);
    storageWrapper.initialize(this._find.apply(this, arguments));
    return storageWrapper;
  },


  exists: function (tableName, conditions) {
    // boolean を返すようにする
    return !!(this._find.apply(this, arguments).executeStep());
  },


  createTables: function () {
    //データベースのテーブルを作成
    for (var tableName in this.tables) {
      this.createTable(this.tables[tableName]);
    }
  },


  createTable: function (table) {
    if (this.database.tableExists(table.name))
      return true;

    var fs = [];
    for (var fieldName in table.fields) {
      fs.push(fieldName + " " + table.fields[fieldName]);
    }      

    return this.database.createTable(table.name, AnkUtils.join(fs));
  },
};



var AnkTable = function (name, fields) {
  this.name = name;
  this.fields = fields;
  return this;
};



