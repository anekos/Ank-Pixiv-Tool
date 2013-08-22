
try {


  AnkStorage = function (filename, tables, options) { // {{{
    this.filename = filename;
    this.tables = {};
    this.options = options || {};

    for (let key in tables) {
      this.tables[key] = new AnkTable(key, tables[key]);
    }

    let file;

    if (~filename.indexOf(AnkUtils.SYS_SLASH)) {
      file = AnkUtils.makeLocalFile(filename);
    } else {
      file = Components.classes["@mozilla.org/file/directory_service;1"].
               getService(Components.interfaces.nsIProperties).
               get("ProfD", Components.interfaces.nsIFile);
      file.append(filename);
    }

    let storageService = Components.classes["@mozilla.org/storage/service;1"].
                           getService(Components.interfaces.mozIStorageService);
    this.database = storageService.openDatabase(file);

    this.createTables();

    return this;
  }; // }}}

  /*
   * statementToObject
   *    stmt:
   * statement を JS のオブジェクトに変換する
   */
  AnkStorage.statementToObject = function (stmt) { // {{{
    let res = {}, cl = stmt.columnCount;
    for (let i = 0; i < cl; i++) {
      let val;
      switch (stmt.getTypeOfIndex(i)) {
        case stmt.VALUE_TYPE_NULL:    val = null;                  break;
        case stmt.VALUE_TYPE_INTEGER: val = stmt.getInt32(i);      break;
        case stmt.VALUE_TYPE_FLOAT:   val = stmt.getDouble(i);     break;
        case stmt.VALUE_TYPE_TEXT:    val = stmt.getUTF8String(i); break;
      }
      res[stmt.getColumnName(i)] = val;
    }
    return res;
  }; // }}}

  AnkStorage.prototype = {

    /*
     * createStatement
     * 自動的に finalize してくれるラッパー
     */
    createStatement: function (query, block) { // {{{
      let stmt = this.database.createStatement(query);
      try {
        var res = block(stmt);
      } finally {
        stmt.finalize && stmt.finalize();
      }
      return res;
    }, // }}}

    /*
     * JSオブジェクトを挿入
     */
    insert: function (table, values) { // {{{
      if ('string' == typeof table)
        table = this.tables[table];

      let ns = [], vs = [], ps = [], vi = 0;
      for (let fieldName in values) {
        ns.push(fieldName);
        (function (idx, type, value) {
          vs.push(function (stmt) {
            switch (type) {
              case 'string':   return stmt.bindUTF8StringParameter(idx, value);
              case 'text':     return stmt.bindUTF8StringParameter(idx, value);
              case 'integer':  return stmt.bindInt32Parameter(idx, value);
              case 'boolean':  return stmt.bindInt32Parameter(idx, value);
              case 'datetime': return stmt.bindUTF8StringParameter(idx, value);
              default:         return stmt.bindNullParameter(idx);
            }
          });
        })(vi, table.fields[fieldName], values[fieldName]);
        ps.push('?' + (++vi));
      }

      let q = 'insert into ' + table.name + ' (' + AnkUtils.join(ns) + ') values(' + AnkUtils.join(ps) + ');'
      this.createStatement(q, function (stmt) {
        try {
          for (let i = 0; i < vs.length; i++) {
            try {
              (vs[i])(stmt);
            } catch (e) {
              AnkUtils.dumpError(e);
              AnkUtils.dump(["vs[" + i + "] dumped",
                             "type: " + (typeof vs[i]),
                             "value:" + vs[i]]);
              if (AnkUtils.DEBUG)
                AnkUtils.simplePopupAlert('エラー発生', e);
            }
          }
          return stmt.executeStep();
        } finally {
          stmt.reset();
        }
      });
    }, // }}}

    /*
     * block を指定しない場合は、必ず、result.reset すること。
     */
    find: function (tableName, conditions, block) { // {{{
      let q = 'select rowid, * from ' + tableName + (conditions ? ' where ' + conditions : '');
      return this.createStatement(q, function (stmt) {
        return (typeof block == 'function') ? block(stmt) : stmt;
      });
    }, // }}}

    select: function () this.find.apply(this, arguments),

    oselect: function (tableName, conditions, block) { // {{{
      return this.select(tableName, conditions, function (stmt) {
        let r;
        if (typeof block == 'function') {
          while (stmt.executeStep())
            r = block(AnkStorage.statementToObject(stmt));
        } else {
          r = [];
          while (stmt.executeStep())
            r.push(AnkStorage.statementToObject(stmt));
        }
        return r;
      });
    }, // }}}

    update: function (tableName, values, conditions) { // {{{
      let set;
      if (typeof values == 'string') {
        set = values;
      } else {
        let keys = [it for (it in values)];
        // TODO
      }
      let q = 'update ' + tableName + ' set ' + set + (conditions ? ' where ' + conditions : '');
      return this.database.executeSimpleSQL(q);
    }, // }}}

    exists: function (tableName, conditions, block) { // {{{
      let _block = function (stmt) {
        if (typeof block == 'function')
          block(stmt);
        let result = !!(stmt.executeStep());
        stmt.reset();
        return result;
      };
      return this.find(tableName, conditions, _block);
    }, // }}}

    createTables: function () { // {{{
      //データベースのテーブルを作成
      for (let tableName in this.tables) {
        this.createTable(this.tables[tableName]);
      }
      if (this.options.index) {
        for (let tableName in this.options.index) {
          this.createIndexes(tableName, this.options.index[tableName]);
        }
      }
    }, // }}}

    createTable: function (table) { // {{{
      if (this.database.tableExists(table.name))
        return this.updateTable(table);

      let fs = [];
      for (let fieldName in table.fields) {
        fs.push(fieldName + ' ' +
                table.fields[fieldName] + ' ' +
                (table.constraints[fieldName] || ''))
      }

      return this.database.createTable(table.name, AnkUtils.join(fs));
    }, // }}}

    tableInfo: function (tableName) { // {{{
      let storageWrapper = AnkUtils.ccci("@mozilla.org/storage/statement-wrapper;1",
                                         Components.interfaces.mozIStorageStatementWrapper);
      let q = 'pragma table_info (' + tableName + ')';
      // statement wrappers have been deprecated | Nathan's Blog
      // https://blog.mozilla.org/nfroyd/2012/05/14/statement-wrappers-have-been-deprecated/
      if (storageWrapper) {
        return this.createStatement(q, function (stmt) {
          storageWrapper.initialize(stmt);
          let result = {};
          while (storageWrapper.step()) {
            result[storageWrapper.row["name"]] = {type: storageWrapper.row["type"]};
          }
          return result;
        });
      } else {
        return this.createStatement(q, function (stmt) {
          let result = {};
          while (stmt.step()) {
            result[stmt.row["name"]] = {type: stmt.row["type"]};
          }
          return result;
        });
      }
    }, // }}}

    updateTable: function (table) { // {{{
      try {
        let etable = this.tableInfo(table.name);
        for (let fieldName in table.fields) {
          if (etable[fieldName])
            continue;
          let q = "alter table " + table.name + ' add column ' + fieldName + ' ' + table.fields[fieldName];
          this.database.executeSimpleSQL(q);
        }
      } catch(e) {
        AnkUtils.dumpError(e);
      }
    }, // }}}

    createIndexes: function(tableName, columns) {
      let self = this;
      columns.forEach(function (columnName) {
        let indexName = self.indexName(tableName, columnName);
        if (!self.database.indexExists(indexName))
          self.database.executeSimpleSQL('create index ' + indexName + ' on ' + tableName + '(' + columnName + ');');
      })
    },

    dropIndexes: function(tableName, columns) {
      let self = this;
      columns.forEach(function (columnName) {
        let indexName = self.indexName(tableName, columnName);
        if (self.database.indexExists(indexName))
          self.database.executeSimpleSQL('drop index ' + indexName + ';');
      })
    },

    indexName: function (tableName, columnName) { // {{{
      return tableName + '_index_' + columnName.replace(/,/,'_');
    }, // }}}

    delete: function (table, conditions) { // {{{
      let q = 'delete from ' + table + (conditions ? ' where ' + conditions : '');
      return this.database.executeSimpleSQL(q);
    }, // }}}

    execute: function (query, block) { // {{{
      let stmt = this.createStatement(query, function (stmt) {
        return (typeof block == 'function') ? block(stmt) : stmt;
      });
    }, // }}}

    count: function (tableName, conditions) { // {{{
      let query = 'select count(*) from ' + tableName + (conditions ? ' where ' + conditions : '');
      return this.createStatement(query, function (stmt) {
        return stmt.executeStep() && stmt.getInt32(0);
      });
    }, // }}}

    setUserVersion: function (version) { // {{{
      let query = 'pragma user_version = '+version;
      return this.database.executeSimpleSQL(query);
    }, // }}}

    getUserVersion: function () { // {{{
      let query = 'pragma user_version';
      return this.createStatement(query, function (stmt) {
        return stmt.executeStep() && stmt.getInt32(0);
      });
    }, // }}}
  };


  AnkTable = function (name, fields, constraints) { // {{{
    this.name = name;
    this.constraints = constraints || fields.constraints || {};
    delete fields.constraints;
    this.fields = fields;
    return this;
  }; // }}}


} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
