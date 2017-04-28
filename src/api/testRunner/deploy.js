/**
 * Copyright 2017, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

require('colors');

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const {
  deleteVersion,
  finalize,
  getUrl,
  log,
  testRequest
} = require('../utils');

function changeScaling (config, yamlName) {    
  const oldYamlPath = path.join(config.cwd, yamlName);   
  const newYamlPath = path.join(config.cwd, `${config.test}-${config.now}.yaml`);    
   
  log(config, 'Compiling:', newYamlPath.yellow);   
  let yaml = fs.readFileSync(oldYamlPath, 'utf8');   
  yaml += `\n\nmanual_scaling:\n  instances: 1\n`;   
   
  if (config.dryRun) {   
    log(config, 'Printing:', newYamlPath.yellow, `\n${yaml}`);   
  } else {   
    log(config, 'Writing:', newYamlPath.yellow);   
    fs.writeFileSync(newYamlPath, yaml, 'utf8');   
  }    
   
  return newYamlPath;    
}    


module.exports = (config = {}) => {
  return new Promise((resolve, reject) => {
    config.now = Date.now();
    config.cwd = config.cwd || process.cwd();
    config.tries = config.tries || 3;
    config.yaml = config.yaml || 'app.yaml';
    const cmd = config.deployCmd || 'gcloud';

    if (config.dryRun) {
      log(config, 'Beginning dry run...'.cyan);
    }

    log(config, 'Deploying app in:', config.cwd.yellow);
    // Keep track off whether "done" has been called yet
    let calledDone = false;
    // Keep track off whether the logs have fully flushed
    let logFinished = false;

    // Manually set # of instances to 1   
    const tmpAppYaml = changeScaling(config, config.yaml || 'app.yaml');

    const args = [
      'app',
      'deploy',
      path.parse(tmpAppYaml).base,
      // Skip prompt
      '-q',
      `--project=${config.projectId}`,
      // Deploy over existing version so we don't have to clean up
      `--version=${config.test}`,
      '--no-promote'
    ];

    log(config, `Deploy command: ${(cmd + ' ' + args.join(' ')).yellow}`);

    if (config.dryRun) {
      log(config, 'Dry run complete.'.cyan);
      resolve();
      return;
    }

    // Exit helper so we don't call "done" more than once
    function finish (err) {
      if (!calledDone) {
        calledDone = true;
        if (err) {
          finalize(err, resolve, reject);
          return;
        }
        if (logFinished) {
          finalize(null, resolve, reject);
          return;
        }
        const intervalId = setInterval(() => {
          if (logFinished) {
            clearInterval(intervalId);
            finalize(null, resolve, reject);
          }
        }, 1000);
      }
    }

    let numEnded = 0;
    function attemptDeploy (triesLeft) {
      log(config, `DEPLOYING... (${triesLeft} tries remaining)`);

      const logFile = path.join(config.cwd, `${config.test}-${Date.now()}.log`);
      const logStream = fs.createWriteStream(logFile, { flags: 'a' });

      function finishLogs () {
        numEnded++;
        if (numEnded === 2) {
          logStream.end();
          log(config, `Saved logfile to ${logFile}`);
        }
      }

      // Don't use "npm run deploy" because we need extra flags
      const proc = spawn('gcloud', args, {
        cwd: config.cwd,
        shell: true
      });

      log(config, `gcloud ${args.join(' ')}`);

      try {
        logStream.on('finish', () => {
          if (!logFinished) {
            logFinished = true;
          }
        });

        proc.stdout.pipe(logStream, { end: false });
        proc.stderr.pipe(logStream, { end: false });

        proc.stdout.on('data', (data) => {
          const str = data.toString();
          if (str.includes('\n')) {
            process.stdout.write(`${config.test.bold}: ${'stdout:'.bold} ${str}`);
          } else {
            process.stdout.write(str);
          }
        });
        proc.stderr.on('data', (data) => {
          const str = data.toString();
          if (str.includes('\n')) {
            process.stderr.write(`${config.test.bold}: ${'stderr:'.bold} ${str}`);
          } else {
            process.stderr.write(str);
          }
        });

        proc.stdout.on('end', finishLogs);
        proc.stderr.on('end', finishLogs);

        // This is called if the process fails to start. "error" event may or may
        // not be fired in addition to the "exit" event.
        proc.on('error', finish);

        // Process has completed
        proc.on('exit', (code, signal) => {
          if (signal === 'SIGKILL') {
            log(config, 'SIGKILL received!');
          }
          if (code !== 0 && signal !== 'SIGKILL') {
            // Deployment failed
            log(config, `ERROR ${code} ${signal}`);

            // Pass error as second argument so we don't short-circuit the
            // parallel tasks
            const error = new Error(`${config.test}: failed to deploy!`);
            if (triesLeft > 0) {
              console.error(error);
              attemptDeploy(triesLeft - 1);
            } else {
              finish(error);
            }
          } else {
            // Deployment succeeded
            log(config, 'App deployed...');

            // Test versioned url of "default" module
            let demoUrl = getUrl(config);

            if (config.demoUrl) {
              demoUrl = config.demoUrl;
            }

            // Test that app is running successfully
            log(config, `Testing ${demoUrl}`);
            testRequest(demoUrl, config, 10)
              .then(() => {
                log(config, 'Success!');
                finish();
              })
              .catch((err) => {
                console.error(`Error in attemptDeploy:`, err);
                if (triesLeft > 0) {
                  attemptDeploy(triesLeft - 1);
                }
              });
          }
        });
      } catch (err) {
        if (proc) {
          proc.kill('SIGKILL');
        }
        finish(err);
      }
    }

    attemptDeploy(config.tries);
  })
  .then(() => {
    if (config.delete && !config.dryRun) {
      return deleteVersion(config).catch(() => {});
    }
  }, (err) => {
    if (config.delete && !config.dryRun) {
      return deleteVersion(config)
        .catch(() => {})
        .then(() => Promise.reject(err));
    }
    return Promise.reject(err);
  })
  .catch((err) => {
    console.error('Error in utils.testDeploy:', err);
  });
};
