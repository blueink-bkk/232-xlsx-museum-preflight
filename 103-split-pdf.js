#! /usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const assert = require('assert');
//const writeJsonFile = require('write-json-file');
//const loadJsonFile = require('load-json-file');
const yaml = require('js-yaml');
//const createSymlink = require('create-symlink');
//const {realpathSync} = require('fs');
const find = require('find'); // 2019 find.file(regex,path); find.fileSync(regex,path)
const pdfjsLib = require('pdfjs-dist');


//const {xnor1, xnor2, xnor3} = require('./lib/utils')
//const {api,_assert, __assert} = require('../207-jpc-catalogs-admin/lib/openacs-api')


//const {_assert, fatal_error} = require('./lib/openacs-api');
//const input_fn = '0-Heating-Museum-from-start-to-31-Mars-2019-FRENCN-20190425.xlsx';


const argv = require('yargs')
  .alias('v','verbose').count('verbose')
//  .alias('o','output')
//  .boolean('pg-monitor')
//  .boolean('commit')
  .options({
//    'pg-monitor': {default:true},
//    'limit': {default:99999}, // stop when error, if --no-stop, show error.
//    'zero-auteurs': {default:false}, //
  }).argv;

const {verbose, output} = argv;
//const pg_monitor = (verbose>1);
const input_fn = argv._[0];

if (!www_root) {
  console.log(`
    ************************************************
    FATAL : root-directory
    ./103-split-pdf.js <root-directory>
    ************************************************
    `);
  process.exit(-1);

}

if (!fs.existsSync(www_root)) {
  console.log(`
    FATAL : root-directory not found <${www_root}>
    `);
  process.exit(-1);
}


const files = find.fileSync('index.yaml', www_root);
