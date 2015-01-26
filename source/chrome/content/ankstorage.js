
Components.utils.import("resource://gre/modules/Sqlite.jsm");

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

    this.dbfile = file;

    return this;
  }; // }}}


  AnkStorage.prototype = {

    /**
     * 更新系トランザクション
     */
    executeUpdateSQLs: function (qa, callback, onSuccess, onError) {
      let self = this;
      Task.spawn(function* () {
        let conn;
        try {
          conn = yield Sqlite.openConnection({ path: self.dbfile.path });
          yield conn.executeTransaction(function* () {
            for (let i=0; i<qa.length; i++) {
              if ('query' in qa[i]) {
                AnkUtils.dump('executeSQLs: '+(i+1)+', '+qa[i].query);
                yield conn.execute(qa[i].query, qa[i].values);
              }
              else if ('SchemaVersion' in qa[i]) {
                AnkUtils.dump('executeSQLs: '+(i+1)+', SchemaVersion = '+qa[i].SchemaVersion);
                yield conn.setSchemaVersion(qa[i].SchemaVersion);
              }
            }
          });

          if (callback)
            callback();
        }
        catch (e) {
          AnkUtils.dumpError(e, true); 
        }
        finally {
          if (conn)
            yield conn.close();
        }
      }).then(
        function (r) {
          if (onSuccess)
            onSuccess(r);
        },
        function (e) {
          AnkUtils.dumpError(e, true);
          if (onError)
            onError();
        }
      );
    },

    /**
     * 更新系トランザクション
     */
    insert: function () {
      AnkUtils.dump('insert: ********** UNIMPLEMENTED **********');
    },

    /**
     * 参照系トランザクション
     */
    select: function (qa, callback, onSuccess, onError) {
      let self = this;
      Task.spawn(function* () {
        let conn;
        try {
          conn = yield Sqlite.openConnection({ path: self.dbfile.path });
          yield conn.executeTransaction(function* () {
            for (let i=0; i<qa.length; i++) {
              let query = 'select * from '+qa[i].table+(qa[i].cond ? ' where '+qa[i].cond : '')+(qa[i].opts ? ' '+qa[i].opts : '');
              AnkUtils.dump('select: '+(i+1)+', '+query);
              let rows = yield conn.execute(query, qa[i].values);
              if (callback)
                callback(qa[i].id, rows);
            }
          });
        }
        catch (e) {
          AnkUtils.dumpError(e, true); 
        }
        finally {
          if (conn)
            yield conn.close();
        }
      }).then(
        function (r) {
          if (onSuccess)
            onSuccess(r);
        },
        function (e) {
          AnkUtils.dumpError(e, true);
          if (onError)
            onError();
        }
      );
    },

    /**
     * 参照系トランザクション（存在確認）
     */
    exists: function (qa, callback) {
      let self = this;
      for (let i=0; i<qa.length; i++)
        qa[i].opts = 'limit 1';
      self.select(qa, function (id, rows) {
        if (callback)
          callback(id, !!rows.length);
      });
    },

    /*
     * 
     */

    /**
     * データベースの作成
     */
    createDatabase: function (callback) { // {{{
      let qa = [];
      //データベースのテーブルを作成
      for (let tableName in this.tables) {
        qa.push({ query: this.getCreateTableSQL(this.tables[tableName]) });
      }
      if (this.options.index) {
        for (let tableName in this.options.index)
          this.getCreateIndexSQLs(tableName, this.options.index[tableName]).forEach(function (q) qa.push({ query: q }));
      }
      this.executeUpdateSQLs(qa, callback);
    }, // }}}

    /**
     * データベースのバージョンアップ
     */
    updateDatabase: function (ver, options, callback) {
      let self = this;
      Task.spawn(function* () {
        let conn;
        try {
          conn = yield Sqlite.openConnection({ path: self.dbfile.path });
          return yield conn.getSchemaVersion();
        }
        catch (e) {
          AnkUtils.dumpError(e, true);
          return -1;
        }
        finally {
          if (conn)
            yield conn.close();
        }
      }).then(
        function (uver) {
          if (uver == -1)
            return;
          if (uver >= ver) {
            AnkUtils.dump("database is up to date. version "+uver);
            return;
          }

          AnkUtils.dump('update database. version '+uver+' -> '+ver);

          try {
            let qa = self.getUpdateSQLs(options);
            qa.push({ SchemaVersion: ver });
            self.executeUpdateSQLs(qa, callback);
          }
          catch (e) {
            AnkUtils.dumpError(e, true);
          }
        },
        function (e) AnkUtils.dumpError(e, true)
      );
    },

    getUpdateSQLs: function (options) {
      let self = this;
      let qa = [];
      options.forEach(function (q) {
        if (q.type == 'update') {
          qa.push({ query:'update '+q.table+' set '+q.set+' where '+q.cond, values:q.values });
        }
        else if (q.type == 'dropIndex') {
          let indexName = self.indexName(q.table,q.columns);
          qa.push({ query:'drop index if exists '+indexName });
        }
      });
      return qa;
    },

    getCreateTableSQL: function (table) { // {{{
      let fs = [];
      for (let fieldName in table.fields)
        fs.push(fieldName + ' ' + table.fields[fieldName].def + (table.fields[fieldName].constraint ? ' '+table.fields[fieldName].constraint : ''));

      return 'create table if not exists '+table.name+' ('+fs.join()+')';
    }, // }}}

    getCreateIndexSQLs: function(tableName, columns) {
      let qa = [];
      for (let i=0; i<columns.length; i++)
        qa.push('create index if not exists ' + this.indexName(tableName, columns[i]) + ' on ' + tableName + ' (' + columns[i].join() + ')');

      return qa;
    },

    indexName: function (tableName, columnNames) { // {{{
      return tableName + '_index_' + columnNames.join('_');
    }, // }}}

    /*
     * 
     */

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
