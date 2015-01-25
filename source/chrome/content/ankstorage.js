
Components.utils.import("resource://gre/modules/Sqlite.jsm");

try {


  AnkStorage = function (filename, tables, options, callback) { // {{{
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

    this.createTables(callback);

    return this;
  }; // }}}


  AnkStorage.prototype = {

    /*
     * 
     */

    executeUpdateSQLs: function (qa, callback) {
      let self = this;
      Task.spawn(function () {
        let conn;
        try {
          conn = yield Sqlite.openConnection({ path: self.dbfile.path });
          yield conn.executeTransaction(function* () {
            for (let i=0; i<qa.length; i++) {
              if ('query' in qa[i]) {
                AnkUtils.dump('executeSQLs: '+(i+1)+', '+qa[i].query+(qa[i].values ? ' . '+qa[i].values.length : ''));
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
      }).then(null, function (e) AnkUtils.dumpError(e, true));
    },

    /*
     * 
     */

    /**
     * データベースの作成
     */
    createTables: function (callback) { // {{{
      let qa = [];
      //データベースのテーブルを作成
      for (let tableName in this.tables) {
        qa.push({ query: this.createTableSQL(this.tables[tableName]) });
      }
      if (this.options.index) {
        for (let tableName in this.options.index)
          this.createIndexSQLs(tableName, this.options.index[tableName]).forEach(function (q) qa.push({ query: q }));
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
          qa.push({ SchemaVersion: ver });

          self.executeUpdateSQLs(qa, callback);
        },
        function (e) AnkUtils.dumpError(e, true)
      );
    },

    createTableSQL: function (table) { // {{{
      let fs = [];
      for (let fieldName in table.fields)
        fs.push(fieldName + ' ' + table.fields[fieldName].def + (table.fields[fieldName].constraint ? ' '+table.fields[fieldName].constraint : ''));

      return 'create table if not exists '+table.name+' ('+fs.join()+')';
    }, // }}}

    createIndexSQLs: function(tableName, columns) {
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
