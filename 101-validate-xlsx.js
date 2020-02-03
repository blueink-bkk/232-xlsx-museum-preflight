#! /usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const assert = require('assert');

/*
const Massive = require('massive');
const monitor = require('pg-monitor');
const pdfjsLib = require('pdfjs-dist');
const yaml = require('js-yaml');
const jsonfile = require('jsonfile');
const utils = require('./dkz-lib.js');
const hash = require('object-hash');
const cms = require('./cms-openacs.js');
*/

const xlsx_fn = './museum.xlsx';
const xlsx = require('./xlsx2json.js')(xlsx_fn);

let deleted_Count =0;
let xlsx_Count =0;
xlsx.forEach(it=>{
  xlsx_Count ++;
  if (it.deleted) deleted_Count ++;
})
console.log(`xlsx total-rows:${xlsx_Count} deleted:${deleted_Count}`)

const _xlsx = {}; // access sur base du xid.
const _au = {};

for (let ix=0; ix <xlsx.length; ix++) {
  const it = xlsx[ix];
  if (it.deleted) continue;
  _xlsx[it.xid] = it;

  if (it.sec >= 3) {
//    console.log(`-- section-${it.sec} xid:${it.xid}`)
//    console.log(`   auteurs:`,it.auteurs)
//    console.log(`   titles:`,it.indexNames) // titre de doument
    it.auteurs.forEach(au=>{
      _au[au] = _au[au] || [];
      _au[au].push(it.xid);
    })
  }
}

// index des titres classes par auteurs.
//
const index_auteurs = Object.keys(_au)
.sort((a,b)=>(a.localeCompare(b)))
.map(auteur =>{
  const documents = _au[auteur]; // array
//  console.log(documents);
  documents.forEach(xid=>{
    console.log(`${auteur}`)
    const doc = _xlsx[xid];
    doc.indexNames && doc.indexNames.forEach(titre=>{
      console.log(` --@${xid}: ${titre}`)
    })
  })
})

console.log(`Auteurs:${Object.keys(_au).length}`);
console.log({_au})
