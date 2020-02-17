#! /usr/bin/env node

/*

    THE ORIGINAL WAS IN
    /home/dkz/dev-utpp/museum-1808-massive-upload/upload-batch-85.js

    ATTENTION THIS IS ONLY FOR MUSEUM-V2
*/


const fs = require('fs');
const path = require('path');
const assert = require('assert');
const jsonfile = require('jsonfile')
const yaml = require('js-yaml');
const Massive = require('massive');
const monitor = require('pg-monitor');
var pdfjsLib = require('pdfjs-dist');
const klaw = require('klaw');

const argv = require('yargs')
  .alias('v','verbose').count('verbose')
  .alias('p','password')
  .alias('f','file')
  .alias('d','dir')
  .alias('a','all')
  .alias('e','env')
//  .alias('u','upload')
  .options({
    'commit': {default:false},
  }).argv;


if (argv._.length <1) {
  (argv.verbose >=2) && console.log(`@36 Missing argv._:`,argv._);
  console.log(`Need an environment file, ex:
    ./104-upload-pages.js -vv .env-ultimheat.yaml
    =>exit.`);
  return;
}

const env = yaml.safeLoad(fs.readFileSync(argv._[0], 'utf8'));
console.log({env})
let {host, port=5432, user='postgres', database, root:root_folder} = env;

const password = argv.password || process.env.PGPASSWORD;
if (!password) {
  console.log(`Missing password
    =>exit.`);
  return;
}
/******
const host = argv.host || process.env.PGHOST || 'localhost';
const port = argv.port || process.env.PGPORT || '5433';
const database = argv.database || process.env.PGDATABASE || 'museum-v3';
const user = argv.user || process.env.PGUSER || 'postgres';

argv.dir = argv.dir || process.env.pdfdir;
************/

if (!root_folder) {
  console.log(`Need root-folder ex:
    root: /media/dkz/Seagate/18.11-Museum-rsync-inhelium/pdf-www
    =>exit.`);
  return;
}

// ==========================================================================

/*
  Here we process an entire folder.
*/


function *walkSync(dir,patterns) {
  const files = fs.readdirSync(dir, 'utf8');
//  console.log(`scanning-dir: <${dir}>`)
  for (const file of files) {
    try {
      let pathToFile = path.join(dir, file);
      if (file.startsWith('.')) continue; // should be an option to --exclude
        const fstat = fs.statSync(pathToFile);

      if (fs.statSync(pathToFile).isSymbolicLink()) {
        let pathToFile = fs.realpathSync(pathToFile)
      }

      const isDirectory = fs.statSync(pathToFile).isDirectory();
      if (isDirectory) {
        if (file.startsWith('.')) continue;
          yield *walkSync(pathToFile, patterns);
      } else {
        if (file.startsWith('.')) continue;
        let failed = false;
        for (pat of patterns) {
          const regex = new RegExp(pat,'gi');
          if (file.match(regex)) continue;
          failed = true;
          break;
        };
        if (!failed)
        yield pathToFile;
      }
    }
    catch(err) {
      console.log(`ALERT on file:${ path.join(dir, file)} err:`,err)
//      console.log(`ALERT err:`,err)
      continue;
    }
  }
}


main(argv)
.then(({npages, nfiles})=>{
  console.log(`done npages:${npages} in ${nfiles} pdf-files`);
})
.catch (err => {
  throw err
})

let nfiles =0;
let npages =0;


const etime = new Date().getTime();

async function main() {
  try {
    console.log(`@110 Massive startup w/passwd: <${password}>`);
    const db = await Massive({
      host,
      port,
      database,
      user,
      password
    });
    console.log('Massive is ready.');

    return await walk(db);
  }
  catch (err) {
    console.log(err)
  }
}

async function walk(db) {
  return new Promise((resolve, reject) =>{
    klaw(root_folder, {
        //filter: (item)=>{return item.path.endsWith('.pdf')}
        filter: (item)=> {
//          console.log(`@144 filter nfiles:${nfiles}`)
          return(nfiles<10) // no effect because
        }
    })
    .on('data', async (item) =>{
        let {path:fn} = item;
        if (fn.endsWith('.pdf')) {
  //        console.log(`file[${nfiles}]`, fn)
          nfiles ++;
          if (nfiles <=10*1000) {
            console.log(`@155 ondata nfiles:${nfiles}`)
            await upload_museum_pages(fn,db);
            console.log(`===================================`)
          }
        }
    })/*
      .on('readable', function () {
        let item
        while ((item = this.read())) {
          console.log(`x:`, item)
        }
      })*/
    .on('error', (err, item) => {
        console.log(err.message)
        console.log(item.path) // the file the error occurred on
        reject(err)
    })
    .on('end', () => {
        console.log(`klaw done etime:${new Date().getTime() - etime}ms.`);
        resolve({nfiles:999, npages:99999});
    })
  }) // promise
} // walk


async function upload_museum_pages(fn,db) {
//  const xid = path.dirname(fn).split('/'); // last one
  const dirname = path.dirname(fn);
  let xid = dirname.substring(dirname.lastIndexOf('/'));
  if (!xid) {
    console.log(`@183:`,path.dirname(fn).split('/'))
    console.log(`@184:`,path.dirname(fn).split('/')[-1])
    throw 'FATAL'
  }
  if (xid[0] != '/') {
    console.log(`@190:`,path.dirname(fn))
    console.log(`@191 xid:`,xid)
    throw 'FATAL';
  }
  xid = xid.substring(1);
  console.log(`@182 XID:${xid}`)
  const fn2 = fs.realpathSync(fn)
  const baseName = path.basename(fn2);
  const doc = await pdfjsLib.getDocument(fn2).promise;
//  npages += doc.numPages;
//  console.log(`[${nfiles++}] npages:${doc.numPages} <${fn}> `);

  for (let pageNo=1; pageNo <= doc.numPages; pageNo++) {
    const txt_fn = (fn + `-${('0000'+pageNo).substr(-4)}.txt`);
    if (!fs.existsSync(txt_fn)) {
//      console.log(`file-not-found: <${txt_fn}>`)
      continue;
    }

    const raw_text = fs.readFileSync(txt_fn, 'utf8')

    if (argv.commit) {
      try {
        npages ++;
        console.log(`files:${nfiles} page:${pageNo} total:${npages}`);
//        console.log(`-- page ${pageNo} raw_text:${raw_text.length}`);
//        const ts_vector = undefined;
        const json_data = {xid}
        const retv = await db.tvec.write_page('museum.pdf',baseName, pageNo, json_data, raw_text);
        console.log(`@195 -- page ${nfiles}.${pageNo} raw_text.length:${raw_text.length} retv:`, {retv})
      }
      catch(err) {
        console.log(err)
      }
    }
  }; // each page
}


return;



main(argv)
.then((npages)=>{
  console.log('done npages:',npages);
  db.instance.$pool.end();
})
.catch (err => {
  throw err
})

function _assert(b, o, err_message) {
  if (!b) {
    console.log(`[${err_message}]_ASSERT=>`,o);
    console.trace(`[${err_message}]_ASSERT`);
    throw {
      message: err_message // {message} to be compatible with other exceptions.
    }
  }
}
