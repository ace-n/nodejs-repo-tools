// Copyright 2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

var chalk = require('chalk');
var fs = require('fs-extra');
var handlebars = require('handlebars');
var parse = require('./parse');
var path = require('path');
var string = require('string');
var utils = require('../api/utils');

handlebars.registerHelper('slugify', function (str) {
  return string(str).slugify().s;
});

handlebars.registerHelper('trim', function (str) {
  return string(str).trim().s;
});

var tpl = path.join(__dirname, '../templates/readme.tpl');

module.exports = function generate (options) {
  var dir = path.parse(options.filename).dir;

  parse(options.filename, function (err, json) {
    if (err) {
      return console.log(chalk.red(err.message));
    }

    Object.keys(utils.products[json.id]).forEach(function (field) {
      json[field] = utils.products[json.id][field];
    });

    var template = handlebars.compile(fs.readFileSync(tpl, 'utf-8'));
    var readmePath = path.join(dir, 'README.md');

    fs.writeFile(readmePath, template(json), function (err) {
      if (err) {
        return console.log(chalk.red('Failed to generated README.md'));
      }

      console.log(chalk.green('Generated ' + readmePath));
    });
  });
};
