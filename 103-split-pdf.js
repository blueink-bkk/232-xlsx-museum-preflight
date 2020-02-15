#! /usr/bin/env node

/*************************************************
    Instead of getting pdf-filename from YAML
    we could directly find the pdf.
    -Also dont rebuild if timeStamp older.

**************************************************/
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
const wrap = require('word-wrap');

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
const www_root = argv._[0] || '/home/dkz/tmp/232-museum-data'

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
//console.log({files})

if (false) {
  const pdf1 = '/home/dkz/tmp/232-museum-data/3001/1883 Science Pittoresque Barometre thermometre Cheminees.pdf';
  const pdf2 = '/media/dkz/Seagate/2019-museum-assets/PDF-20191231/1896 Electromecanique chauffage 20200110.pdf';

  const loadingTask = pdfjsLib.getDocument(pdf2);
  loadingTask.promise.then(function(pdf) {
    // you can now use *pdf* here
    console.log({pdf})
  });
}


//return;

main();
console.log(`Going async... on ${files.length} files`)


async function main() {
  for (fn of files) {
    const article = yaml.safeLoad(fs.readFileSync(fn, 'utf8'))
    if (article.deleted) continue;
//    console.log({article})
  //  console.log(`#${article.xid} ${article.deleted?"-deleted":""}`)
    console.log(`#${article.xid} ${article.h1} pdf:`, article.links && article.links.map(it=>it.fn));
    if (!article.links) continue;
    for (link of article.links) {
      if (!fs.existsSync(path.join(fn,'..',link.fn))) {
        console.log(`@93 ALERT pdf file-not-found <${path.join(fn,'..',link.fn)}>`)
        continue; // ATT: BUG.
      }
      const pdf_fn = await fs.realpath(path.join(fn,'..',link.fn));
      if (!fs.existsSync(pdf_fn)) {
        console.log(`@93 ALERT pdf file-not-found <${pdf_fn}>`)
        continue;
      }
//      console.log(`file :::: <${pdf_fn}>`)
      const doc = await get_pdf_doc(pdf_fn)
//      console.log({pdf})
      console.log(`@72 #${article.xid} ${doc.numPages} pages for <${pdf_fn}>`)

//      await split_pdf_raw_text(pdf_fn, options)
      const pages =[];

      for (let pageno=1; pageno <=doc.numPages; pageno++) {
        const page = await doc.getPage(pageno);
        const textContent = await page.getTextContent();
        const vp = textContent.items
          .map(it =>it.str.replace(/[\(•\)\*\+\^■\{\}\|]+/g,' ')
              .replace(/\s([,\.])/g,'$1')
              .replace(/\s+/g,' ')
              .replace(/([,_\.\-])[,_\.\-]+/,'$1')
              .replace(/^[^a-zA-Z0-9]*$/g,'')
              .replace(/­/,'<H>') // ATTENTION DISC-HYPHEN hidden here.
              .trim())
          .filter(it =>(it.length>0))
        const txt = vp.join(' ').replace(/([a-zé])\-\s([a-zé])/g,'$1$2').replace(/<H>\s/g,'')
        //if (txt.length <=10) console.log(`ALERT:`,{txt})


        if (txt.length <50) continue;
        if (txt.length >50) pages.push(txt); // or not enough info. just pic.
//        console.log(`textContent.items:`,txt)
        const txt_fn = `${path.join(fn,'..',link.fn)}-${('0000'+pageno).substr(-4)}.txt`;
        console.log(`writing txt on <${txt_fn}>`)
        fs.writeFileSync(txt_fn, wrap(txt,{width:80}),'utf8');
      }  // each pdf-page
//      console.log({pages})
//      console.log(`${pages.length} pages: ${pages.map(it=>('['+it.length+']')).join(',')}`)
    }
  }
}

async function get_pdf_doc(fn) {
  return pdfjsLib.getDocument(fn).promise
  .then(function(pdf) {
      // you can now use *pdf* here
    return (pdf)
  })
  .catch(err=>{
    console.log({err})
    throw err;
  })
}



async function split_pdf_raw_text(fn, options) {
  options = options ||{};
  const {verbose} = options;
  const pages =[];

  verbose && console.log(`fetching pdf-document <${fn}>`);
  const pdf_doc = pdfjsLib.getDocument(fn);
  verbose && console.log(`found ${doc.numPages} pages for <${fn}>`);
  for (let pageno=1; pageno <=doc.numPages; pageno++) {
    const page = await doc.getPage(pageno);
    const textContent = await page.getTextContent();
    pages.push(textContent.items)
  }  // each pdf-page
  return pages;
}
