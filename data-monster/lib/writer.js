var fs        = require('fs'),
    util      = require('util'),
    _         = require('lodash'),
    pretty    = require('js-object-pretty-print').pretty, // unpacks objects
    beautify  = require('js-beautify').js_beautify,      // formats output
    guts      = require('./guts.js'),
    flags     = { tt   : false,
                  axis : false  };                      // to output companion files

function buildString(structure){

  // LISTS
  var noms = {
    // special assemblies
    data      : dataBite,
    dataList  : queueBite,
    canvas    : canvasBite,
    elem      : elemBite,
    xAxis     : _.partial(assembleAxes,'x'),
    yAxis     : _.partial(assembleAxes,'y'),
    xScale    : _.partial(assembleScales,'x'),
    yScale    : _.partial(assembleScales,'y'),
    insert    : function(arg) { return arg },
    tooltips  : assembleTooltips,

   // special processes 
    attr   : _.partial(prettyBite,".attr"),
    style  : _.partial(prettyBite,".style"),
    text   : function(arg) { return _.partial(atomicBite, ".text")(stringWrap(arg))} ,
    color  : _.partial(makeVar, "color"),
   
   //  tooltip: ttBite,
    clean  : cleanBite,
    funcs  : funcsBite,

   // shorthand events
    click     :   _.partial(eventBite, "click"),
    mouseover :   _.partial(eventBite, "mouseover"),
    mouseenter:   _.partial(eventBite, "mouseenter"),
    mouseleave:   _.partial(eventBite, "mouseleave"),
    hover     :   _.partial(eventBite, "hover"),
     
   //  process functions
   variable     : eatVars,
   'function'   : eatFuncs,
   params       : eatParams,
  },

  d3things = {
    // colors
    category10  : _.partial(assembled3things, 'pre', 'scale'),
    category20  : _.partial(assembled3things, 'pre', 'scale'),
    category20b : _.partial(assembled3things, 'pre', 'scale'),
    category20c : _.partial(assembled3things, 'pre', 'scale'),

    // axes
    linear      : _.partial(assembled3things, 'pre', 'scale'),
    log         : _.partial(assembled3things, 'pre', 'scale'),
    identity    : _.partial(assembled3things, 'pre', 'scale'),
    sqrt        : _.partial(assembled3things, 'pre', 'scale'),
    pow         : _.partial(assembled3things, 'pre', 'scale'),
    quantize    : _.partial(assembled3things, 'pre', 'scale'),
    quantile    : _.partial(assembled3things, 'pre', 'scale'),
    threshold   : _.partial(assembled3things, 'pre', 'scale'),
    time        : _.partial(assembled3things, 'post', 'scale')

  };

  // SMALL FUNCS
  function atomicBite(meth, arg){
    return meth + "(" + arg + ") \n";
  }

  function cleanBite(val){
    eval('var moo = function(d){ ' + val['function'] + '; }');
    return 'rawData.forEach(' + moo + ');';
  }

  function eventBite(type, bite){
    return atomicBite(".on", stringWrap(type) + ", " + bite['function']);
  }

  function funcsBite(val){
    return val['function'];
  }

  function prettyBite(prefix, bite){
    var bite = _.isArray(bite) ? guts.objectify(bite, {}) : bite;
    return atomicBite(prefix, pretty(bite , 4, "JSON", true))
  }
  
  function stringWrap(check){
    return _.isString(check) ? '"' + check + '"' : check;
  }

  function dExpand(toExpand, scale){
    scale ? 
        eval('var moo = function(d){ return ' + scale + '(' + toExpand + ' )}')
      : eval('var moo = function(d){ return ' + toExpand + ' }')
    return moo;
  }

  function makeVar(v, val){
    return 'var ' + v + ' = ' + process(val) + ';';
  }

  // BIG BITES
  function dataBite(bite){
    var str = "";
    str += "function draw_" + bite.name + "(rawData){";
    str +=  bite.clean ? cleanBite(bite.clean) : '';
    str += _.map(bite.children, function(c){
        return 'draw_' + c + '(rawData);'
    }).join('');
    str += '} \n\n';
    return str;
  }

  function queueBite(bite){
    var str = "";
    str += "queue()"
    str += _.map(bite, function(el){
      return ".defer(d3" + el.filetype + ", '" + el.file + "')";
    }).join('');    
    str += ".awaitAll( function(err, dataArr) { ";
    str += "if(err){ console.log(err) } ";
    str += _.map(bite, function(n, idx){
      return "draw_" + n.name + "(dataArr["+ idx + "]); } );"
    }).join('');
    return str;
  }

  function canvasBite(bite){
    // the func opened here is closed by the bracket inserted in arrange()
    var str = "function draw_" + bite.name + "(data){",
        margins = bite.margins ? 
                  assembleMargins(eatParams(bite.margins)) : 
                  { top: 0, right: 0, bottom: 0, left: 0 };
    
    bite.width   = bite.width - margins.left - margins.right;
    bite.height  = bite.height - margins.top - margins.bottom;

    str += "var margin = " + pretty(margins) + ", ";
    str += "width = " + bite.width +  ", ";
    str += "height = " + bite.height + ";";

    str+= bite.yPrim ? "var yPrime = " +  stringWrap(bite.yPrim.split('.')[1]) + ", maxY = d3.max(data, function(d){return " +  bite.yPrim + " });" : "";
    str+= bite.xPrim ? "var xPrime = " +  stringWrap(bite.xPrim.split('.')[1]) + ", maxX = d3.max(data, function(d){return " + bite.xPrim + "});" : ""; 
    str+= bite.yPrim ? "maxY = maxY + (maxY * .25); // Make it a little taller \n" : "";

    str += "var svg = d3.select('" + bite.selector + "')";
    str += ".append('svg')";
    str += ".attr('width', width  + margin.left + margin.right)";
    str += ".attr('height', height + margin.top + margin.bottom)";
    str += ".append('g')";
    str += ".attr('transform', 'translate(' + margin.left + ', ' + margin.top + ')');";
    return str;
  }

  function elemBite(bite){
    var str = "";
    str += bite.runIn ? ".append('g')" : "svg.append('g')";
    str += ".attr('class', ";
    str += (bite.elemSelect || "'elements'") + ")";
    str += ".append('" + bite.type + "')"
    str += ".attr(" + pretty(_.zipObject(_.keys(bite.req_specs), _.map(bite.req_specs, function(el){ return process(el, bite.name)})), 4, 'PRINT', true)   + ")"; // add keys into this
    str += "\n"
    return str;
  }

  // ASSEMBLERS
  function assembleAxes(type, bite){
    flags.axis = true;

    var str = "",
        orient = { x: "'bottom'", y: "'left'" },
        o = _.omit(bite, 'parent'),
        b = _.mapValues(o, function(mb){ return _.isArray(mb) ? guts.objectify(mb, {}) : mb; }),
        m = _.mapValues(b, function(ins){ return guts.isHashMap(ins) ? 
                                                _.mapValues(ins, function(mins){ return _.has(mins, 'variable') ? 
                                                      process(mins, bite.parent) 
                                                    : mins; }) 
                                                : ins; });
    str += "\n"
    str += "var " + type + "Axis = d3.svg.axis()";
    str += atomicBite(".scale", type + 'Scale');
    str += atomicBite(".orient", orient[type]) + ';';
    str += "svg.append('g')";
    str += ".attr('class','" + type + " axis')";
    str += type === 'x' ? ".attr('transform', 'translate(0,' + height + ')')" : "";
    str += ".call(" + type + "Axis )";
    str += ".append('text')";
    str += build(guts.objPairs(m)) + ';';
    return str;
  } 
  
  function assembled3things(director, label, itself){
    if(director === 'pre'){
      return 'd3.' + label + '.' + itself + '()';
    } else if (director === 'post'){
      return 'd3.' + itself + '.' + label + '()';
    } else {
      throw new Error('Cannot assemble d3things; unknown director.');
    }
  }

  function assembleEnter(type){
    var str = "";
    str += "svg.selectAll('" + type + "')"; 
    str += ".data(data)";
    str += ".enter()";
    return str;
  }

  function assembleMargins(margins){
    var obj = {};
    if (margins.length === 4){
      obj.top     = +margins[0];
      obj.right   = +margins[1];
      obj.bottom  = +margins[2];
      obj.left    = +margins[3];
    } else if (margins.length === 3){
      obj.top     = +margins[0];
      obj.right   = +margins[1];
      obj.bottom  = +margins[2];
      obj.left    = +margins[1];
    } else if (margins.length === 2){
      obj.top     = +margins[0];
      obj.right   = +margins[1];
      obj.bottom  = +margins[0];
      obj.left    = +margins[1];
    } else if (margins.length === 1){
      obj.top     = +margins[0];
      obj.right   = +margins[0];
      obj.bottom  = +margins[0];
      obj.left    = +margins[0];
    } else {
      throw new Error('Incorrect margin arity');
    }
    return obj;
  }

  function assembleScales(type, bite){
    var str   = "",
        title = type + 'Scale';

    if (!bite) {
      return str;
    } else if (bite === 'default'){
      str += "var " + title + " = ";
      (type === 'x') && (str += "d3.scale.linear().domain([0, maxX]).range([0, width])");
      (type === 'y') && (str += "d3.scale.linear().domain([0, maxY]).range([height, 0]);");  
    } else {
      var domain = eatParams(bite.domain),
          range  = eatParams(bite.range);
      str += "var " + title + " = ";
      str += eatVars(bite.scale);
      str += ".domain([" + domain[0] + ", " + domain[1] + "])";
      str += ".range([" + range[0] + ", " + range[1] + "]);";
    }

    return str;
  }

  function assembleTooltips(bite){
    flags.tt = true;

    var str = "";

    str += ".on('mouseover', function(d){";
    str += "var xPosition = event.clientX + scrollX < width - 200 ? event.clientX + scrollX : event.clientX + scrollX - 200,";
    str += "yPosition = event.clientY + scrollY + 100 > height ? event.clientY + scrollY - 25 : event.clientY + scrollY + 5,";
    str += "text = ";
    str += guts.isHashMap(bite) ? process(bite[_.keys(bite)]) :  " d[xPrime] + '; ' + d[yPrime] ";
    str+= ";";
    str+= "d3.select('#tooltip')";
    str+= ".style('left', xPosition + 'px')";
    str+= ".style('top', yPosition + 'px')";
    str+= ".select('#values')";
    str+= ".text(text);";
    str+= "d3.select('#tooltip').classed('hidden', false); })";
    str+= ".on('mouseout', function(){";
    str+= "d3.select('#tooltip').classed('hidden', true); })";
    return str;
  }


  // PROCESS FUNCS
   
  function eatVars(varObj, parent){
    return _.includes(_.keys(d3things), varObj.variable) ?
        d3things[varObj.variable](varObj.variable)
      : varObj.variable.match(/\bd\./) ?
        dExpand(varObj.variable, varObj.scale)
      : lookup(varObj.variable, parent);
  }

  function eatFuncs(funcObj){
    eval('var moo = ' + funcObj['function']);
    return moo;
  }

  function eatParams(paramsObj){
    return paramsObj.params;
  }

  function lookup(toFind, scope){
    var lookat = _.filter(_.flatten(structure), function(f){
      return  _.has(f, 'parent') && f.parent === scope;
    });

    var val = _.findLast(lookat, function(n){
      return _.includes(_.keys(n), toFind);
    });

    if (val) return val[toFind];

    var grandparent =  _.result(_.findWhere(_.flatten(structure), { name: scope }), 'parent');
    if (grandparent) return lookup(toFind, grandparent);

    throw new Error('ReferenceError: ' + toFind + ' is not defined.')
  }

  // WORKHORSE FUNCS
  
  function process(value, parent){
    return guts.isHashMap(value) ?
        noms[_.keys(value)[0]](value, parent)
      : stringWrap(value);
  }

  function build(expressions){
    // console.log('EXPS', expressions);
    return _.map(expressions, function(exp){
      if (guts.isHashMap(exp)){
        var key = _.first(_.keys(_.omit(exp, 'parent')));
        return _.includes(_.keys(exp), 'name') ?
             noms[exp.name.split('_')[0]](exp)
           : _.includes(_.keys(noms), key) ?
             noms[key](exp[key])
           : atomicBite(key, process(exp[key], exp.parent));
      } else {
        throw new Error('Invalid input:' + exp);
      }
    }).join('');
  }

  // Do a little shuffling so we can map & join for correct order:
  // - Move data to end and create list object
  // - Create 'enter', 'color', and 'scales' objects if not explicitly created
  // - Add canvas enders
  function arrange(innerStructure){
    var colors    = _.filter(innerStructure, function(f){ return _.has(f, 'color')}),
        scales    = _.filter(innerStructure, function(f){ return _.has(f, 'xScale') ||  _.has(f, 'yScale') }), 
        scaleKeys = _.flatten(_.map(scales, _.keys)),
        canvasIdx = _.findIndex(innerStructure, function(f){ return _.has(f, 'name') && f.name.split('_')[0] === 'canvas';}),
        dataBites = _.filter(innerStructure, function(f){ return _.has(f, 'name') && f.name.split('_')[0] === 'data'; }),
        restBites = _.reject(innerStructure, function(f){ return (_.has(f, 'name') && f.name.split('_')[0] === 'data') || _.has(f, 'xScale') ||  _.has(f, 'yScale'); }),
        dataList  = _.map(dataBites, function(el){
          return { name: el.name, filetype: el.filetype, file: el.file };
        });

    if (!(colors.length)){
      restBites.splice(canvasIdx, 0, { color: {'function': function(id){ return id; }} });
    }

    if (!(_.includes(scaleKeys, 'xScale'))){
      scales.push({xScale: 'default'});
    }

    if (!(_.includes(scaleKeys, 'yScale'))){
      scales.push({yScale: 'default'});
    }

    restBites.splice(canvasIdx, 0, scales);

    if (!(_.some(_.flatten(_.map(restBites, _.keys)), function(v){return v === 'enter'}))){
      var elemIdx = _.findIndex(innerStructure, function(f){ return _.has(f, 'name') && f.name.split('_')[0] === 'elem'; });
      innerStructure[elemIdx].runIn = true; // this way we don't append 'g' in the elemBite
      restBites.splice(elemIdx - 1, 0, {insert: assembleEnter(innerStructure[elemIdx].type)});
    }

    return _.flatten(restBites.concat({insert: '}'}, dataBites, { 'dataList': dataList }));
  }


  // console.log(beautify(_.map(_.map(structure, arrange), build).join(''), {"break_chained_methods": true}));
  return beautify(_.map(_.map(structure, arrange), build).join(''), {"break_chained_methods": true});
}

exports.string  = buildString;
exports.flags   = flags;
