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

var cli = require('yargs');
var path = require('path');

var program = module.exports = {
  generate: require('./generate'),
  init: require('./init'),
  list: require('./list'),
  validate: require('./validate'),
  main: function (args) {
    // Run the command-line program
    cli.help().strict().parse(args).argv;
  }
};

cli
  .demand(1)
  .command('generate', 'Generate a README.md file in the current directory.', {}, program.generate)
  .command('init', 'Create a new samples.json file in the current directory.', {}, program.init)
  .command('list', 'List samples.', {}, program.list)
  .command('validate', 'Validate the samples.json file in the current directory.', {}, program.validate)
  .options({
    filename: {
      alias: 'f',
      type: 'string',
      default: path.join(process.cwd(), 'samples.json'),
      global: true
    }
  })
  .example('samples init', 'Create a new samples.json file in the current directory.')
  .example('samples validate', 'Validate the samples.json file in the current directory.')
  .wrap(80)
  .recommendCommands()
  .epilogue('For more information, see https://github.com/GoogleCloudPlatform/nodejs-repo-tools');
