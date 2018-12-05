/*
 * All-in-one interactive Streamlabs OBS release script.
 */
/**
 * CONFIGURATION
 */
import path = require('path');
import cp = require('child_process');
import fs = require('fs');

import yml = require('js-yaml');
import semver = require('semver');
import sh = require('shelljs');
import colors = require('colors');
import inq = require('inquirer');
import AWS = require('aws-sdk');
import ProgressBar = require('progress');

const s3Buckets = [ 'streamlabs-obs', 'slobs-cdn.streamlabs.com' ];
const sentryOrg = 'streamlabs-obs';
const sentryProject = 'streamlabs-obs';

let awsAccessKeyId: string;
let awsSecretAccessKey: string;
let cscLink: string
let cscKeyPassword: string
let sentryAuthToken: string;

interface IReleaseAnswers {
  sourceBranch: string,
  targetBranch: string,
  chance: number,
  newVersion: string
}

async function askReleaseType() {
  const result = await inq.prompt<{releaseType: string}>({
      type: 'list',
      name: 'releaseType',
      message: 'Which type of release would you like to do?',
      choices: [
        {
          name: 'Normal release (All users will receive this release)',
          value: 'normal'
        },
        {
          name: 'Preview release',
          value: 'preview'
        }
      ]
    });

  return result.releaseType;
}

async function askReleaseQuestions(currentVersion: string, isPreview: boolean) {
  let versionOptions: (string | null)[];

  if (isPreview) {
    versionOptions = [
      semver.inc(currentVersion, 'prerelease', false, 'preview'),
      semver.inc(currentVersion, 'prepatch',   false, 'preview'),
      semver.inc(currentVersion, 'preminor',   false, 'preview'),
      semver.inc(currentVersion, 'premajor',   false, 'preview')
    ];
  } else {
    versionOptions = [
      semver.inc(currentVersion, 'patch'),
      semver.inc(currentVersion, 'minor'),
      semver.inc(currentVersion, 'major')
    ];
  }

  // Remove duplicates
  versionOptions = [...new Set(versionOptions)];

  /* FIXME choices can have null elements I guess */
  let questions: inq.Question[] = [
    {
      type: 'list',
      name: 'newVersion',
      message: 'What should the new version number be?',
      choices: versionOptions as string[]
    },
    {
      type: 'input',
      name: 'chance',
      message: 'What percentage of the userbase would you like to recieve the update?'
    }
  ]

  let choices: inq.ChoiceType[] = [{ name: 'staging', value: 'staging' }];

  if (isPreview) {
  } else {
    choices = [
      ...choices,
      {
        name: 'preview',
        value: 'preview'
      },
      {
        name: 'master (hotfix releases only)',
        value: 'master'
      }
    ];

    questions.push({
      type: 'list',
      name: 'sourceBranch',
      message: 'Which branch would you like to release from?',
      choices
    });
  }

  let result = await inq.prompt<IReleaseAnswers>(questions);

  if (isPreview) {
    result.targetBranch = 'preview';
  } else {
    result.targetBranch = 'master';
  }

  return result;
}

function info(msg: string) {
  sh.echo(colors.magenta(msg));
}

function error(msg: string) {
  sh.echo(colors.red(`ERROR: ${msg}`));
}

function executeCmd(cmd: string, exit: boolean = true) {
  const result = sh.exec(cmd);

  if (result.code !== 0) {
    error(`Command Failed >>> ${cmd}`);
    if (exit) sh.exit(1);
  }
}

function sentryCli(cmd: string) {
  const sentryPath = path.join('bin', 'node_modules', 'sentry-cli-binary', 'bin', 'sentry-cli');

  executeCmd(`${sentryPath} releases --org "${sentryOrg}" --project "${sentryProject}" ${cmd}`);
}

async function confirm(msg: string) {
  const result = await inq.prompt<IConfirmation>({
    type: 'confirm',
    name: 'conf',
    message: msg
  });

  return result.conf;
}

function checkEnv(name: string): string {
  const value = process.env[name];

  if (typeof value === 'string') {
    return value;
  }

  error(`Missing environment variable ${name}`);
  sh.exit(1);
  return ''; /* FIXME: To appease typescript */
}

async function callSubmodule(moduleName: string, args: string[]) {
  if (!Array.isArray(args)) args = [];

  return new Promise((resolve, reject) => {
    const submodule = cp.fork(moduleName, args);

    submodule.on('close', (code) => {
      if (code !== 0) {
        reject(code);
      } else {
        resolve();
      }
    });
  });
}

