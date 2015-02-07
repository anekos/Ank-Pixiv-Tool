
Components.utils.import("resource://gre/modules/Sqlite.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

try {


  AnkStorage = function (filename, tables, options, debug) { // {{{

    this.dbpath = filename;
    this.tables = tables;
    this.options = options || {};
    this.debug = debug;

    let file;

    if (~filename.indexOf(AnkUtils.SYS_SLASH)) {
      file = AnkUtils.makeLocalFile(filename);
    } else {
      file = FileUtils.getDir("ProfD", [filename]);
    }

    this.dbpath = file.path;

    this.conn = null;

    return this;
  }; // }}}


  AnkStorage.prototype = {

    openDatabase: function (callback) {
      let self = this;
      return Task.spawn(function* () {
        self.conn = yield Sqlite.openConnection({ path:self.dbpath });
        if (self.conn) {
          callback();
          return true;
        }
      });
    },

    closeDatabase: function () {
      let self = this;
      if (self.conn) {
        self.conn.close().then(function () this.conn=null).catch(function (e) AnkUtils.dumpError(e));
      }
    },

    /**
     * 更新系トランザクション
     */
    update: function (qa) {
      if (!qa || qa.length == 0)
        return;

      let self = this;
      return Task.spawn(function* () {
        return yield self.conn.executeTransaction(function* () {
          for (let i=0; i<qa.length; i++) {
            if ('query' in qa[i]) {
              if (self.debug)
                AnkUtils.dump('executeSQLs: '+(i+1)+', '+qa[i].query);
              yield self.conn.execute(qa[i].query, qa[i].values);
            }
            else if ('SchemaVersion' in qa[i]) {
              if (self.debug)
                AnkUtils.dump('executeSQLs: '+(i+1)+', SchemaVersion = '+qa[i].SchemaVersion);
              yield self.conn.setSchemaVersion(qa[i].SchemaVersion);
            }
          }

          return true;
        });
      });
    },

    /**
     * 参照系トランザクション
     */
    select: function (qa, callback, onRow) {
      if (!qa || qa.length == 0)
        return;

      let self = this;
      return Task.spawn(function* () {
        return yield self.conn.executeTransaction(function* () {
          for (let i=0; i<qa.length; i++) {
            let query = 'select * from '+qa[i].table+(qa[i].cond ? ' where '+qa[i].cond : '')+(qa[i].opts ? ' '+qa[i].opts : '');
            if (self.debug)
              AnkUtils.dump('select: '+(i+1)+', '+query);
            let rows = yield self.conn.execute(query, qa[i].values, onRow);
            if (!callback)
              return rows && rows.length > 0 && rows[0];

            callback(qa[i].id, rows);
          }

          return true;
        });
      });
    },

    /**
     * 参照系トランザクション（存在確認）
     */
    exists: function (qa, callback) {
      let self = this;
      for (let i=0; i<qa.length; i++)
        qa[i].opts = (qa[i].opts ? qa[i].opts+' ':'')+' limit 1';

      if (!callback)
        return self.select(qa);

      return self.select(qa, function (id, rows) {
        if (callback)
          callback(id, rows && rows.length > 0 && rows[0]);
      });
    },

    /*
     * 
     */

    /**
     * データベースの作成
     */
    createDatabase: function () { // {{{
      let qa = [];
      //データベースのテーブルを作成
      for (let tableName in this.tables) {
        qa.push({ type:'createTable', table:tableName, fields:this.tables[tableName] });;
      }
      if (this.options.unique) {
        for (let tableName in this.options.unique) {
          let columns = this.options.unique[tableName];
          qa.push({ type:'createUnique', table:tableName, columns:columns });
        }
      }
      if (this.options.index) {
        for (let tableName in this.options.index) {
          let columns = this.options.index[tableName];
          for (let i in columns) {
            qa.push({ type:'createIndex', table:tableName, columns:columns[i] });
          }
        }
      }

      return this.update(this.getUpdateSQLs(qa));
    }, // }}}

    /**
     * データベースバージョンの取得
     */
    getDatabaseVersion: function () {
      let self = this;
      return Task.spawn(function* () {
        return yield self.conn.getSchemaVersion();
      });
    },

    /*
     * 
     */

    getUpdateSQLs: function (options) {
      let self = this;
      let qa = [];
      options.forEach(function (q) {
        if (q.type == 'createTable') {
          let fs = [];
          for (let fieldName in q.fields)
            fs.push(fieldName + ' ' + q.fields[fieldName].type + (q.fields[fieldName].constraint ? ' '+q.fields[fieldName].constraint : ''));
          qa.push({ query:'create table if not exists '+q.table+' ('+fs.join()+')' });
        }
        else if (q.type == 'createUnique') {
          let indexName = self.uniqueName(q.table,q.columns);
          qa.push({ query:'create unique index if not exists ' + indexName + ' on ' + q.table + ' (' + q.columns.join() + ')' });
        }
        else if (q.type == 'createIndex') {
          let indexName = self.indexName(q.table,q.columns);
          qa.push({ query:'create index if not exists ' + indexName + ' on ' + q.table + ' (' + q.columns.join() + ')' });
        }
        else if (q.type == 'dropIndex') {
          let indexName = self.indexName(q.table,q.columns);
          qa.push({ query:'drop index if exists '+indexName });
        }
        else if (q.type == 'update') {
          let values = {};
          let fps = [];
          for (fieldName in q.set) {
            fps.push(fieldName+' = :'+fieldName);
            values[fieldName] = q.set[fieldName];
          }
          for (fieldName in q.values) {
            values[fieldName] = q.values[fieldName];
          }
          qa.push({ query:'update '+q.table+' set '+fps.join()+' where '+q.cond, values:values });
        }
        else if (q.type == 'insert') {
          let values = {};
          let fs = [];
          let ps = [];
          for (fieldName in q.set) {
            fs.push(fieldName);
            ps.push(':'+fieldName);
            values[fieldName] = q.set[fieldName];
          }
          qa.push({ query:'insert into '+q.table+' ('+fs.join()+') values ('+ps.join()+')', values:values });
        }
        else if (q.type == 'SchemaVersion') {
          qa.push({ SchemaVersion:q.SchemaVersion });
        }
      });
      return qa;
    },

    indexName: function (tableName, columnNames) { // {{{
      return tableName + '_index_' + columnNames.join('_');
    }, // }}}

    uniqueName: function (tableName, columnNames) { // {{{
      return tableName + '_unique_' + columnNames.join('_');
    }, // }}}

  };

} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
