/*
 * bourne
 * https://github.com/andreww8088/bourne
 *
 * Copyright (c) 2014 Andrew Burgess
 * Licensed under the MIT license.
 */
(function () {
'use strict';

var store = {};

if (typeof require !== 'undefined') {
    var fs = require('fs');
    store.exists = fs.existsSync.bind(fs);
    store.remove = fs.unlinkSync.bind(fs);
    store.get    = fs.readFileSync.bind(fs);
    store.set    = fs.writeFile.bind(fs);
} else {
    store.exists = function (key) { return localStorage.getItem(key) !== null; };
    store.remove = localStorage.removeItem.bind(localStorage);
    store.get    = localStorage.getItem.bind(localStorage);
    store.set    = function (key, value, callback) { localStorage.setItem(key, value); callback && callback(); };
}

function noStore() {
    var data;
    return {
        exists: function () { return false; },
        remove: function () { },
        get   : function () { return data; },
        set   : function (key, value, callback) { data = value; callback && callback(); }
    };
}

var Bourne = function (name, options) {
    options = options || {};
    this.name = name;
    this.data = [];
    this._id = 1;

    if (options.temp) {
        this.store = noStore();
    } else {
        this.store = options.store || store;
    }

    if (this.store.exists(this.name)) {
        if (options.reset) {
            this.store.remove(name);
        } else {
            this.data = JSON.parse(this.store.get(name) || {});
            this._id  = Math.max.apply(Math, this.data.map(function (r) { return r.id; })) + 1;
        }
    } else {
        this.store.set(this.name, JSON.stringify(this.data));
    }

// Lazy Method
//    if (this.store.exists(this.name) && options && !option.reset) {
//        this.data = json.parse(this.store.get(name) || {});
//        this._id  = math.max.apply(math, this.data.map(function (r) { return r.id; }));
//    }
};

Bourne.prototype.insert = function (record, callback) {
    record.id = this._id++;
    this.data.push(record);
    this.store.set(this.name, JSON.stringify(this.data), function () {
        callback && callback(null, record);
    });
};
Bourne.prototype.insertAll = function (records, callback) {
    var ids = [];
    records.forEach(function (record) {
        record.id = this._id++;
        ids.push(record.id);
        this.data.push(record);
    }.bind(this));
    this.store.set(this.name, JSON.stringify(this.data), function () {
        if (callback) this.find({ id: { $in: ids }}, callback);
    }.bind(this));
};

var operators = {
    $lt: function (key, value, record) {
        return record[key] < value;
    },
    $gt: function (key, value, record) {
        return record[key] > value;
    },
    $lte: function (key, value, record) {
        return record[key] <= value;
    },
    $in: function (key, values, record) {
        for (var i = 0; i < values.length; i++) {
            if (record[key] === values[i]) {
                return true;
            }
        }
        return false;
    }
};

Bourne.operator = function (name, fn) {
    if (operators[name]) {
        throw 'operator "' + name + '" already exists.'
    }

    operators[name] = fn;
};


function createFilter(query, defaultReturn) {
    return function (record) {
        for (var key in query) {
            if (query.hasOwnProperty(key)) {
                if (typeof query[key] !== 'object') {
                    if (!record[key] || record[key] !== query[key]) {
                        return defaultReturn;
                    }
                } else {
                    for (var op in query[key]) {
                        if (query[key].hasOwnProperty(op)) {
                            if (!operators[op](key, query[key][op], record)) {
                                return defaultReturn;
                            }
                        }
                    }
                }
            }
        }
        return !defaultReturn;
    }
}

Bourne.prototype.find = function (query, callback) {
    if (typeof callback === 'undefined') {
        callback = query;
        query = {};
    }
    var data = this.data.filter(createFilter(query, false));

    callback(null, data);
};

Bourne.prototype.findOne = function (query, callback) {
    this.find(query, function (err, records) {
        callback(err, records[0]);
    });
};

var updateOperators = {
    $set: function (record, params) {
        for (var prop in params) {
            if (params.hasOwnProperty(prop)) {
                record[prop] = params[prop];
            }
        }
    },
    $unset: function (record, params) {
        for (var prop in params) {
            if (record.hasOwnProperty(prop)) {
                delete record[prop];
            }
        }
    }
};

Bourne.prototype.update = function (query, update, callback) {
    var ids = [];

    if (update.$set) {
        this.find(query, function (err, records) {
            records.forEach(function (record) {
                updateOperators.$set(record, update.$set);
            });
            this.store.set(this.name, JSON.stringify(this.data), function () {
                if (callback) callback(null, records);
            }.bind(this));
        }.bind(this));
    } else if (update.$unset) {
        this.find(query, function (err, records) {
            records.forEach(function (record) {
                updateOperators.$unset(record, update.$unset);
            });
            this.store.set(this.name, JSON.stringify(this.data), function () {
                if (callback) callback(null, records);
            }.bind(this));
        }.bind(this));
    } else {
        this.find(query, function (err, records) {
            records.forEach(function (record) {
                ids.push(record.id); 
            });

            this.delete(query, function () {
                var updatedRecords = ids.map(function (id) {
                    var u = JSON.parse(JSON.stringify(update));
                    u.id = id;
                    return u;
                });

                this.data = this.data.concat(updatedRecords);

                this.store.set(this.name, JSON.stringify(this.data), function () {
                    if (callback) this.find({ id: { $in: ids }}, callback);
                }.bind(this));
            }.bind(this));
        }.bind(this));
    }
};

Bourne.prototype.delete = function (query, callback) {
    this.data = this.data.filter(createFilter(query, true));
    this.store.set(this.name, JSON.stringify(this.data), function () {
        callback && callback(null);
    });
};

Bourne.prototype.destroy = function () {
    if (this.store.exists(this.name)) {
        this.store.remove(this.name);
    }
    this.name = this._id = this.data = null;
};

if (typeof exports !== 'undefined') {
    module.exports = Bourne;
} else {
    window.Bourne = Bourne;
}

}.call(this));