/* We can change the release script to export a function instead.
 * I already made this into a separate script so I think this is fine */
async function actualUploadUpdateFiles(bucket: string, version: string, appDir: string) {
  return callSubmodule(
    'bin/release-uploader.js',
    [
      '--s3-bucket', bucket,
      '--access-key', awsAccessKeyId,
      '--secret-access-key', awsSecretAccessKey,
      '--version', version,
      '--release-dir', appDir,
    ]
  );
}

async function actualSetLatestVersion(bucket: string, version: string, fileName: string) {
  return callSubmodule(
    'bin/set-latest.js',
    [
      '--s3-bucket', bucket,
      '--access-key', awsAccessKeyId,
      '--secret-access-key', awsSecretAccessKey,
      '--version', version,
      '--version-file', fileName
    ]
  );
}

async function actualSetChance(bucket: string, version: string, chance: number) {
  return callSubmodule(
    'bin/set-chance.js',
    [
      '--s3-bucket', bucket,
      '--access-key', awsAccessKeyId,
      '--secret-access-key', awsSecretAccessKey,
      '--version', version,
      '--chance', `${chance}`
    ]
  );
}

async function actualUploadS3File(bucket: string, name: string, filepath: string) {
  info(`Starting upload of ${name}...`);

  const stream = fs.createReadStream(filepath);
  const upload = new AWS.S3.ManagedUpload({
    params: {
      Bucket: bucket,
      Key: name,
      ACL: 'public-read',
      Body: stream
    },
    queueSize: 1
  });

  const bar = new ProgressBar(`${name} [:bar] :percent :etas`, {
    total: 100,
    clear: true
  });

  upload.on('httpUploadProgress', progress => {
    bar.update(progress.loaded / progress.total);
  });

  try {
    await upload.promise();
  } catch (err) {
    error(`Upload of ${name} failed`);
    sh.echo(err);
    sh.exit(1);
  }
}

/* Wrapper functions to upload to multiple s3 buckets */

async function uploadUpdateFiles(version: string, appDir: string) {
  for (const bucket of s3Buckets) {
    await actualUploadUpdateFiles(bucket, version, appDir);
  }
}

async function setLatestVersion(version: string, fileName: string) {
  for (const bucket of s3Buckets) {
    await actualSetLatestVersion(bucket, version, fileName);
  }
}

async function setChance(version: string, chance: number) {
  for (const bucket of s3Buckets) {
    await actualSetChance(bucket, version, chance);
  }
}

async function uploadS3File(name: string, filepath: string) {
  for (const bucket of s3Buckets) {
    await actualUploadS3File(bucket, name, filepath);
  }
}

interface IConfirmation {
  conf: boolean;
}

interface IChance {
  chance: number;
}

/**
 * This is the main function of the script
 */
