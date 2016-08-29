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

var execSync = require('child_process').execSync;
var fs = require('fs-extra');
var path = require('path');

function fillInMissing (samples) {
  samples.samples || (samples.samples = []);
}

function gatherHelpText (filename, samples) {
  var dir = path.parse(filename).dir;
  samples.samples.forEach(function (sample) {
    if (typeof sample.usage === 'string') {
      sample.usage = {
        cmd: sample.usage,
        text: sample.usage
      };
    }
    if (!sample.help && sample.usage && typeof sample.usage.cmd === 'string') {
      sample.help = execSync(sample.usage.cmd, {
        cwd: dir
      });
    }
  });
}

module.exports = function parse (filename, callback) {
  fs.stat(filename, function (err) {
    if (err) {
      return callback(new Error(filename + ' does not exist!'));
    }

    fs.readJson(filename, function (err, samples) {
      if (err) {
        return callback(err);
      }

      fillInMissing(samples);
      gatherHelpText(filename, samples);

      callback(null, samples);
    });
  });
};
