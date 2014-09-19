'use strict';

if (typeof require !== 'undefined') {
    var Bourne = require('../lib/bourne.js');
    var Chance = require('chance');
}

var c = new Chance();

var testName = (typeof __dirname !== 'undefined') ? __dirname + '/' : '';
testName += c.string({ pool: 'abcdefghijklmnopqrstuvwxyz' });

var testRecord1 = { firstname: c.first(), lastname: c.last(), age: c.age(), birthday: c.birthday() },
    testRecord2 = { firstname: c.first(), lastname: c.last(), age: c.age(), birthday: c.birthday() },
    testRecord3 = { firstname: c.first(), lastname: c.last(), age: c.age(), birthday: c.birthday() };

this.bourne_test = {
    prepopulated: {
        setUp: function(done) {
            var db = this.db = new Bourne(testName, { reset: true, temp: true });
            db.insert(testRecord1, function () {
                db.insert(testRecord2, function () {
                    db.insert(testRecord3, done);
                });
            });
        },
        tearDown: function (done) {
            this.db.destroy();
            done();
        },
        'can find records by one key': function (test) {
            this.db.find({ firstname: testRecord1.firstname }, function (err, records) {
                test.equal(records.length, 1, 'should find one record');
                test.equal(records[0].firstname, testRecord1.firstname, 'names should be equal');
                test.done();
            });
        },
        'can find records by multiple keys': function (test) {
            this.db.find({ firstname: testRecord1.firstname, age: testRecord1.age }, function (err, records) {
                test.equal(records.length, 1, 'should find one record');
                test.equal(records[0].age, testRecord1.age, 'names should be equal');
                test.done();
            });
        },
        'can find multiple records': function (test) {
            var r = { firstname: testRecord1.firstname, age: c.age() };

            var db = this.db;

            db.insert(r, function () {
                db.find({ firstname: testRecord1.firstname }, function (err, records) {
                    test.equal(records.length, 2, '2 records should be found');
                    test.done();
                });
            });
        },
        'can use query operators': function (test) {
            var r = { firstname: c.first(), age: 10 };

            var db = this.db;

            db.insert(r, function () {
                db.find({ age: { $lt: 11 } }, function (err, records) {
                    test.notEqual(records.length, 0, 'should have at least 1 record');
                    test.done();
                }); 
            });
        },
        'can find a single record': function (test) {
            this.db.findOne({ firstname: testRecord1.firstname }, function (err, record) {
                test.equal(record.firstname, testRecord1.firstname, 'names should be equal');
                test.done();
            });
        },
        'can find all records': function (test) {
            this.db.find(function (err, records) {
                test.equal(records.length, 3, 'should find 3 records');
                test.done();
            });
        },
        'can updated records by replacement': function (test) {
            var updatedQuery = { age: 200 };

            this.db.update({ firstname: testRecord1.firstname }, updatedQuery, function (err, records) {
                updatedQuery.id = records[0].id;
                test.deepEqual(records[0], updatedQuery, 'objects match');
                test.done();
            });
        },
        'can update records with $set operator': function (test) {
            this.db.update({ firstname: testRecord1.firstname }, { $set: { firstname: 'XXX' } }, function (err, records) {
                test.equal(records[0].firstname, 'XXX', 'name is updated');
                test.done();
            });
        },
        'can update records with $unset operator': function (test) {
            this.db.update({ firstname: testRecord1.firstname }, { $unset: { lastname: '' }}, function (err, records) {
                test.equal(records[0].lastname, undefined, 'no last name');
                test.done()
            });
        },
        'can delete records': function (test) {
            var db = this.db;
            db.delete({ firstname: testRecord1.firstname }, function () {
                db.find({ firstname: testRecord1.firstname }, function (err, records) {
                    test.equal(records.length, 0, 'no records should be found');
                    test.done();
                });
            });
        }
    }, 
    'can create Bourne instance': function(test) {
        test.expect(1);

        test.doesNotThrow(function () {
            var db = new Bourne(testName, { reset: true, temp: true });
        });

        test.done();
    },
    'can insert record': function (test) {
        test.expect(2);
        var db = new Bourne(testName, { reset: true, temp: true });
        db.insert(testRecord1, function (err, record) {
            test.equal(testRecord1.firstname, record.firstname, 'names should be equal');
            test.equal(record.id, 1, 'id should be 1');
            test.done();
        });
    },
    'can restart indexing at the right number': function (test) {
        var str = '[{ "id": 1, "attr": "value" }]';
        if (typeof require !== 'undefined') {
            var fs = require('fs');
            fs.writeFileSync(testName, str);
        } else {
            localStorage.setItem(testName, str);
        }
        var db = new Bourne(testName, { log: true });
        db.insert(testRecord1, function (err, record) {
            test.equal(record.id, 2, 'id should be 2');
            test.done();
            db.destroy();
        });
    },
    'can restart alternate': function (test) {
        var db = new Bourne(testName, { reset: true });
        db.insert(testRecord1, function (err, record) {
            test.equal(record.id, 1, 'first ID is 1');
            var db2 = new Bourne(testName, { log: true });
            db2.insert(testRecord2, function (err, record2) {
                test.equal(record2.id, 2, 'second ID is 2');
                test.done();
                db.destroy();
                db2.destroy();
            });
        });

    },
    'can store record persistently': function (test) {
        var db1 = new Bourne(testName, { reset: true });
        db1.insert(testRecord1, function (err, record) {
            var db2 = new Bourne(testName);
            test.equal(db2.data[0].firstname, testRecord1.firstname, 'names should be equal');
            test.done();
            db1.destroy();
            db2.destroy();
        });
    },
    'query operators': {
        '$lt': function (test) {
            operatorTest({ age: 10 }, { age: { $lt: 11 } }, function (err, records) {
                test.notEqual(records.length, 0, 'should have at least 1 record');
                test.done();
            });
        },
        '$gt': function (test) {
            operatorTest({ age: 10 }, { age: { $gt: 9 } }, function (err, records) {
                test.notEqual(records.length, 0, 'should have at least 1 record');
                test.done();
            });
        },
        '$lte': function (test) {
            operatorTest({ age: 10 }, { age: { $lte: 10 } }, function (err, records) {
                test.notEqual(records.length, 0, 'should have at least 1 record');
                test.done();
            });
        },
        'multiple operators': function (test) {
            operatorTest({ age: 10 }, { age: { $lt: 11, $gt: 9 } }, function (err, records) {
                test.notEqual(records.length, 0, 'should have at least 1 record');
                test.done();
            });
        }
    },
    'can insert multiple records': function (test) {
        var db = new Bourne(testName, { reset: true });
        db.insertAll([testRecord1, testRecord2], function (err, records) {
            test.equal(records.length, 2);
            test.done();
            db.destroy();
        });
    },
    'can work with no persistence': function (test) {
        var db = new Bourne(testName, { temp: true });
        db.insert(testRecord1, function (err, records) {
            var db2 = new Bourne(testName, { temp: true });
            test.equal(db2.data.length, 0, 'db2 should have no records');
            test.done();
            db.destroy();
            db2.destroy();
        });
    }
};

function operatorTest(record, query, cb) {
    var db = new Bourne(testName, { reset: true, temp: true });
    db.insert(record, function () {
        db.find(query, cb);
    });
}
