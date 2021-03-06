var parserLib = require('../lib/parser.js');
    parser    = parserLib.parser,
    structure = require('../lib/parser.js').structure,
    chomper   = require('../lib/interpreter.js').chomper,
    _         = require('lodash'),
    __        = require('lodash-contrib');

parserLib.build();



describe('structure', function(){
  var builtStruct = structure(__dirname + '/ent-ex.dm');

  it('is defined', function(){
    expect(builtStruct).toBeDefined();
  });

  it('is an object', function(){
    expect(builtStruct).toEqual(jasmine.any(Object));
  });

  it('does not contain any undefined terms', function(){

    var arr = [];

    __.walk.preorder(builtStruct, function(value, key, parent){
      (key === undefined) && arr.push(parent);
      (value === undefined) && arr.push(parent);
    });

    expect(arr.length).toEqual(1); // this is a hacky way to test, since the walk always returns 1 undefined

  })
});

describe('chomper', function(){
  it('can chomp a data spec with a file', function(){
    var dm = chomper(parser.parse("(data: 'van_gogh_additional_measurements.tsv')"));
    expect(JSON.stringify(dm)).toMatch(/("file":"van_gogh_additional_measurements.tsv")|("filetype":".tsv")/g);

  });

  it('can chomp a data spec with an array', function(){
    var dm = chomper(parser.parse("(data: [1, 2, 4])"));
    expect(JSON.stringify(dm)).toMatch(/("file":"[1, 2, 4]")|("filetype":"array")/g);
  });

  it('assigns canvas children to data parent', function(){
    var dm = chomper(parser.parse("(data: 'file.csv' (canvas: 100 100 '#id') )"));
    var testy = _.flatten(__.walk.filter(dm, __.walk.preorder, function(value, key){
      return key === 'children';
    }));

    expect(testy.length).toEqual(1);
  });

  it('can can create a canvas without a parent', function(){
    var dm = chomper(parser.parse("(canvas: 100 100 '#id')"));
    expect(dm).toBeDefined();
    expect(JSON.stringify(dm)).toMatch(/canvas_/);
  });

  it('handles canvas siblings', function(){
    var dm = chomper(parser.parse("(data: 'file.csv' (canvas: 100 100 '#id') (canvas: 200 200 '#doubleid') )"));
    var testy = _.flatten(__.walk.filter(dm, __.walk.preorder, function(value, key){
      return key === 'children';
    }));

    expect(testy.length).toEqual(2);
  });

  it('handles element siblings', function(){
    var dm = chomper(parser.parse("(canvas: 100 100 '#id' (elem: circle: { cx: 'ratio'}) (elem: circle: { cx: 'ratio'}))"));
    var testy = _.flatten(__.walk.filter(dm, __.walk.preorder, function(value, key){
      return key === 'children';
    }));

    expect(testy.length).toEqual(2);
  });

})