async function runScript() {
  info(colors.magenta('|-------------------------------------------|'));
  info(colors.magenta('| Streamlabs OBS Interactive Release Script |'));
  info(colors.magenta('|-------------------------------------------|'));

  if (!await confirm('Are you sure you want to release?')) sh.exit(0);

  // Start by figuring out if this environment is configured properly
  // for releasing.
  const awsAccessKeyId    = checkEnv('AWS_ACCESS_KEY_ID');
  const awsSecretAccessKey= checkEnv('AWS_SECRET_ACCESS_KEY');
  const cscLink           = checkEnv('CSC_LINK');
  const cscKeyPassword    = checkEnv('CSC_KEY_PASSWORD');
  const sentryAuthToken   = checkEnv('SENTRY_AUTH_TOKEN');

  /* Technically speaking, we allow any number of
   * channels. Maybe in the future, we allow custom
   * options here? */
  let sourceBranch;
  let targetBranch;

  // Make sure the release environment is clean
  info('Stashing all uncommitted changes...');
  executeCmd('git add -A');
  executeCmd('git stash');

  // Sync the source branch
  info(`Syncing ${sourceBranch} with the origin...`);
  executeCmd('git fetch');
  executeCmd(`git checkout ${sourceBranch}`);
  executeCmd('git pull');
  executeCmd(`git reset --hard origin/${sourceBranch}`);

  if (sourceBranch !== targetBranch) {
    // Sync the target branch
    info(`Syncing ${targetBranch} with the origin...`);
    executeCmd('git fetch');
    executeCmd(`git checkout ${targetBranch}`);
    executeCmd('git pull');
    executeCmd(`git reset --hard origin/${targetBranch}`);

    // Merge the source branch into the target branch
    info(`Merging ${sourceBranch} into ${targetBranch}...`);
    executeCmd(`git merge ${sourceBranch}`);
  }

  info('Removing old packages...');
  sh.rm('-rf', 'node_modules');

  info('Installing fresh packages...');
  executeCmd('yarn install');

  info('Compiling assets...');
  executeCmd('yarn compile:production');

  const pjson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const currentVersion = pjson.version;

  info(`The current application version is ${currentVersion}`);

  const releaseType = await askReleaseType();
  const isPreview = releaseType === 'preview';

  const answers = await askReleaseQuestions(currentVersion, isPreview);
  const channel = (() => {
    const components = semver.prerelease(answers.newVersion);

    if (components) return components[0];
    return 'latest';
  })();

  if (!await confirm(`Are you sure you want to package version ${answers.newVersion}?`)) sh.exit(0);

  pjson.version = answers.newVersion;

  info(`Writing ${answers.newVersion} to package.json...`);
  fs.writeFileSync('package.json', JSON.stringify(pjson, null, 2));

  info('Packaging the app...');
  executeCmd(`yarn package${isPreview ? ':preview' : ''}`);

  info(`Version ${answers.newVersion} is ready to be deployed.`);
  info('You can find the packaged app at dist/win-unpacked.');
  info('Please run the packaged application now to ensure it starts up properly.');
  info('When you have confirmed the packaged app works properly, you');
  info('can continue with the deploy.');

  if (!await confirm('Are you ready to deploy?')) sh.exit(0);

  info('Committing changes...');
  executeCmd('git add -A');
  executeCmd(`git commit -m "Release version ${answers.newVersion}"`);

  info('Pushing changes...');
  executeCmd('git push origin HEAD');

  info(`Tagging version ${answers.newVersion}...`);
  executeCmd(`git tag -f v${answers.newVersion}`);
  executeCmd('git push --tags');

  info(`Registering ${answers.newVersion} with sentry...`);
  sentryCli(`new "${answers.newVersion}"`);
  sentryCli(`set-commits --auto "${answers.newVersion}"`);

  info('Uploading compiled source to sentry...');
  const sourcePath = path.join('bundles', 'renderer.js');
  const sourceMapPath = path.join('bundles', 'renderer.js.map');
  sentryCli(`files "${answers.newVersion}" delete --all`);
  sentryCli(`files "${answers.newVersion}" upload "${sourcePath}"`);
  sentryCli(`files "${answers.newVersion}" upload "${sourceMapPath}"`);

  info('Discovering publishing artifacts...');
  const distDir = path.resolve('.', 'dist');
  const channelFileName = path.parse(sh.ls(path.join(distDir, '*.yml'))[0]).base;
  const channelFilePath = path.join(distDir, channelFileName);

  info(`Discovered ${channelFileName}`);

  const parsedChannel = yml.safeLoad(fs.readFileSync(channelFilePath, 'utf8'));
  const installerFileName = parsedChannel.path;
  const installerFilePath = path.join(distDir, installerFileName);

  if (!fs.existsSync(installerFilePath)) {
    error(`Could not find ${path.resolve(installerFilePath)}`);
    sh.exit(1);
  }

  info(`Disovered ${installerFileName}`);
  info('Uploading publishing artifacts...');

    /* Use the separate release-uploader script to upload our
   * win-unpacked content. */

  await uploadUpdateFiles(answers.newVersion, path.resolve('dist', 'win-unpacked'));
  await uploadS3File(installerFileName, installerFilePath);
  await uploadS3File(channelFileName, channelFilePath);

  console.log('Setting latest version...');
  await setLatestVersion(answers.newVersion, channel);

  console.log('Setting chance...');
  await setChance(answers.newVersion, answers.chance);

  info(`Merging ${targetBranch} back into staging...`);
  executeCmd(`git checkout staging`, false);
  executeCmd(`git merge ${targetBranch}`, false);
  executeCmd('git push origin HEAD', false);

  info('Finalizing release with sentry...');
  sentryCli(`finalize "${answers.newVersion}`);

  info(`Version ${answers.newVersion} released successfully!`);
}

runScript().then(() => {
  sh.exit(0);
});
